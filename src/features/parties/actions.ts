"use server";

import { and, eq } from "drizzle-orm";
import { parties } from "@/db/schema";
import {
	type CreatePartyInput,
	createPartyInputSchema,
	type DeletePartyInput,
	deletePartyInputSchema,
	type UpdatePartyInput,
	updatePartyInputSchema,
} from "@/features/parties/lib/schemas";
import {
	createPartyForUser,
	inactivatePartyForUser as inactivatePartyForUserService,
	updatePartyForUser,
	updatePartyFromApi as updatePartyFromApiService,
	upsertPartyFromApi as upsertPartyFromApiService,
} from "@/features/parties/lib/service";
import {
	handleActionError,
	revalidateForEntity,
} from "@/shared/lib/actions/helpers";
import { getUser } from "@/shared/lib/auth/server";
import { db } from "@/shared/lib/db";
import type { ActionResult } from "@/shared/lib/types/actions";

const revalidate = (userId: string) => revalidateForEntity("parties", userId);

export async function createPartyAction(
	input: CreatePartyInput,
): Promise<ActionResult<{ id: string }>> {
	try {
		const user = await getUser();
		const data = createPartyInputSchema.parse(input);
		const createdId = await createPartyForUser(user.id, data);

		revalidate(user.id);

		return {
			success: true,
			message: "Cadastro criado com sucesso.",
			data: { id: createdId },
		};
	} catch (error) {
		return handleActionError(error) as ActionResult<{ id: string }>;
	}
}

export async function updatePartyAction(
	input: UpdatePartyInput,
): Promise<ActionResult> {
	try {
		const user = await getUser();
		const data = updatePartyInputSchema.parse(input);

		const existing = await db.query.parties.findFirst({
			where: and(eq(parties.id, data.id), eq(parties.userId, user.id)),
		});

		if (!existing) {
			return { success: false, error: "Cadastro não encontrado." };
		}

		await updatePartyForUser(user.id, data.id, data);

		revalidate(user.id);

		return { success: true, message: "Cadastro atualizado com sucesso." };
	} catch (error) {
		return handleActionError(error);
	}
}

export async function deletePartyAction(
	input: DeletePartyInput,
): Promise<ActionResult> {
	try {
		const user = await getUser();
		const data = deletePartyInputSchema.parse(input);

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

export async function upsertPartyFromApi({
	userId,
	input,
}: Parameters<typeof upsertPartyFromApiService>[0]) {
	return upsertPartyFromApiService({ userId, input });
}

export async function updatePartyFromApi({
	userId,
	partyId,
	input,
}: Parameters<typeof updatePartyFromApiService>[0]) {
	return updatePartyFromApiService({ userId, partyId, input });
}

export async function inactivatePartyForUser(userId: string, partyId: string) {
	return inactivatePartyForUserService(userId, partyId);
}
