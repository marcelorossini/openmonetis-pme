import { z } from "zod";
import { normalizeOptionalText } from "@/shared/lib/inbox-integrations/mapping";
import { createAccountInputSchema } from "./schemas";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

const optionalQueryTextSchema = z
	.string()
	.trim()
	.nullish()
	.transform((value) => normalizeOptionalText(value));

export const accountApiIntegrationSchema = z.object({
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

export const accountsApiCreateSchema = createAccountInputSchema.extend({
	integration: accountApiIntegrationSchema.optional(),
});

export const accountsApiUpdateSchema = createAccountInputSchema.extend({
	integration: accountApiIntegrationSchema.optional(),
});

export type AccountApiIntegrationInput = z.infer<
	typeof accountApiIntegrationSchema
>;
export type AccountsApiCreateInput = z.infer<typeof accountsApiCreateSchema>;
export type AccountsApiUpdateInput = z.infer<typeof accountsApiUpdateSchema>;

export type AccountsApiListSearchParams = {
	page: number;
	pageSize: (typeof PAGE_SIZE_OPTIONS)[number];
	status: string | null;
	accountType: string | null;
	search: string | null;
	integration: AccountApiIntegrationInput | null;
};

export function parseAccountsApiListSearchParams(
	searchParams: URLSearchParams,
): AccountsApiListSearchParams {
	const pageParam = Number.parseInt(searchParams.get("page") ?? "", 10);
	const pageSizeParam = Number.parseInt(searchParams.get("pageSize") ?? "", 10);
	const status = optionalQueryTextSchema.parse(searchParams.get("status"));
	const accountType = optionalQueryTextSchema.parse(
		searchParams.get("accountType"),
	);
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
		status,
		accountType,
		search,
		integration: sourceApp
			? accountApiIntegrationSchema.parse({
					sourceApp,
					profileKey,
					externalKey,
				})
			: null,
	};
}
