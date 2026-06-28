import { z } from "zod";
import { createPartyInputSchema } from "./schemas";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

const optionalQueryTextSchema = z
	.string()
	.trim()
	.nullish()
	.transform((value) => value || null);

export const partyApiIntegrationSchema = z.object({
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

export const partiesApiCreateSchema = createPartyInputSchema.extend({
	integration: partyApiIntegrationSchema.optional(),
});

export const partiesApiUpdateSchema = createPartyInputSchema.extend({
	integration: partyApiIntegrationSchema.optional(),
});

export type PartyApiIntegrationInput = z.infer<
	typeof partyApiIntegrationSchema
>;

export type PartiesApiCreateInput = z.infer<typeof partiesApiCreateSchema>;
export type PartiesApiUpdateInput = z.infer<typeof partiesApiUpdateSchema>;

export type PartiesApiListSearchParams = {
	page: number;
	pageSize: (typeof PAGE_SIZE_OPTIONS)[number];
	kind: "cliente" | "fornecedor" | null;
	status: "Ativo" | "Inativo" | null;
	search: string | null;
	integration: PartyApiIntegrationInput | null;
};

export function parsePartiesApiListSearchParams(
	searchParams: URLSearchParams,
): PartiesApiListSearchParams {
	const pageParam = Number.parseInt(searchParams.get("page") ?? "", 10);
	const pageSizeParam = Number.parseInt(searchParams.get("pageSize") ?? "", 10);
	const kindParam = searchParams.get("kind");
	const statusParam = searchParams.get("status");
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
		kind:
			kindParam === "cliente" || kindParam === "fornecedor" ? kindParam : null,
		status:
			statusParam === "Ativo" || statusParam === "Inativo" ? statusParam : null,
		search,
		integration: sourceApp
			? partyApiIntegrationSchema.parse({
					sourceApp,
					profileKey,
					externalKey,
				})
			: null,
	};
}
