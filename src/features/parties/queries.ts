import { asc, eq } from "drizzle-orm";
import { parties } from "@/db/schema";
import { db } from "@/shared/lib/db";
import {
	PARTY_KIND_OPTIONS,
	PARTY_STATUS_OPTIONS,
	type Party,
	type PartyKind,
	type PartyStatus,
} from "./types";

const resolveStatus = (status: string | null): PartyStatus => {
	const normalized = status?.trim() ?? "";
	const found = PARTY_STATUS_OPTIONS.find(
		(option) => option.toLowerCase() === normalized.toLowerCase(),
	);
	return found ?? PARTY_STATUS_OPTIONS[0];
};

const resolveKind = (kind: string | null): PartyKind => {
	const normalized = kind?.trim().toLowerCase() ?? "";
	return (
		PARTY_KIND_OPTIONS.find((option) => option === normalized) ?? "cliente"
	);
};

export async function fetchPartiesForUser(userId: string): Promise<Party[]> {
	const rows = await db.query.parties.findMany({
		where: eq(parties.userId, userId),
		orderBy: [asc(parties.name)],
	});

	return rows.map((party) => ({
		id: party.id,
		kind: resolveKind(party.kind),
		name: party.name,
		document: party.document,
		email: party.email,
		phone: party.phone,
		note: party.note,
		status: resolveStatus(party.status),
		createdAt: party.createdAt.toISOString(),
	}));
}
