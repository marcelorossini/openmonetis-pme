import { asc, eq } from "drizzle-orm";
import { parties } from "@/db/schema";
import { mapPartyRowToParty } from "@/features/parties/lib/service";
import { db } from "@/shared/lib/db";
import type { Party } from "./types";

export {
	fetchPartiesForApi,
	fetchPartyForApi,
} from "@/features/parties/lib/service";

export async function fetchPartiesForUser(userId: string): Promise<Party[]> {
	const rows = await db.query.parties.findMany({
		where: eq(parties.userId, userId),
		orderBy: [asc(parties.name)],
	});

	return rows.map(mapPartyRowToParty);
}
