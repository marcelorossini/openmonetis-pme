import { asc, eq } from "drizzle-orm";
import { clients } from "@/db/schema";
import { db } from "@/shared/lib/db";
import { CLIENT_STATUS_OPTIONS, type Client, type ClientStatus } from "./types";

const resolveStatus = (status: string | null): ClientStatus => {
	const normalized = status?.trim() ?? "";
	const found = CLIENT_STATUS_OPTIONS.find(
		(option) => option.toLowerCase() === normalized.toLowerCase(),
	);
	return found ?? CLIENT_STATUS_OPTIONS[0];
};

export async function fetchClientsForUser(userId: string): Promise<Client[]> {
	const rows = await db.query.clients.findMany({
		where: eq(clients.userId, userId),
		orderBy: [asc(clients.name)],
	});

	return rows.map((client) => ({
		id: client.id,
		name: client.name,
		note: client.note,
		status: resolveStatus(client.status),
		createdAt: client.createdAt.toISOString(),
	}));
}
