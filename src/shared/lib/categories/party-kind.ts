export const CATEGORY_PARTY_KINDS = ["cliente", "fornecedor"] as const;

export type CategoryPartyKind = (typeof CATEGORY_PARTY_KINDS)[number];

type CategoryCandidate = {
	partyKind?: string | null;
};

type PartyCandidate = {
	kind?: string | null;
};

export const CATEGORY_PARTY_KIND_LABEL: Record<CategoryPartyKind, string> = {
	cliente: "Cliente",
	fornecedor: "Fornecedor",
};

export function normalizeCategoryPartyKind(
	value: string | null | undefined,
): CategoryPartyKind | null {
	const normalized = value?.trim().toLowerCase();

	return CATEGORY_PARTY_KINDS.find((kind) => kind === normalized) ?? null;
}

export function canCategoryLinkParty(
	category: CategoryCandidate | null | undefined,
	party: PartyCandidate | null | undefined,
) {
	const categoryKind = normalizeCategoryPartyKind(category?.partyKind);
	const partyKind = normalizeCategoryPartyKind(party?.kind);

	return Boolean(categoryKind && partyKind && categoryKind === partyKind);
}

export function getPartyFieldLabel(kind: CategoryPartyKind) {
	return CATEGORY_PARTY_KIND_LABEL[kind];
}
