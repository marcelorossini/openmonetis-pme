import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import {
	inboxItems,
	integrationAccountMappings,
	integrationCategoryMappings,
	integrationPartyMappings,
} from "@/db/schema";
import type { CreateInput } from "@/features/transactions/actions/core";
import { validateAllOwnership } from "@/features/transactions/actions/core";
import { createTransactionForUser } from "@/features/transactions/actions/create-service";
import { revalidateForEntity } from "@/shared/lib/actions/helpers";
import { db } from "@/shared/lib/db";
import { getAdminPayerId } from "@/shared/lib/payers/get-admin-id";
import { attemptInboxItemAutoReconciliation } from "@/shared/lib/reconciliations/service";
import type { ReconciliationStatus } from "@/shared/lib/reconciliations/types";
import type { inboxItemSchema } from "@/shared/lib/schemas/inbox";
import { parseLocalDateString } from "@/shared/utils/date";
import { normalizeOptionalText, resolveInboxMappingIds } from "./mapping";

type InboxApiItem = z.infer<typeof inboxItemSchema>;

type PersistedInboxItem = typeof inboxItems.$inferSelect;

export class InboxApiValidationError extends Error {
	override name = "InboxApiValidationError";
}

export type InboxProcessingResult = {
	clientId?: string;
	serverId: string;
	success: boolean;
	status: "pending" | "processed";
	autoImported: boolean;
	transactionId?: string;
	autoImportError?: string;
	reconciliationStatus?: Extract<
		ReconciliationStatus,
		"reconciled" | "unmatched" | "ambiguous"
	>;
	reconciledTitleId?: string;
};

export async function processInboxApiItem({
	userId,
	data,
}: {
	userId: string;
	data: InboxApiItem;
}): Promise<InboxProcessingResult> {
	const ownershipError = await validateAllOwnership(userId, {
		payerId: data.payerId,
		categoryId: data.categoryId,
		partyId: data.partyId,
		accountId: data.accountId,
		cardId: data.cardId,
	});

	if (ownershipError) {
		throw new InboxApiValidationError(ownershipError);
	}

	const resolvedMappings = await resolveInboxMappingIdsForUser(userId, data);
	const resolvedAccountId = data.accountId ?? resolvedMappings.accountId;
	const resolvedCategoryId = data.categoryId ?? resolvedMappings.categoryId;
	const resolvedPartyId = data.partyId ?? resolvedMappings.partyId;

	const [inserted] = await db
		.insert(inboxItems)
		.values({
			userId,
			sourceApp: data.sourceApp,
			sourceAppName: data.sourceAppName,
			profileKey: normalizeOptionalText(data.profileKey),
			originalTitle: data.originalTitle,
			originalText: data.originalText,
			notificationTimestamp: data.notificationTimestamp,
			parsedName: data.parsedName,
			parsedAmount: data.parsedAmount?.toString(),
			purchaseDate: data.purchaseDate
				? parseLocalDateString(data.purchaseDate)
				: null,
			transactionType: data.transactionType ?? null,
			paymentMethod: data.paymentMethod ?? null,
			accountId: resolvedAccountId,
			accountExternalKey: normalizeOptionalText(data.accountExternalKey),
			cardId: data.cardId,
			categoryId: resolvedCategoryId,
			categoryExternalKey: normalizeOptionalText(data.categoryExternalKey),
			payerId: data.payerId,
			partyId: resolvedPartyId,
			partyExternalKey: normalizeOptionalText(data.partyExternalKey),
			autoImportRequested: data.autoImport,
			status: "pending",
		})
		.returning({ id: inboxItems.id });

	if (!inserted) {
		throw new Error("Não foi possível registrar o pré-lançamento.");
	}

	if (!data.autoImport) {
		revalidateForEntity("inbox", userId);
		return {
			clientId: data.clientId,
			serverId: inserted.id,
			success: true,
			status: "pending",
			autoImported: false,
		};
	}

	const reprocessResult = await reprocessPendingInboxItem({
		userId,
		inboxItemId: inserted.id,
	});

	return {
		clientId: data.clientId,
		serverId: inserted.id,
		success: true,
		status: reprocessResult.status,
		autoImported: reprocessResult.autoImported,
		transactionId: reprocessResult.transactionId,
		autoImportError: reprocessResult.autoImportError,
	};
}

export async function reprocessPendingInboxItem({
	userId,
	inboxItemId,
}: {
	userId: string;
	inboxItemId: string;
}): Promise<{
	status: "pending" | "processed";
	autoImported: boolean;
	transactionId?: string;
	autoImportError?: string;
	reconciliationStatus?: Extract<
		ReconciliationStatus,
		"reconciled" | "unmatched" | "ambiguous"
	>;
	reconciledTitleId?: string;
}> {
	const item = await db.query.inboxItems.findFirst({
		where: and(
			eq(inboxItems.id, inboxItemId),
			eq(inboxItems.userId, userId),
			eq(inboxItems.status, "pending"),
		),
	});

	if (!item) {
		return {
			status: "pending",
			autoImported: false,
			autoImportError: "Item não encontrado ou já processado.",
		};
	}

	const resolvedMappings = await resolveInboxMappingIdsForUser(userId, item);
	const nextAccountId = item.accountId ?? resolvedMappings.accountId;
	const nextCategoryId = item.categoryId ?? resolvedMappings.categoryId;
	const nextPartyId = item.partyId ?? resolvedMappings.partyId;

	if (
		nextAccountId !== item.accountId ||
		nextCategoryId !== item.categoryId ||
		nextPartyId !== item.partyId
	) {
		await db
			.update(inboxItems)
			.set({
				accountId: nextAccountId,
				categoryId: nextCategoryId,
				partyId: nextPartyId,
				updatedAt: new Date(),
			})
			.where(eq(inboxItems.id, item.id));
	}

	const refreshedItem: PersistedInboxItem = {
		...item,
		accountId: nextAccountId,
		categoryId: nextCategoryId,
		partyId: nextPartyId,
	};

	if (!refreshedItem.autoImportRequested) {
		await clearAutoImportErrorIfResolved(refreshedItem);
		revalidateForEntity("inbox", userId);
		return {
			status: "pending",
			autoImported: false,
		};
	}

	const unresolvedMappingError = getUnresolvedMappingError(refreshedItem);
	if (unresolvedMappingError) {
		await saveAutoImportError(refreshedItem.id, unresolvedMappingError);
		revalidateForEntity("inbox", userId);
		return {
			status: "pending",
			autoImported: false,
			autoImportError: unresolvedMappingError,
		};
	}

	const autoImportInput = await buildAutoImportInputFromInboxItem(
		userId,
		refreshedItem,
	);
	if (!autoImportInput.ok) {
		await saveAutoImportError(refreshedItem.id, autoImportInput.error);
		revalidateForEntity("inbox", userId);
		return {
			status: "pending",
			autoImported: false,
			autoImportError: autoImportInput.error,
		};
	}

	const result = await createTransactionForUser({
		userId,
		userLabel: "OpenMonetis Companion",
		input: autoImportInput.input,
	});

	if (!result.success) {
		const error = result.error || "Não foi possível importar automaticamente.";
		await saveAutoImportError(refreshedItem.id, error);
		revalidateForEntity("inbox", userId);
		return {
			status: "pending",
			autoImported: false,
			autoImportError: error,
		};
	}

	const transactionId = result.data?.ids[0];
	if (!transactionId) {
		const error = "Não foi possível identificar o lançamento criado.";
		await saveAutoImportError(refreshedItem.id, error);
		revalidateForEntity("inbox", userId);
		return {
			status: "pending",
			autoImported: false,
			autoImportError: error,
		};
	}

	await db
		.update(inboxItems)
		.set({
			status: "processed",
			transactionId,
			processedAt: new Date(),
			autoImportError: null,
			updatedAt: new Date(),
		})
		.where(eq(inboxItems.id, refreshedItem.id));

	const reconciliationResult = await attemptInboxItemAutoReconciliation({
		userId,
		inboxItemId: refreshedItem.id,
		transactionId,
	});

	revalidateForEntity("transactions", userId);
	revalidateForEntity("financialTitles", userId);
	revalidateForEntity("inbox", userId);
	revalidateForEntity("reconciliations", userId);

	return {
		status: "processed",
		autoImported: true,
		transactionId,
		reconciliationStatus:
			reconciliationResult.status === "dismissed"
				? undefined
				: reconciliationResult.status,
		reconciledTitleId: reconciliationResult.reconciledTitleId ?? undefined,
	};
}

export async function resolveInboxMappingIdsForUser(
	userId: string,
	item: {
		sourceApp: string;
		profileKey?: string | null;
		accountId?: string | null;
		partyId?: string | null;
		categoryId?: string | null;
		accountExternalKey?: string | null;
		partyExternalKey?: string | null;
		categoryExternalKey?: string | null;
	},
): Promise<{
	accountId: string | null;
	partyId: string | null;
	categoryId: string | null;
}> {
	const profileKey = normalizeOptionalText(item.profileKey);
	const profileScope = profileKey ?? "";
	const accountExternalKey = normalizeOptionalText(item.accountExternalKey);
	const partyExternalKey = normalizeOptionalText(item.partyExternalKey);
	const categoryExternalKey = normalizeOptionalText(item.categoryExternalKey);

	const [accountMappings, partyMappings, categoryMappings] = await Promise.all([
		accountExternalKey
			? db
					.select({
						sourceApp: integrationAccountMappings.sourceApp,
						profileKey: integrationAccountMappings.profileKey,
						externalKey: integrationAccountMappings.externalKey,
						accountId: integrationAccountMappings.accountId,
					})
					.from(integrationAccountMappings)
					.where(
						and(
							eq(integrationAccountMappings.userId, userId),
							eq(integrationAccountMappings.sourceApp, item.sourceApp),
							eq(integrationAccountMappings.externalKey, accountExternalKey),
							eq(integrationAccountMappings.profileKey, profileScope),
						),
					)
			: Promise.resolve([]),
		partyExternalKey
			? db
					.select({
						sourceApp: integrationPartyMappings.sourceApp,
						profileKey: integrationPartyMappings.profileKey,
						externalKey: integrationPartyMappings.externalKey,
						partyId: integrationPartyMappings.partyId,
					})
					.from(integrationPartyMappings)
					.where(
						and(
							eq(integrationPartyMappings.userId, userId),
							eq(integrationPartyMappings.sourceApp, item.sourceApp),
							eq(integrationPartyMappings.externalKey, partyExternalKey),
							eq(integrationPartyMappings.profileKey, profileScope),
						),
					)
			: Promise.resolve([]),
		categoryExternalKey
			? db
					.select({
						sourceApp: integrationCategoryMappings.sourceApp,
						profileKey: integrationCategoryMappings.profileKey,
						externalKey: integrationCategoryMappings.externalKey,
						categoryId: integrationCategoryMappings.categoryId,
					})
					.from(integrationCategoryMappings)
					.where(
						and(
							eq(integrationCategoryMappings.userId, userId),
							eq(integrationCategoryMappings.sourceApp, item.sourceApp),
							eq(integrationCategoryMappings.externalKey, categoryExternalKey),
							eq(integrationCategoryMappings.profileKey, profileScope),
						),
					)
			: Promise.resolve([]),
	]);

	return resolveInboxMappingIds(item, {
		accounts: accountMappings,
		parties: partyMappings,
		categories: categoryMappings,
	});
}

async function buildAutoImportInputFromInboxItem(
	userId: string,
	item: PersistedInboxItem,
): Promise<{ ok: true; input: CreateInput } | { ok: false; error: string }> {
	const name = item.parsedName?.trim();
	if (!name) {
		return { ok: false, error: "Informe o estabelecimento." };
	}

	const amount = item.parsedAmount ? Number(item.parsedAmount) : null;
	if (!amount || amount <= 0) {
		return { ok: false, error: "Informe o valor da transação." };
	}

	if (!item.paymentMethod) {
		return { ok: false, error: "Forma de pagamento obrigatória." };
	}

	const payerId = item.payerId ?? (await getAdminPayerId(userId));
	const purchaseDate = dateToInput(
		item.purchaseDate ?? item.notificationTimestamp,
	);
	const isCreditCard = item.paymentMethod === "Cartão de crédito";

	if (!isCreditCard && !item.accountId) {
		return { ok: false, error: "Selecione uma conta." };
	}

	return {
		ok: true,
		input: {
			purchaseDate,
			name,
			transactionType: (item.transactionType ??
				"Despesa") as CreateInput["transactionType"],
			amount,
			condition: "À vista",
			paymentMethod: item.paymentMethod as CreateInput["paymentMethod"],
			payerId,
			partyId: item.partyId,
			isSplit: false,
			accountId: isCreditCard ? null : item.accountId,
			cardId: isCreditCard ? item.cardId : null,
			categoryId: item.categoryId,
			note: null,
			isSettled: isCreditCard ? null : true,
		},
	};
}

function getUnresolvedMappingError(
	item: Pick<
		PersistedInboxItem,
		| "accountId"
		| "accountExternalKey"
		| "partyId"
		| "partyExternalKey"
		| "categoryId"
		| "categoryExternalKey"
	>,
): string | null {
	if (item.accountExternalKey && !item.accountId) {
		return "Mapeamento de conta pendente.";
	}

	if (item.partyExternalKey && !item.partyId) {
		return "Mapeamento de cliente/fornecedor pendente.";
	}

	if (item.categoryExternalKey && !item.categoryId) {
		return "Mapeamento de categoria pendente.";
	}

	return null;
}

async function clearAutoImportErrorIfResolved(item: PersistedInboxItem) {
	if (!item.autoImportError) return;
	if (getUnresolvedMappingError(item)) return;

	await db
		.update(inboxItems)
		.set({
			autoImportError: null,
			updatedAt: new Date(),
		})
		.where(eq(inboxItems.id, item.id));
}

async function saveAutoImportError(inboxItemId: string, error: string) {
	await db
		.update(inboxItems)
		.set({
			autoImportError: error,
			updatedAt: new Date(),
		})
		.where(eq(inboxItems.id, inboxItemId));
}

function dateToInput(date: Date): string {
	return date.toISOString().slice(0, 10);
}
