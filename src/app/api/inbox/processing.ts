import { eq } from "drizzle-orm";
import type { z } from "zod";
import { inboxItems } from "@/db/schema";
import type { CreateInput } from "@/features/transactions/actions/core";
import { validateAllOwnership } from "@/features/transactions/actions/core";
import { createTransactionForUser } from "@/features/transactions/actions/create-service";
import { revalidateForEntity } from "@/shared/lib/actions/helpers";
import { db } from "@/shared/lib/db";
import { getAdminPayerId } from "@/shared/lib/payers/get-admin-id";
import type { inboxItemSchema } from "@/shared/lib/schemas/inbox";
import { parseLocalDateString } from "@/shared/utils/date";

type InboxApiItem = z.infer<typeof inboxItemSchema>;

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

	const [inserted] = await db
		.insert(inboxItems)
		.values({
			userId,
			sourceApp: data.sourceApp,
			sourceAppName: data.sourceAppName,
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
			accountId: data.accountId,
			cardId: data.cardId,
			categoryId: data.categoryId,
			payerId: data.payerId,
			partyId: data.partyId,
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

	const autoImportInput = await buildAutoImportInput(userId, data);
	if (!autoImportInput.ok) {
		await saveAutoImportError(inserted.id, autoImportInput.error);
		revalidateForEntity("inbox", userId);
		return {
			clientId: data.clientId,
			serverId: inserted.id,
			success: true,
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
		await saveAutoImportError(inserted.id, error);
		revalidateForEntity("inbox", userId);
		return {
			clientId: data.clientId,
			serverId: inserted.id,
			success: true,
			status: "pending",
			autoImported: false,
			autoImportError: error,
		};
	}

	const transactionId = result.data?.ids[0];
	if (!transactionId) {
		const error = "Não foi possível identificar o lançamento criado.";
		await saveAutoImportError(inserted.id, error);
		revalidateForEntity("inbox", userId);
		return {
			clientId: data.clientId,
			serverId: inserted.id,
			success: true,
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
		.where(eq(inboxItems.id, inserted.id));

	revalidateForEntity("inbox", userId);

	return {
		clientId: data.clientId,
		serverId: inserted.id,
		success: true,
		status: "processed",
		autoImported: true,
		transactionId,
	};
}

async function buildAutoImportInput(
	userId: string,
	data: InboxApiItem,
): Promise<{ ok: true; input: CreateInput } | { ok: false; error: string }> {
	const name = data.parsedName?.trim();
	if (!name) {
		return { ok: false, error: "Informe o estabelecimento." };
	}

	if (!data.parsedAmount || data.parsedAmount <= 0) {
		return { ok: false, error: "Informe o valor da transação." };
	}

	if (!data.paymentMethod) {
		return { ok: false, error: "Forma de pagamento obrigatória." };
	}

	const payerId = data.payerId ?? (await getAdminPayerId(userId));
	const purchaseDate =
		data.purchaseDate ?? dateToInput(data.notificationTimestamp);
	const isCreditCard = data.paymentMethod === "Cartão de crédito";

	return {
		ok: true,
		input: {
			purchaseDate,
			name,
			transactionType: data.transactionType ?? "Despesa",
			amount: data.parsedAmount,
			condition: "À vista",
			paymentMethod: data.paymentMethod,
			payerId,
			partyId: data.partyId,
			isSplit: false,
			accountId: isCreditCard ? null : data.accountId,
			cardId: isCreditCard ? data.cardId : null,
			categoryId: data.categoryId,
			note: null,
			isSettled: isCreditCard ? null : true,
		},
	};
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
