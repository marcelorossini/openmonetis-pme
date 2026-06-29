import { z } from "zod";
import { noteSchema, uuidSchema } from "@/shared/lib/schemas/common";

export const createAccountInputSchema = z.object({
	name: z
		.string({ message: "Informe o nome da conta." })
		.trim()
		.min(1, "Informe o nome da conta."),
	accountType: z
		.string({ message: "Informe o tipo da conta." })
		.trim()
		.min(1, "Informe o tipo da conta."),
	status: z
		.string({ message: "Informe o status da conta." })
		.trim()
		.min(1, "Informe o status da conta."),
	note: noteSchema,
	logo: z
		.string({ message: "Selecione um logo." })
		.trim()
		.min(1, "Selecione um logo."),
	initialBalance: z.union([
		z.number(),
		z
			.string()
			.trim()
			.transform((value) =>
				value.length === 0 ? "0" : value.replace(",", "."),
			)
			.refine(
				(value) => !Number.isNaN(Number.parseFloat(value)),
				"Informe um saldo inicial válido.",
			)
			.transform((value) => Number.parseFloat(value)),
	]),
	excludeFromBalance: z
		.union([z.boolean(), z.string()])
		.transform((value) => value === true || value === "true"),
	excludeInitialBalanceFromIncome: z
		.union([z.boolean(), z.string()])
		.transform((value) => value === true || value === "true"),
});

export const updateAccountInputSchema = createAccountInputSchema.extend({
	id: uuidSchema("FinancialAccount"),
});

export const deleteAccountInputSchema = z.object({
	id: uuidSchema("FinancialAccount"),
});

export type CreateAccountInput = z.infer<typeof createAccountInputSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountInputSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountInputSchema>;
