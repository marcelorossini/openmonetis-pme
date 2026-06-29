import { z } from "zod";
import { createCategoryInputSchema } from "./schemas";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

const optionalQueryTextSchema = z
	.string()
	.trim()
	.nullish()
	.transform((value) => value || null);

export const categoryApiIntegrationSchema = z.object({
	sourceApp: z
		.string({ message: "Informe a origem da integração." })
		.trim()
		.min(1, "Informe a origem da integração.")
		.max(255, "Informe até 255 caracteres para a origem."),
	profileKey: optionalQueryTextSchema,
	externalKey: z
		.string({ message: "Informe o identificador externo." })
		.trim()
		.min(1, "Informe o identificador externo.")
		.max(255, "Informe até 255 caracteres para o identificador externo."),
});

export const categoriesApiCreateSchema = createCategoryInputSchema.extend({
	integration: categoryApiIntegrationSchema.optional(),
});

export const categoriesApiUpdateSchema = createCategoryInputSchema.extend({
	integration: categoryApiIntegrationSchema.optional(),
});

export type CategoryApiIntegrationInput = z.infer<
	typeof categoryApiIntegrationSchema
>;
export type CategoriesApiCreateInput = z.infer<
	typeof categoriesApiCreateSchema
>;
export type CategoriesApiUpdateInput = z.infer<
	typeof categoriesApiUpdateSchema
>;

export type CategoriesApiListSearchParams = {
	page: number;
	pageSize: (typeof PAGE_SIZE_OPTIONS)[number];
	type: "receita" | "despesa" | null;
	partyKind: "cliente" | "fornecedor" | null;
	search: string | null;
	integration: CategoryApiIntegrationInput | null;
};

export function parseCategoriesApiListSearchParams(
	searchParams: URLSearchParams,
): CategoriesApiListSearchParams {
	const pageParam = Number.parseInt(searchParams.get("page") ?? "", 10);
	const pageSizeParam = Number.parseInt(searchParams.get("pageSize") ?? "", 10);
	const typeParam = searchParams.get("type");
	const partyKindParam = searchParams.get("partyKind");
	const search = optionalQueryTextSchema.parse(searchParams.get("search"));
	const sourceApp = optionalQueryTextSchema.parse(
		searchParams.get("sourceApp"),
	);
	const profileKey = optionalQueryTextSchema.parse(
		searchParams.get("profileKey"),
	);
	const externalKey = optionalQueryTextSchema.parse(
		searchParams.get("externalKey"),
	);

	if ((sourceApp && !externalKey) || (!sourceApp && externalKey)) {
		throw new z.ZodError([
			{
				code: "custom",
				message: "sourceApp e externalKey precisam ser informados juntos.",
				path: ["integration"],
			},
		]);
	}

	return {
		page: Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1,
		pageSize: PAGE_SIZE_OPTIONS.includes(
			pageSizeParam as (typeof PAGE_SIZE_OPTIONS)[number],
		)
			? (pageSizeParam as (typeof PAGE_SIZE_OPTIONS)[number])
			: DEFAULT_PAGE_SIZE,
		type: typeParam === "receita" || typeParam === "despesa" ? typeParam : null,
		partyKind:
			partyKindParam === "cliente" || partyKindParam === "fornecedor"
				? partyKindParam
				: null,
		search,
		integration: sourceApp
			? categoryApiIntegrationSchema.parse({
					sourceApp,
					profileKey,
					externalKey,
				})
			: null,
	};
}
