"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { clients } from "@/db/schema";
import {
	handleActionError,
	revalidateForEntity,
} from "@/shared/lib/actions/helpers";
import { getUser } from "@/shared/lib/auth/server";
import { db } from "@/shared/lib/db";
import { noteSchema, uuidSchema } from "@/shared/lib/schemas/common";
import type { ActionResult } from "@/shared/lib/types/actions";
import { CLIENT_STATUS_OPTIONS } from "./types";

const statusEnum = z.enum(CLIENT_STATUS_OPTIONS, {
	message: "Selecione um status válido.",
});

const baseSchema = z.object({
	name: z
		.string({ message: "Informe o nome do cliente." })
		.trim()
		.min(1, "Informe o nome do cliente."),
	status: statusEnum,
	note: noteSchema,
});

const createSchema = baseSchema;
const updateSchema = baseSchema.extend({
	id: uuidSchema("Cliente"),
});
const deleteSchema = z.object({
	id: uuidSchema("Cliente"),
});

type CreateInput = z.infer<typeof createSchema>;
type UpdateInput = z.infer<typeof updateSchema>;
type DeleteInput = z.infer<typeof deleteSchema>;

const revalidate = (userId: string) => revalidateForEntity("clients", userId);

export async function createClientAction(
	input: CreateInput,
): Promise<ActionResult> {
	try {
		const user = await getUser();
		const data = createSchema.parse(input);

		await db.insert(clients).values({
			name: data.name,
			status: data.status,
			note: data.note,
			userId: user.id,
		});

		revalidate(user.id);

		return { success: true, message: "Cliente criado com sucesso." };
	} catch (error) {
		return handleActionError(error);
	}
}

export async function updateClientAction(
	input: UpdateInput,
): Promise<ActionResult> {
	try {
		const user = await getUser();
		const data = updateSchema.parse(input);

		const existing = await db.query.clients.findFirst({
			where: and(eq(clients.id, data.id), eq(clients.userId, user.id)),
		});

		if (!existing) {
			return { success: false, error: "Cliente não encontrado." };
		}

		await db
			.update(clients)
			.set({
				name: data.name,
				status: data.status,
				note: data.note,
			})
			.where(and(eq(clients.id, data.id), eq(clients.userId, user.id)));

		revalidate(user.id);

		return { success: true, message: "Cliente atualizado com sucesso." };
	} catch (error) {
		return handleActionError(error);
	}
}

export async function deleteClientAction(
	input: DeleteInput,
): Promise<ActionResult> {
	try {
		const user = await getUser();
		const data = deleteSchema.parse(input);

		const existing = await db.query.clients.findFirst({
			where: and(eq(clients.id, data.id), eq(clients.userId, user.id)),
		});

		if (!existing) {
			return { success: false, error: "Cliente não encontrado." };
		}

		await db
			.delete(clients)
			.where(and(eq(clients.id, data.id), eq(clients.userId, user.id)));

		revalidate(user.id);

		return { success: true, message: "Cliente removido com sucesso." };
	} catch (error) {
		return handleActionError(error);
	}
}
