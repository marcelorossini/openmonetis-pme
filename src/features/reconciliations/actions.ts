"use server";

import { z } from "zod";
import { revalidateForEntity } from "@/shared/lib/actions/helpers";
import { getUser } from "@/shared/lib/auth/server";
import {
	dismissInboxItemReconciliation,
	reconcileInboxItemWithTitle,
} from "@/shared/lib/reconciliations/service";

const reconcileSchema = z.object({
	inboxItemId: z.string().uuid("ID do pré-lançamento inválido."),
	titleId: z.string().uuid("ID do título inválido."),
});

const dismissSchema = z.object({
	inboxItemId: z.string().uuid("ID do pré-lançamento inválido."),
});

function revalidateReconciliationRelatedEntities(userId: string) {
	revalidateForEntity("inbox", userId);
	revalidateForEntity("transactions", userId);
	revalidateForEntity("financialTitles", userId);
	revalidateForEntity("reconciliations", userId);
}

export async function reconcileInboxItemAction(formData: FormData) {
	const user = await getUser();
	const parsed = reconcileSchema.parse({
		inboxItemId: formData.get("inboxItemId"),
		titleId: formData.get("titleId"),
	});

	const result = await reconcileInboxItemWithTitle({
		userId: user.id,
		inboxItemId: parsed.inboxItemId,
		titleId: parsed.titleId,
	});

	if (!result) {
		throw new Error(
			"Não foi possível conciliar este item com o título selecionado.",
		);
	}

	revalidateReconciliationRelatedEntities(user.id);
}

export async function dismissInboxItemReconciliationAction(formData: FormData) {
	const user = await getUser();
	const parsed = dismissSchema.parse({
		inboxItemId: formData.get("inboxItemId"),
	});

	const result = await dismissInboxItemReconciliation({
		userId: user.id,
		inboxItemId: parsed.inboxItemId,
	});

	if (!result) {
		throw new Error("Não foi possível dispensar esta conciliação.");
	}

	revalidateReconciliationRelatedEntities(user.id);
}
