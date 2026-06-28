import { z } from "zod";
import { PARTY_STATUS_OPTIONS } from "@/features/parties/types";
import { CATEGORY_PARTY_KINDS } from "@/shared/lib/categories/party-kind";
import { noteSchema, uuidSchema } from "@/shared/lib/schemas/common";

export const partyStatusSchema = z.enum(PARTY_STATUS_OPTIONS, {
	message: "Selecione um status válido.",
});

export const partyKindSchema = z.enum(CATEGORY_PARTY_KINDS, {
	message: "Selecione um tipo válido.",
});

export const optionalPartyTextSchema = z
	.string()
	.trim()
	.max(255, "Informe até 255 caracteres.")
	.nullish()
	.transform((value) => value || null);

export const partyBaseSchema = z.object({
	kind: partyKindSchema,
	name: z
		.string({ message: "Informe o nome." })
		.trim()
		.min(1, "Informe o nome."),
	document: optionalPartyTextSchema,
	email: optionalPartyTextSchema,
	phone: optionalPartyTextSchema,
	status: partyStatusSchema,
	note: noteSchema,
});

export const createPartyInputSchema = partyBaseSchema;

export const updatePartyInputSchema = partyBaseSchema.extend({
	id: uuidSchema("Cliente/Fornecedor"),
});

export const deletePartyInputSchema = z.object({
	id: uuidSchema("Cliente/Fornecedor"),
});

export type CreatePartyInput = z.infer<typeof createPartyInputSchema>;
export type UpdatePartyInput = z.infer<typeof updatePartyInputSchema>;
export type DeletePartyInput = z.infer<typeof deletePartyInputSchema>;
