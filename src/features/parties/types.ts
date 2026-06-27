import type { CategoryPartyKind } from "@/shared/lib/categories/party-kind";

export const PARTY_STATUS_OPTIONS = ["Ativo", "Inativo"] as const;
export const PARTY_KIND_OPTIONS = ["cliente", "fornecedor"] as const;

export type PartyStatus = (typeof PARTY_STATUS_OPTIONS)[number];
export type PartyKind = (typeof PARTY_KIND_OPTIONS)[number];

export type Party = {
	id: string;
	kind: PartyKind;
	name: string;
	document: string | null;
	email: string | null;
	phone: string | null;
	note: string | null;
	status: PartyStatus;
	createdAt: string;
};

export type PartyFormValues = {
	kind: CategoryPartyKind;
	name: string;
	document: string;
	email: string;
	phone: string;
	status: PartyStatus;
	note: string;
};
