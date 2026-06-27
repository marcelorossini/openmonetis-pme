import { and, asc, desc, eq } from "drizzle-orm";
import {
	apiTokens,
	categories,
	financialAccounts,
	inboxItems,
	integrationAccountMappings,
	integrationCategoryMappings,
	integrationPartyMappings,
	parties,
} from "@/db/schema";
import { db, schema } from "@/shared/lib/db";

interface UserPreferences {
	statementNoteAsColumn: boolean;
	transactionsColumnOrder: string[] | null;
	attachmentMaxSizeMb: number;
	showTransactionSummary: boolean;
}

interface ApiToken {
	id: string;
	name: string;
	tokenPrefix: string;
	lastUsedAt: Date | null;
	lastUsedIp: string | null;
	createdAt: Date;
	expiresAt: Date | null;
	revokedAt: Date | null;
}

export interface IntegrationPendingMappingItem {
	entityType: "account" | "party" | "category";
	sourceApp: string;
	sourceAppName: string | null;
	profileKey: string | null;
	externalKey: string;
	pendingCount: number;
	lastReceivedAt: Date;
}

export interface IntegrationSavedMappingItem {
	entityType: "account" | "party" | "category";
	sourceApp: string;
	profileKey: string | null;
	externalKey: string;
	targetId: string;
	targetLabel: string;
	targetMeta: string | null;
	updatedAt: Date;
}

export interface IntegrationTargetOption {
	value: string;
	label: string;
	meta: string | null;
}

async function fetchAuthProvider(userId: string): Promise<string> {
	const userAccount = await db.query.account.findFirst({
		where: eq(schema.account.userId, userId),
	});
	return userAccount?.providerId || "credential";
}

export async function fetchUserPreferences(
	userId: string,
): Promise<UserPreferences | null> {
	const result = await db
		.select({
			statementNoteAsColumn: schema.userPreferences.statementNoteAsColumn,
			transactionsColumnOrder: schema.userPreferences.transactionsColumnOrder,
			attachmentMaxSizeMb: schema.userPreferences.attachmentMaxSizeMb,
			showTransactionSummary: schema.userPreferences.showTransactionSummary,
		})
		.from(schema.userPreferences)
		.where(eq(schema.userPreferences.userId, userId))
		.limit(1);

	if (!result[0]) return null;

	return result[0];
}

async function fetchApiTokens(userId: string): Promise<ApiToken[]> {
	return db
		.select({
			id: apiTokens.id,
			name: apiTokens.name,
			tokenPrefix: apiTokens.tokenPrefix,
			lastUsedAt: apiTokens.lastUsedAt,
			lastUsedIp: apiTokens.lastUsedIp,
			createdAt: apiTokens.createdAt,
			expiresAt: apiTokens.expiresAt,
			revokedAt: apiTokens.revokedAt,
		})
		.from(apiTokens)
		.where(eq(apiTokens.userId, userId))
		.orderBy(desc(apiTokens.createdAt));
}

async function fetchIntegrationPendingMappings(
	userId: string,
): Promise<IntegrationPendingMappingItem[]> {
	const rows = await db
		.select({
			sourceApp: inboxItems.sourceApp,
			sourceAppName: inboxItems.sourceAppName,
			profileKey: inboxItems.profileKey,
			accountExternalKey: inboxItems.accountExternalKey,
			accountId: inboxItems.accountId,
			partyExternalKey: inboxItems.partyExternalKey,
			partyId: inboxItems.partyId,
			categoryExternalKey: inboxItems.categoryExternalKey,
			categoryId: inboxItems.categoryId,
			notificationTimestamp: inboxItems.notificationTimestamp,
		})
		.from(inboxItems)
		.where(
			and(eq(inboxItems.userId, userId), eq(inboxItems.status, "pending")),
		);

	const grouped = new Map<string, IntegrationPendingMappingItem>();

	for (const row of rows) {
		if (row.accountExternalKey && !row.accountId) {
			const key = [
				"account",
				row.sourceApp,
				row.profileKey ?? "",
				row.accountExternalKey,
			].join("::");
			const existing = grouped.get(key);

			if (existing) {
				existing.pendingCount += 1;
				if (row.notificationTimestamp > existing.lastReceivedAt) {
					existing.lastReceivedAt = row.notificationTimestamp;
				}
			} else {
				grouped.set(key, {
					entityType: "account",
					sourceApp: row.sourceApp,
					sourceAppName: row.sourceAppName,
					profileKey: row.profileKey,
					externalKey: row.accountExternalKey,
					pendingCount: 1,
					lastReceivedAt: row.notificationTimestamp,
				});
			}
		}

		if (row.partyExternalKey && !row.partyId) {
			const key = [
				"party",
				row.sourceApp,
				row.profileKey ?? "",
				row.partyExternalKey,
			].join("::");
			const existing = grouped.get(key);

			if (existing) {
				existing.pendingCount += 1;
				if (row.notificationTimestamp > existing.lastReceivedAt) {
					existing.lastReceivedAt = row.notificationTimestamp;
				}
			} else {
				grouped.set(key, {
					entityType: "party",
					sourceApp: row.sourceApp,
					sourceAppName: row.sourceAppName,
					profileKey: row.profileKey,
					externalKey: row.partyExternalKey,
					pendingCount: 1,
					lastReceivedAt: row.notificationTimestamp,
				});
			}
		}

		if (row.categoryExternalKey && !row.categoryId) {
			const key = [
				"category",
				row.sourceApp,
				row.profileKey ?? "",
				row.categoryExternalKey,
			].join("::");
			const existing = grouped.get(key);

			if (existing) {
				existing.pendingCount += 1;
				if (row.notificationTimestamp > existing.lastReceivedAt) {
					existing.lastReceivedAt = row.notificationTimestamp;
				}
			} else {
				grouped.set(key, {
					entityType: "category",
					sourceApp: row.sourceApp,
					sourceAppName: row.sourceAppName,
					profileKey: row.profileKey,
					externalKey: row.categoryExternalKey,
					pendingCount: 1,
					lastReceivedAt: row.notificationTimestamp,
				});
			}
		}
	}

	return [...grouped.values()].sort((a, b) => {
		return b.lastReceivedAt.getTime() - a.lastReceivedAt.getTime();
	});
}

async function fetchIntegrationSavedMappings(
	userId: string,
): Promise<IntegrationSavedMappingItem[]> {
	const [accountMappings, partyMappings, categoryMappings] = await Promise.all([
		db
			.select({
				sourceApp: integrationAccountMappings.sourceApp,
				profileKey: integrationAccountMappings.profileKey,
				externalKey: integrationAccountMappings.externalKey,
				targetId: integrationAccountMappings.accountId,
				targetLabel: financialAccounts.name,
				targetMeta: financialAccounts.accountType,
				updatedAt: integrationAccountMappings.updatedAt,
			})
			.from(integrationAccountMappings)
			.innerJoin(
				financialAccounts,
				eq(financialAccounts.id, integrationAccountMappings.accountId),
			)
			.where(eq(integrationAccountMappings.userId, userId))
			.orderBy(
				asc(integrationAccountMappings.sourceApp),
				asc(integrationAccountMappings.externalKey),
			),
		db
			.select({
				sourceApp: integrationPartyMappings.sourceApp,
				profileKey: integrationPartyMappings.profileKey,
				externalKey: integrationPartyMappings.externalKey,
				targetId: integrationPartyMappings.partyId,
				targetLabel: parties.name,
				targetMeta: parties.kind,
				updatedAt: integrationPartyMappings.updatedAt,
			})
			.from(integrationPartyMappings)
			.innerJoin(parties, eq(parties.id, integrationPartyMappings.partyId))
			.where(eq(integrationPartyMappings.userId, userId))
			.orderBy(
				asc(integrationPartyMappings.sourceApp),
				asc(integrationPartyMappings.externalKey),
			),
		db
			.select({
				sourceApp: integrationCategoryMappings.sourceApp,
				profileKey: integrationCategoryMappings.profileKey,
				externalKey: integrationCategoryMappings.externalKey,
				targetId: integrationCategoryMappings.categoryId,
				targetLabel: categories.name,
				targetMeta: categories.type,
				updatedAt: integrationCategoryMappings.updatedAt,
			})
			.from(integrationCategoryMappings)
			.innerJoin(
				categories,
				eq(categories.id, integrationCategoryMappings.categoryId),
			)
			.where(eq(integrationCategoryMappings.userId, userId))
			.orderBy(
				asc(integrationCategoryMappings.sourceApp),
				asc(integrationCategoryMappings.externalKey),
			),
	]);

	return [
		...accountMappings.map((item) => ({
			...item,
			entityType: "account" as const,
			profileKey: item.profileKey || null,
		})),
		...partyMappings.map((item) => ({
			...item,
			entityType: "party" as const,
			profileKey: item.profileKey || null,
		})),
		...categoryMappings.map((item) => ({
			...item,
			entityType: "category" as const,
			profileKey: item.profileKey || null,
		})),
	].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

async function fetchIntegrationTargetOptions(userId: string): Promise<{
	accountOptions: IntegrationTargetOption[];
	partyOptions: IntegrationTargetOption[];
	categoryOptions: IntegrationTargetOption[];
}> {
	const [accountRows, partyRows, categoryRows] = await Promise.all([
		db
			.select({
				value: financialAccounts.id,
				label: financialAccounts.name,
				meta: financialAccounts.accountType,
			})
			.from(financialAccounts)
			.where(eq(financialAccounts.userId, userId))
			.orderBy(asc(financialAccounts.name)),
		db
			.select({
				value: parties.id,
				label: parties.name,
				meta: parties.kind,
			})
			.from(parties)
			.where(eq(parties.userId, userId))
			.orderBy(asc(parties.name)),
		db
			.select({
				value: categories.id,
				label: categories.name,
				meta: categories.type,
			})
			.from(categories)
			.where(eq(categories.userId, userId))
			.orderBy(asc(categories.name)),
	]);

	return {
		accountOptions: accountRows,
		partyOptions: partyRows,
		categoryOptions: categoryRows,
	};
}

export async function fetchSettingsPageData(userId: string) {
	const [
		authProvider,
		userPreferences,
		userApiTokens,
		integrationPendingMappings,
		integrationSavedMappings,
		integrationTargetOptions,
	] = await Promise.all([
		fetchAuthProvider(userId),
		fetchUserPreferences(userId),
		fetchApiTokens(userId),
		fetchIntegrationPendingMappings(userId),
		fetchIntegrationSavedMappings(userId),
		fetchIntegrationTargetOptions(userId),
	]);

	return {
		authProvider,
		userPreferences,
		userApiTokens,
		integrationPendingMappings,
		integrationSavedMappings,
		integrationTargetOptions,
	};
}
