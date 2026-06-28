import { and, asc, eq, inArray } from "drizzle-orm";
import { integrationPartyMappings, parties } from "@/db/schema";
import { db } from "@/shared/lib/db";
import { normalizeOptionalText } from "@/shared/lib/inbox-integrations/mapping";
import type { Party, PartyKind, PartyStatus } from "../types";
import type {
	PartiesApiCreateInput,
	PartiesApiListSearchParams,
	PartiesApiUpdateInput,
	PartyApiIntegrationInput,
} from "./api-contract";
import type { CreatePartyInput, UpdatePartyInput } from "./schemas";

export type PartyIntegrationBinding = {
	sourceApp: string;
	profileKey: string | null;
	externalKey: string;
	createdAt: string;
	updatedAt: string;
};

export type PartyApiItem = Party & {
	integrations: PartyIntegrationBinding[];
};

export type PartiesApiListResult = {
	items: PartyApiItem[];
	pagination: {
		page: number;
		pageSize: number;
		totalItems: number;
		totalPages: number;
	};
};

const resolveStatus = (status: string | null): PartyStatus => {
	const normalized = status?.trim() ?? "";
	return normalized.toLowerCase() === "inativo" ? "Inativo" : "Ativo";
};

const resolveKind = (kind: string | null): PartyKind => {
	const normalized = kind?.trim().toLowerCase() ?? "";
	return normalized === "fornecedor" ? "fornecedor" : "cliente";
};

export function mapPartyRowToParty(party: typeof parties.$inferSelect): Party {
	return {
		id: party.id,
		kind: resolveKind(party.kind),
		name: party.name,
		document: party.document,
		email: party.email,
		phone: party.phone,
		note: party.note,
		status: resolveStatus(party.status),
		createdAt: party.createdAt.toISOString(),
	};
}

function mapIntegrationRow(
	row: typeof integrationPartyMappings.$inferSelect,
): PartyIntegrationBinding {
	return {
		sourceApp: row.sourceApp,
		profileKey: normalizeOptionalText(row.profileKey),
		externalKey: row.externalKey,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function matchesSearch(party: Party, search: string | null) {
	if (!search) return true;
	const needle = search.trim().toLowerCase();
	if (!needle) return true;

	return [party.name, party.document, party.email, party.phone, party.note]
		.filter(Boolean)
		.some((value) => value?.toLowerCase().includes(needle));
}

async function fetchIntegrationMapForPartyIds(
	userId: string,
	partyIds: string[],
): Promise<Map<string, PartyIntegrationBinding[]>> {
	if (partyIds.length === 0) {
		return new Map();
	}

	const rows = await db.query.integrationPartyMappings.findMany({
		where: and(
			eq(integrationPartyMappings.userId, userId),
			inArray(integrationPartyMappings.partyId, partyIds),
		),
		orderBy: [
			asc(integrationPartyMappings.sourceApp),
			asc(integrationPartyMappings.externalKey),
		],
	});

	const grouped = new Map<string, PartyIntegrationBinding[]>();

	for (const row of rows) {
		const current = grouped.get(row.partyId) ?? [];
		current.push(mapIntegrationRow(row));
		grouped.set(row.partyId, current);
	}

	return grouped;
}

async function fetchPartyRowForUser(userId: string, partyId: string) {
	return db.query.parties.findFirst({
		where: and(eq(parties.id, partyId), eq(parties.userId, userId)),
	});
}

export async function fetchPartyForApi(
	userId: string,
	partyId: string,
): Promise<PartyApiItem | null> {
	const row = await fetchPartyRowForUser(userId, partyId);
	if (!row) return null;

	const integrationsMap = await fetchIntegrationMapForPartyIds(userId, [
		partyId,
	]);
	return {
		...mapPartyRowToParty(row),
		integrations: integrationsMap.get(partyId) ?? [],
	};
}

export async function findPartyIdByIntegration(
	userId: string,
	integration: PartyApiIntegrationInput,
): Promise<string | null> {
	const profileScope = integration.profileKey ?? "";
	const existing = await db.query.integrationPartyMappings.findFirst({
		columns: {
			partyId: true,
		},
		where: and(
			eq(integrationPartyMappings.userId, userId),
			eq(integrationPartyMappings.sourceApp, integration.sourceApp),
			eq(integrationPartyMappings.profileKey, profileScope),
			eq(integrationPartyMappings.externalKey, integration.externalKey),
		),
	});

	return existing?.partyId ?? null;
}

export async function fetchPartiesForApi(
	userId: string,
	filters: PartiesApiListSearchParams,
): Promise<PartiesApiListResult> {
	const lookupPartyId = filters.integration
		? await findPartyIdByIntegration(userId, filters.integration)
		: null;

	if (filters.integration && !lookupPartyId) {
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

	const rows = await db.query.parties.findMany({
		where: and(
			eq(parties.userId, userId),
			filters.kind ? eq(parties.kind, filters.kind) : undefined,
			filters.status ? eq(parties.status, filters.status) : undefined,
			lookupPartyId ? eq(parties.id, lookupPartyId) : undefined,
		),
		orderBy: [asc(parties.name)],
	});

	const filtered = rows
		.map(mapPartyRowToParty)
		.filter((party) => matchesSearch(party, filters.search));

	const totalItems = filtered.length;
	const totalPages = Math.max(Math.ceil(totalItems / filters.pageSize), 1);
	const page = Math.min(filters.page, totalPages);
	const start = (page - 1) * filters.pageSize;
	const itemsPage = filtered.slice(start, start + filters.pageSize);
	const integrationsMap = await fetchIntegrationMapForPartyIds(
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

export async function createPartyForUser(
	userId: string,
	input: CreatePartyInput,
): Promise<string> {
	const [created] = await db
		.insert(parties)
		.values({
			kind: input.kind,
			name: input.name,
			document: input.document,
			email: input.email,
			phone: input.phone,
			status: input.status,
			note: input.note,
			userId,
		})
		.returning({ id: parties.id });

	if (!created?.id) {
		throw new Error("Não foi possível criar o cadastro.");
	}

	return created.id;
}

export async function updatePartyForUser(
	userId: string,
	partyId: string,
	input: UpdatePartyInput | PartiesApiUpdateInput,
): Promise<boolean> {
	const [updated] = await db
		.update(parties)
		.set({
			kind: input.kind,
			name: input.name,
			document: input.document,
			email: input.email,
			phone: input.phone,
			status: input.status,
			note: input.note,
		})
		.where(and(eq(parties.id, partyId), eq(parties.userId, userId)))
		.returning({ id: parties.id });

	return Boolean(updated?.id);
}

async function savePartyIntegrationBinding(
	userId: string,
	partyId: string,
	integration: PartyApiIntegrationInput,
) {
	await db
		.insert(integrationPartyMappings)
		.values({
			userId,
			sourceApp: integration.sourceApp,
			profileKey: integration.profileKey ?? "",
			externalKey: integration.externalKey,
			partyId,
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: [
				integrationPartyMappings.userId,
				integrationPartyMappings.sourceApp,
				integrationPartyMappings.profileKey,
				integrationPartyMappings.externalKey,
			],
			set: {
				partyId,
				updatedAt: new Date(),
			},
		});
}

export async function upsertPartyFromApi({
	userId,
	input,
}: {
	userId: string;
	input: PartiesApiCreateInput;
}): Promise<{ mode: "created" | "updated"; item: PartyApiItem }> {
	const integration = input.integration;

	if (integration) {
		const mappedPartyId = await findPartyIdByIntegration(userId, integration);
		if (mappedPartyId) {
			const updated = await updatePartyForUser(userId, mappedPartyId, input);
			if (!updated) {
				throw new Error("Não foi possível atualizar o cadastro integrado.");
			}

			await savePartyIntegrationBinding(userId, mappedPartyId, integration);

			const item = await fetchPartyForApi(userId, mappedPartyId);
			if (!item) {
				throw new Error("Cadastro integrado não encontrado após atualização.");
			}

			return { mode: "updated", item };
		}
	}

	const createdId = await createPartyForUser(userId, input);
	if (integration) {
		await savePartyIntegrationBinding(userId, createdId, integration);
	}

	const item = await fetchPartyForApi(userId, createdId);
	if (!item) {
		throw new Error("Cadastro não encontrado após criação.");
	}

	return { mode: "created", item };
}

export async function updatePartyFromApi({
	userId,
	partyId,
	input,
}: {
	userId: string;
	partyId: string;
	input: PartiesApiUpdateInput;
}): Promise<PartyApiItem | null> {
	const updated = await updatePartyForUser(userId, partyId, input);
	if (!updated) return null;

	if (input.integration) {
		await savePartyIntegrationBinding(userId, partyId, input.integration);
	}

	return fetchPartyForApi(userId, partyId);
}

export async function inactivatePartyForUser(
	userId: string,
	partyId: string,
): Promise<PartyApiItem | null> {
	const existing = await fetchPartyRowForUser(userId, partyId);
	if (!existing) return null;

	const updated = await updatePartyForUser(userId, partyId, {
		...mapPartyRowToParty(existing),
		status: "Inativo",
	});

	if (!updated) return null;
	return fetchPartyForApi(userId, partyId);
}
