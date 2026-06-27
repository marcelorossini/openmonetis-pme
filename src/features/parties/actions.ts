"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { parties } from "@/db/schema";
import {
	handleActionError,
	revalidateForEntity,
} from "@/shared/lib/actions/helpers";
import { getUser } from "@/shared/lib/auth/server";
import { CATEGORY_PARTY_KINDS } from "@/shared/lib/categories/party-kind";
import { db } from "@/shared/lib/db";
import { noteSchema, uuidSchema } from "@/shared/lib/schemas/common";
import type { ActionResult } from "@/shared/lib/types/actions";
import { PARTY_STATUS_OPTIONS } from "./types";

const statusEnum = z.enum(PARTY_STATUS_OPTIONS, {
	message: "Selecione um status válido.",
});

const kindEnum = z.enum(CATEGORY_PARTY_KINDS, {
	message: "Selecione um tipo válido.",
});

const optionalTextSchema = z
	.string()
	.trim()
	.max(255, "Informe até 255 caracteres.")
	.nullish()
	.transform((value) => value || null);

const baseSchema = z.object({
	kind: kindEnum,
	name: z
		.string({ message: "Informe o nome." })
		.trim()
		.min(1, "Informe o nome."),
	document: optionalTextSchema,
	email: optionalTextSchema,
	phone: optionalTextSchema,
	status: statusEnum,
	note: noteSchema,
});

const createSchema = baseSchema;
const updateSchema = baseSchema.extend({
	id: uuidSchema("Cliente/Fornecedor"),
});
const deleteSchema = z.object({
	id: uuidSchema("Cliente/Fornecedor"),
});

type CreateInput = z.infer<typeof createSchema>;
type UpdateInput = z.infer<typeof updateSchema>;
type DeleteInput = z.infer<typeof deleteSchema>;

const revalidate = (userId: string) => revalidateForEntity("parties", userId);

export async function createPartyAction(
	input: CreateInput,
): Promise<ActionResult<{ id: string }>> {
	try {
		const user = await getUser();
		const data = createSchema.parse(input);

		const [created] = await db
			.insert(parties)
			.values({
				kind: data.kind,
				name: data.name,
				document: data.document,
				email: data.email,
				phone: data.phone,
				status: data.status,
				note: data.note,
				userId: user.id,
			})
			.returning({ id: parties.id });

		revalidate(user.id);

		return {
			success: true,
			message: "Cadastro criado com sucesso.",
			data: created ? { id: created.id } : undefined,
		};
	} catch (error) {
		return handleActionError(error) as ActionResult<{ id: string }>;
	}
}

export async function updatePartyAction(
	input: UpdateInput,
): Promise<ActionResult> {
	try {
		const user = await getUser();
		const data = updateSchema.parse(input);

		const existing = await db.query.parties.findFirst({
			where: and(eq(parties.id, data.id), eq(parties.userId, user.id)),
		});

		if (!existing) {
			return { success: false, error: "Cadastro não encontrado." };
		}

		await db
			.update(parties)
			.set({
				kind: data.kind,
				name: data.name,
				document: data.document,
				email: data.email,
				phone: data.phone,
				status: data.status,
				note: data.note,
			})
			.where(and(eq(parties.id, data.id), eq(parties.userId, user.id)));

		revalidate(user.id);

		return { success: true, message: "Cadastro atualizado com sucesso." };
	} catch (error) {
		return handleActionError(error);
	}
}

export async function deletePartyAction(
	input: DeleteInput,
): Promise<ActionResult> {
	try {
		const user = await getUser();
		const data = deleteSchema.parse(input);

		const existing = await db.query.parties.findFirst({
			where: and(eq(parties.id, data.id), eq(parties.userId, user.id)),
		});

		if (!existing) {
			return { success: false, error: "Cadastro não encontrado." };
		}

		await db
			.delete(parties)
			.where(and(eq(parties.id, data.id), eq(parties.userId, user.id)));

		revalidate(user.id);

		return { success: true, message: "Cadastro removido com sucesso." };
	} catch (error) {
		return handleActionError(error);
	}
}
