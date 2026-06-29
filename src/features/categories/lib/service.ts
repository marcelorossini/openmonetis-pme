import { and, asc, eq, inArray } from "drizzle-orm";
import { categories, integrationCategoryMappings } from "@/db/schema";
import {
	type CategoryType,
	isProtectedCategoryName,
} from "@/shared/lib/categories/constants";
import {
	type CategoryPartyKind,
	normalizeCategoryPartyKind,
} from "@/shared/lib/categories/party-kind";
import { db } from "@/shared/lib/db";
import { normalizeOptionalText } from "@/shared/lib/inbox-integrations/mapping";
import type {
	CategoriesApiCreateInput,
	CategoriesApiListSearchParams,
	CategoriesApiUpdateInput,
	CategoryApiIntegrationInput,
} from "./api-contract";
import type { CreateCategoryInput, UpdateCategoryInput } from "./schemas";

export class CategoryServiceError extends Error {
	constructor(
		message: string,
		public readonly status = 400,
	) {
		super(message);
		this.name = "CategoryServiceError";
	}
}

export type CategoryRecord = {
	id: string;
	name: string;
	type: CategoryType;
	icon: string | null;
	partyKind: CategoryPartyKind | null;
	createdAt: string;
};

export type CategoryIntegrationBinding = {
	sourceApp: string;
	profileKey: string | null;
	externalKey: string;
	createdAt: string;
	updatedAt: string;
};

export type CategoryApiItem = CategoryRecord & {
	integrations: CategoryIntegrationBinding[];
};

export type CategoriesApiListResult = {
	items: CategoryApiItem[];
	pagination: {
		page: number;
		pageSize: number;
		totalItems: number;
		totalPages: number;
	};
};

function mapIntegrationRow(
	row: typeof integrationCategoryMappings.$inferSelect,
): CategoryIntegrationBinding {
	return {
		sourceApp: row.sourceApp,
		profileKey: normalizeOptionalText(row.profileKey),
		externalKey: row.externalKey,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

export function mapCategoryRowToCategory(
	category: typeof categories.$inferSelect,
): CategoryRecord {
	return {
		id: category.id,
		name: category.name,
		type: category.type as CategoryType,
		icon: category.icon,
		partyKind: normalizeCategoryPartyKind(category.partyKind),
		createdAt: category.createdAt.toISOString(),
	};
}

function matchesSearch(category: CategoryRecord, search: string | null) {
	if (!search) return true;
	const needle = search.trim().toLowerCase();
	if (!needle) return true;

	return [category.name, category.icon, category.partyKind]
		.filter(Boolean)
		.some((value) => value?.toLowerCase().includes(needle));
}

async function fetchIntegrationMapForCategoryIds(
	userId: string,
	categoryIds: string[],
): Promise<Map<string, CategoryIntegrationBinding[]>> {
	if (categoryIds.length === 0) {
		return new Map();
	}

	const rows = await db.query.integrationCategoryMappings.findMany({
		where: and(
			eq(integrationCategoryMappings.userId, userId),
			inArray(integrationCategoryMappings.categoryId, categoryIds),
		),
		orderBy: [
			asc(integrationCategoryMappings.sourceApp),
			asc(integrationCategoryMappings.externalKey),
		],
	});

	const grouped = new Map<string, CategoryIntegrationBinding[]>();

	for (const row of rows) {
		const current = grouped.get(row.categoryId) ?? [];
		current.push(mapIntegrationRow(row));
		grouped.set(row.categoryId, current);
	}

	return grouped;
}

async function fetchCategoryRowForUser(userId: string, categoryId: string) {
	return db.query.categories.findFirst({
		where: and(eq(categories.id, categoryId), eq(categories.userId, userId)),
	});
}

function assertCategoryCanBeEdited(category: typeof categories.$inferSelect) {
	if (isProtectedCategoryName(category.name)) {
		throw new CategoryServiceError(
			`A categoria '${category.name}' é protegida e não pode ser editada.`,
		);
	}
}

function assertCategoryCanBeDeleted(category: typeof categories.$inferSelect) {
	if (isProtectedCategoryName(category.name)) {
		throw new CategoryServiceError(
			`A categoria '${category.name}' é protegida e não pode ser removida.`,
		);
	}
}

export async function fetchCategoryForApi(
	userId: string,
	categoryId: string,
): Promise<CategoryApiItem | null> {
	const row = await fetchCategoryRowForUser(userId, categoryId);
	if (!row) return null;

	const integrationsMap = await fetchIntegrationMapForCategoryIds(userId, [
		categoryId,
	]);

	return {
		...mapCategoryRowToCategory(row),
		integrations: integrationsMap.get(categoryId) ?? [],
	};
}

export async function findCategoryIdByIntegration(
	userId: string,
	integration: CategoryApiIntegrationInput,
): Promise<string | null> {
	const profileScope = integration.profileKey ?? "";
	const existing = await db.query.integrationCategoryMappings.findFirst({
		columns: {
			categoryId: true,
		},
		where: and(
			eq(integrationCategoryMappings.userId, userId),
			eq(integrationCategoryMappings.sourceApp, integration.sourceApp),
			eq(integrationCategoryMappings.profileKey, profileScope),
			eq(integrationCategoryMappings.externalKey, integration.externalKey),
		),
	});

	return existing?.categoryId ?? null;
}

export async function fetchCategoriesForApi(
	userId: string,
	filters: CategoriesApiListSearchParams,
): Promise<CategoriesApiListResult> {
	const lookupCategoryId = filters.integration
		? await findCategoryIdByIntegration(userId, filters.integration)
		: null;

	if (filters.integration && !lookupCategoryId) {
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

	const rows = await db.query.categories.findMany({
		where: and(
			eq(categories.userId, userId),
			filters.type ? eq(categories.type, filters.type) : undefined,
			filters.partyKind
				? eq(categories.partyKind, filters.partyKind)
				: undefined,
			lookupCategoryId ? eq(categories.id, lookupCategoryId) : undefined,
		),
		orderBy: [asc(categories.name)],
	});

	const filtered = rows
		.map(mapCategoryRowToCategory)
		.filter((category) => matchesSearch(category, filters.search));

	const totalItems = filtered.length;
	const totalPages = Math.max(Math.ceil(totalItems / filters.pageSize), 1);
	const page = Math.min(filters.page, totalPages);
	const start = (page - 1) * filters.pageSize;
	const itemsPage = filtered.slice(start, start + filters.pageSize);
	const integrationsMap = await fetchIntegrationMapForCategoryIds(
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

export async function createCategoryForUser(
	userId: string,
	input: CreateCategoryInput,
): Promise<string> {
	const [created] = await db
		.insert(categories)
		.values({
			name: input.name,
			type: input.type,
			icon: input.icon,
			partyKind: input.partyKind,
			userId,
		})
		.returning({ id: categories.id });

	if (!created?.id) {
		throw new Error("Não foi possível criar a categoria.");
	}

	return created.id;
}

export async function updateCategoryForUser(
	userId: string,
	categoryId: string,
	input: UpdateCategoryInput | CategoriesApiUpdateInput,
): Promise<boolean> {
	const existing = await fetchCategoryRowForUser(userId, categoryId);
	if (!existing) return false;

	assertCategoryCanBeEdited(existing);

	const [updated] = await db
		.update(categories)
		.set({
			name: input.name,
			type: input.type,
			icon: input.icon,
			partyKind: input.partyKind,
		})
		.where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
		.returning({ id: categories.id });

	return Boolean(updated?.id);
}

async function saveCategoryIntegrationBinding(
	userId: string,
	categoryId: string,
	integration: CategoryApiIntegrationInput,
) {
	await db
		.insert(integrationCategoryMappings)
		.values({
			userId,
			sourceApp: integration.sourceApp,
			profileKey: integration.profileKey ?? "",
			externalKey: integration.externalKey,
			categoryId,
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: [
				integrationCategoryMappings.userId,
				integrationCategoryMappings.sourceApp,
				integrationCategoryMappings.profileKey,
				integrationCategoryMappings.externalKey,
			],
			set: {
				categoryId,
				updatedAt: new Date(),
			},
		});
}

export async function upsertCategoryFromApi({
	userId,
	input,
}: {
	userId: string;
	input: CategoriesApiCreateInput;
}): Promise<{ mode: "created" | "updated"; item: CategoryApiItem }> {
	const integration = input.integration;

	if (integration) {
		const mappedCategoryId = await findCategoryIdByIntegration(
			userId,
			integration,
		);
		if (mappedCategoryId) {
			const updated = await updateCategoryForUser(
				userId,
				mappedCategoryId,
				input,
			);
			if (!updated) {
				throw new Error("Não foi possível atualizar a categoria integrada.");
			}

			await saveCategoryIntegrationBinding(
				userId,
				mappedCategoryId,
				integration,
			);

			const item = await fetchCategoryForApi(userId, mappedCategoryId);
			if (!item) {
				throw new Error("Categoria integrada não encontrada após atualização.");
			}

			return { mode: "updated", item };
		}
	}

	const createdId = await createCategoryForUser(userId, input);
	if (integration) {
		await saveCategoryIntegrationBinding(userId, createdId, integration);
	}

	const item = await fetchCategoryForApi(userId, createdId);
	if (!item) {
		throw new Error("Categoria não encontrada após criação.");
	}

	return { mode: "created", item };
}

export async function updateCategoryFromApi({
	userId,
	categoryId,
	input,
}: {
	userId: string;
	categoryId: string;
	input: CategoriesApiUpdateInput;
}): Promise<CategoryApiItem | null> {
	const updated = await updateCategoryForUser(userId, categoryId, input);
	if (!updated) return null;

	if (input.integration) {
		await saveCategoryIntegrationBinding(userId, categoryId, input.integration);
	}

	return fetchCategoryForApi(userId, categoryId);
}

export async function deleteCategoryFromApi(
	userId: string,
	categoryId: string,
): Promise<CategoryApiItem | null> {
	const existing = await fetchCategoryForApi(userId, categoryId);
	if (!existing) return null;

	const row = await fetchCategoryRowForUser(userId, categoryId);
	if (!row) return null;

	assertCategoryCanBeDeleted(row);

	const [deleted] = await db
		.delete(categories)
		.where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
		.returning({ id: categories.id });

	return deleted?.id ? existing : null;
}
