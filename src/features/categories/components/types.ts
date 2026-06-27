import type { CategoryType } from "@/shared/lib/categories/constants";
import type { CategoryPartyKind } from "@/shared/lib/categories/party-kind";

export type Category = {
	id: string;
	name: string;
	type: CategoryType;
	icon: string | null;
	partyKind: CategoryPartyKind | null;
};

export type CategoryFormValues = {
	name: string;
	type: CategoryType;
	icon: string;
	partyKind: CategoryPartyKind | null;
};
