import { z } from "zod";
import { CATEGORY_TYPES } from "@/shared/lib/categories/constants";
import { CATEGORY_PARTY_KINDS } from "@/shared/lib/categories/party-kind";
import { uuidSchema } from "@/shared/lib/schemas/common";
import { normalizeIconInput } from "@/shared/utils/string";

const categoryBaseSchema = z.object({
	name: z
		.string({ message: "Informe o nome da categoria." })
		.trim()
		.min(1, "Informe o nome da categoria."),
	type: z.enum(CATEGORY_TYPES, {
		message: "Tipo de categoria inválido.",
	}),
	icon: z
		.string()
		.trim()
		.max(100, "O ícone deve ter no máximo 100 caracteres.")
		.nullish()
		.transform((value) => normalizeIconInput(value)),
	partyKind: z
		.enum(CATEGORY_PARTY_KINDS, {
			message: "Tipo de vínculo inválido.",
		})
		.nullish()
		.transform((value) => value ?? null),
});

export const createCategoryInputSchema = categoryBaseSchema;

export const updateCategoryInputSchema = categoryBaseSchema.extend({
	id: uuidSchema("Category"),
});

export const deleteCategoryInputSchema = z.object({
	id: uuidSchema("Category"),
});

export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;
export type DeleteCategoryInput = z.infer<typeof deleteCategoryInputSchema>;
