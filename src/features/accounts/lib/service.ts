import { and, asc, eq, inArray } from "drizzle-orm";
import {
	categories,
	financialAccounts,
	integrationAccountMappings,
	transactions,
} from "@/db/schema";
import {
	INITIAL_BALANCE_CATEGORY_NAME,
	INITIAL_BALANCE_CONDITION,
	INITIAL_BALANCE_NOTE,
	INITIAL_BALANCE_PAYMENT_METHOD,
	INITIAL_BALANCE_TRANSACTION_TYPE,
} from "@/shared/lib/accounts/constants";
import { db } from "@/shared/lib/db";
import { normalizeOptionalText } from "@/shared/lib/inbox-integrations/mapping";
import { getAdminPayerId } from "@/shared/lib/payers/get-admin-id";
import { formatDecimalForDbRequired } from "@/shared/utils/currency";
import { getTodayInfo } from "@/shared/utils/date";
import { normalizeFilePath } from "@/shared/utils/string";
import type {
	AccountApiIntegrationInput,
	AccountsApiCreateInput,
	AccountsApiListSearchParams,
	AccountsApiUpdateInput,
} from "./api-contract";
import type { CreateAccountInput, UpdateAccountInput } from "./schemas";

export type AccountRecord = {
	id: string;
	name: string;
	accountType: string;
	status: string;
	note: string | null;
	logo: string;
	initialBalance: number;
	excludeFromBalance: boolean;
	excludeInitialBalanceFromIncome: boolean;
	createdAt: string;
};

export type AccountIntegrationBinding = {
	sourceApp: string;
	profileKey: string | null;
	externalKey: string;
	createdAt: string;
	updatedAt: string;
};

export type AccountApiItem = AccountRecord & {
	integrations: AccountIntegrationBinding[];
};

export type AccountsApiListResult = {
	items: AccountApiItem[];
	pagination: {
		page: number;
		pageSize: number;
		totalItems: number;
		totalPages: number;
	};
};

function mapIntegrationRow(
	row: typeof integrationAccountMappings.$inferSelect,
): AccountIntegrationBinding {
	return {
		sourceApp: row.sourceApp,
		profileKey: normalizeOptionalText(row.profileKey),
		externalKey: row.externalKey,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

export function mapAccountRowToAccount(
	account: typeof financialAccounts.$inferSelect,
): AccountRecord {
	return {
		id: account.id,
		name: account.name,
		accountType: account.accountType,
		status: account.status,
		note: account.note,
		logo: account.logo,
		initialBalance: Number(account.initialBalance ?? 0),
		excludeFromBalance: account.excludeFromBalance,
		excludeInitialBalanceFromIncome: account.excludeInitialBalanceFromIncome,
		createdAt: account.createdAt.toISOString(),
	};
}

function matchesSearch(account: AccountRecord, search: string | null) {
	if (!search) return true;
	const needle = search.trim().toLowerCase();
	if (!needle) return true;

	return [
		account.name,
		account.accountType,
		account.status,
		account.note,
		account.logo,
	]
		.filter(Boolean)
		.some((value) => value?.toLowerCase().includes(needle));
}

async function fetchIntegrationMapForAccountIds(
	userId: string,
	accountIds: string[],
): Promise<Map<string, AccountIntegrationBinding[]>> {
	if (accountIds.length === 0) {
		return new Map();
	}

	const rows = await db.query.integrationAccountMappings.findMany({
		where: and(
			eq(integrationAccountMappings.userId, userId),
			inArray(integrationAccountMappings.accountId, accountIds),
		),
		orderBy: [
			asc(integrationAccountMappings.sourceApp),
			asc(integrationAccountMappings.externalKey),
		],
	});

	const grouped = new Map<string, AccountIntegrationBinding[]>();

	for (const row of rows) {
		const current = grouped.get(row.accountId) ?? [];
		current.push(mapIntegrationRow(row));
		grouped.set(row.accountId, current);
	}

	return grouped;
}

async function fetchAccountRowForUser(userId: string, accountId: string) {
	return db.query.financialAccounts.findFirst({
		where: and(
			eq(financialAccounts.id, accountId),
			eq(financialAccounts.userId, userId),
		),
	});
}

export async function fetchAccountForApi(
	userId: string,
	accountId: string,
): Promise<AccountApiItem | null> {
	const row = await fetchAccountRowForUser(userId, accountId);
	if (!row) return null;

	const integrationsMap = await fetchIntegrationMapForAccountIds(userId, [
		accountId,
	]);

	return {
		...mapAccountRowToAccount(row),
		integrations: integrationsMap.get(accountId) ?? [],
	};
}

export async function findAccountIdByIntegration(
	userId: string,
	integration: AccountApiIntegrationInput,
): Promise<string | null> {
	const profileScope = integration.profileKey ?? "";
	const existing = await db.query.integrationAccountMappings.findFirst({
		columns: {
			accountId: true,
		},
		where: and(
			eq(integrationAccountMappings.userId, userId),
			eq(integrationAccountMappings.sourceApp, integration.sourceApp),
			eq(integrationAccountMappings.profileKey, profileScope),
			eq(integrationAccountMappings.externalKey, integration.externalKey),
		),
	});

	return existing?.accountId ?? null;
}

export async function fetchAccountsForApi(
	userId: string,
	filters: AccountsApiListSearchParams,
): Promise<AccountsApiListResult> {
	const lookupAccountId = filters.integration
		? await findAccountIdByIntegration(userId, filters.integration)
		: null;

	if (filters.integration && !lookupAccountId) {
		return {
			items: [],
			pagination: {
				page: 1,
				pageSize: filters.pageSize,
				totalItems: 0,
				totalPages: 1,
			},
		};
	}

	const rows = await db.query.financialAccounts.findMany({
		where: and(
			eq(financialAccounts.userId, userId),
			filters.status ? eq(financialAccounts.status, filters.status) : undefined,
			filters.accountType
				? eq(financialAccounts.accountType, filters.accountType)
				: undefined,
			lookupAccountId ? eq(financialAccounts.id, lookupAccountId) : undefined,
		),
		orderBy: [asc(financialAccounts.name)],
	});

	const filtered = rows
		.map(mapAccountRowToAccount)
		.filter((account) => matchesSearch(account, filters.search));

	const totalItems = filtered.length;
	const totalPages = Math.max(Math.ceil(totalItems / filters.pageSize), 1);
	const page = Math.min(filters.page, totalPages);
	const start = (page - 1) * filters.pageSize;
	const itemsPage = filtered.slice(start, start + filters.pageSize);
	const integrationsMap = await fetchIntegrationMapForAccountIds(
		userId,
		itemsPage.map((item) => item.id),
	);

	return {
		items: itemsPage.map((item) => ({
			...item,
			integrations: integrationsMap.get(item.id) ?? [],
		})),
		pagination: {
			page,
			pageSize: filters.pageSize,
			totalItems,
			totalPages,
		},
	};
}

export async function createAccountForUser(
	userId: string,
	input: CreateAccountInput | AccountsApiCreateInput,
): Promise<string> {
	const logoFile = normalizeFilePath(input.logo);
	const normalizedInitialBalance = Math.abs(input.initialBalance);
	const hasInitialBalance = normalizedInitialBalance > 0;
	const adminPayerId = hasInitialBalance ? await getAdminPayerId(userId) : null;

	if (hasInitialBalance && !adminPayerId) {
		throw new Error(
			"Pessoa com papel administrador não encontrada. Crie uma pessoa admin antes de definir um saldo inicial.",
		);
	}

	let createdAccountId: string | null = null;

	await db.transaction(async (tx: typeof db) => {
		const [createdAccount] = await tx
			.insert(financialAccounts)
			.values({
				name: input.name,
				accountType: input.accountType,
				status: input.status,
				note: input.note ?? null,
				logo: logoFile,
				initialBalance: formatDecimalForDbRequired(input.initialBalance),
				excludeFromBalance: input.excludeFromBalance,
				excludeInitialBalanceFromIncome: input.excludeInitialBalanceFromIncome,
				userId,
			})
			.returning({ id: financialAccounts.id, name: financialAccounts.name });

		if (!createdAccount) {
			throw new Error("Não foi possível criar a conta.");
		}

		createdAccountId = createdAccount.id;

		if (!hasInitialBalance) {
			return;
		}

		const category = await tx.query.categories.findFirst({
			columns: { id: true },
			where: and(
				eq(categories.userId, userId),
				eq(categories.name, INITIAL_BALANCE_CATEGORY_NAME),
			),
		});

		if (!category) {
			throw new Error(
				'Category "Saldo inicial" não encontrada. Crie-a antes de definir um saldo inicial.',
			);
		}

		const { date, period } = getTodayInfo();

		await tx.insert(transactions).values({
			condition: INITIAL_BALANCE_CONDITION,
			name: `Saldo inicial - ${createdAccount.name}`,
			paymentMethod: INITIAL_BALANCE_PAYMENT_METHOD,
			note: INITIAL_BALANCE_NOTE,
			amount: formatDecimalForDbRequired(normalizedInitialBalance),
			purchaseDate: date,
			transactionType: INITIAL_BALANCE_TRANSACTION_TYPE,
			period,
			isSettled: true,
			userId,
			accountId: createdAccount.id,
			categoryId: category.id,
			payerId: adminPayerId,
		});
	});

	if (!createdAccountId) {
		throw new Error("Não foi possível criar a conta.");
	}

	return createdAccountId;
}

export async function updateAccountForUser(
	userId: string,
	accountId: string,
	input: CreateAccountInput | UpdateAccountInput | AccountsApiUpdateInput,
): Promise<boolean> {
	const existing = await fetchAccountRowForUser(userId, accountId);
	if (!existing) return false;

	const [updated] = await db
		.update(financialAccounts)
		.set({
			name: input.name,
			accountType: input.accountType,
			status: input.status,
			note: input.note ?? null,
			logo: normalizeFilePath(input.logo),
			initialBalance: formatDecimalForDbRequired(input.initialBalance),
			excludeFromBalance: input.excludeFromBalance,
			excludeInitialBalanceFromIncome: input.excludeInitialBalanceFromIncome,
		})
		.where(
			and(
				eq(financialAccounts.id, accountId),
				eq(financialAccounts.userId, userId),
			),
		)
		.returning({ id: financialAccounts.id });

	return Boolean(updated?.id);
}

async function saveAccountIntegrationBinding(
	userId: string,
	accountId: string,
	integration: AccountApiIntegrationInput,
) {
	await db
		.insert(integrationAccountMappings)
		.values({
			userId,
			sourceApp: integration.sourceApp,
			profileKey: integration.profileKey ?? "",
			externalKey: integration.externalKey,
			accountId,
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: [
				integrationAccountMappings.userId,
				integrationAccountMappings.sourceApp,
				integrationAccountMappings.profileKey,
				integrationAccountMappings.externalKey,
			],
			set: {
				accountId,
				updatedAt: new Date(),
			},
		});
}

export async function upsertAccountFromApi({
	userId,
	input,
}: {
	userId: string;
	input: AccountsApiCreateInput;
}): Promise<{ mode: "created" | "updated"; item: AccountApiItem }> {
	const integration = input.integration;

	if (integration) {
		const mappedAccountId = await findAccountIdByIntegration(
			userId,
			integration,
		);
		if (mappedAccountId) {
			const updated = await updateAccountForUser(
				userId,
				mappedAccountId,
				input,
			);
			if (!updated) {
				throw new Error("Não foi possível atualizar a conta integrada.");
			}

			await saveAccountIntegrationBinding(userId, mappedAccountId, integration);

			const item = await fetchAccountForApi(userId, mappedAccountId);
			if (!item) {
				throw new Error("Conta integrada não encontrada após atualização.");
			}

			return { mode: "updated", item };
		}
	}

	const createdId = await createAccountForUser(userId, input);
	if (integration) {
		await saveAccountIntegrationBinding(userId, createdId, integration);
	}

	const item = await fetchAccountForApi(userId, createdId);
	if (!item) {
		throw new Error("Conta não encontrada após criação.");
	}

	return { mode: "created", item };
}

export async function updateAccountFromApi({
	userId,
	accountId,
	input,
}: {
	userId: string;
	accountId: string;
	input: AccountsApiUpdateInput;
}): Promise<AccountApiItem | null> {
	const updated = await updateAccountForUser(userId, accountId, input);
	if (!updated) return null;

	if (input.integration) {
		await saveAccountIntegrationBinding(userId, accountId, input.integration);
	}

	return fetchAccountForApi(userId, accountId);
}
