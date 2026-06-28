import { z } from "zod";
import {
	FINANCIAL_TITLE_EDIT_SCOPES,
	FINANCIAL_TITLE_SERIES_FREQUENCIES,
	FINANCIAL_TITLE_STATUSES,
	FINANCIAL_TITLE_TYPES,
} from "@/features/receivables-payables/types";
import { PAYMENT_METHODS } from "@/features/transactions/lib/constants";
import {
	noteSchema,
	requiredDecimalSchema,
	uuidSchema,
} from "@/shared/lib/schemas/common";
import { parseLocalDateString } from "@/shared/utils/date";

const isValidDateInput = (value: string) =>
	!Number.isNaN(parseLocalDateString(value).getTime());

const dateInputSchema = z
	.string({ message: "Informe a data." })
	.trim()
	.refine((value) => isValidDateInput(value), {
		message: "Informe uma data válida.",
	});

const optionalUuidSchema = (entityName: string) =>
	z
		.string()
		.trim()
		.nullish()
		.transform((value) => value || null)
		.refine(
			(value) =>
				value === null || uuidSchema(entityName).safeParse(value).success,
			{
				message: `${entityName} inválido.`,
			},
		);

const paymentMethodEnum = z.enum(PAYMENT_METHODS, {
	message: "Selecione uma forma de pagamento válida.",
});

const titleTypeEnum = z.enum(FINANCIAL_TITLE_TYPES, {
	message: "Selecione um tipo válido.",
});

const titleStatusEnum = z.enum(FINANCIAL_TITLE_STATUSES, {
	message: "Selecione um status válido.",
});

const recurrenceFrequencyEnum = z.enum(FINANCIAL_TITLE_SERIES_FREQUENCIES, {
	message: "Selecione uma frequência válida.",
});

const editScopeEnum = z.enum(FINANCIAL_TITLE_EDIT_SCOPES, {
	message: "Selecione um escopo de edição válido.",
});

const recurrenceSchema = z.object({
	frequency: recurrenceFrequencyEnum,
	generateRetroactive: z.boolean().default(false),
	endDate: dateInputSchema.nullish(),
});

const baseSchema = z.object({
	type: titleTypeEnum,
	name: z
		.string({ message: "Informe o nome." })
		.trim()
		.min(1, "Informe o nome.")
		.max(120, "Informe até 120 caracteres."),
	description: noteSchema,
	amount: requiredDecimalSchema("valor"),
	dueDate: dateInputSchema,
	paymentMethod: paymentMethodEnum,
	partyId: optionalUuidSchema("Cliente/Fornecedor"),
	categoryId: optionalUuidSchema("Categoria"),
	accountId: optionalUuidSchema("Conta"),
	payerId: optionalUuidSchema("Pessoa"),
	recurrence: recurrenceSchema.nullish(),
});

export const createFinancialTitleSchema = baseSchema;

export const updateFinancialTitleSchema = baseSchema.extend({
	id: uuidSchema("Título financeiro"),
	editScope: editScopeEnum.default("single"),
});

export const cancelFinancialTitleSchema = z.object({
	id: uuidSchema("Título financeiro"),
});

export const restoreFinancialTitleSchema = z.object({
	id: uuidSchema("Título financeiro"),
});

export const settleFinancialTitleSchema = z.object({
	id: uuidSchema("Título financeiro"),
	accountId: uuidSchema("Conta"),
	paymentMethod: paymentMethodEnum,
	settledAt: dateInputSchema,
	settledAmount: requiredDecimalSchema("valor da baixa"),
});

export const endFinancialTitleSeriesSchema = z.object({
	id: uuidSchema("Título financeiro"),
	endDate: dateInputSchema,
});

export const extendFinancialTitleSeriesSchema = z.object({
	id: uuidSchema("Título financeiro"),
	endDate: dateInputSchema,
});

export const resumeFinancialTitleSeriesSchema = z.object({
	id: uuidSchema("Título financeiro"),
});

export const persistedFinancialTitleStatusSchema = titleStatusEnum;

export type CreateFinancialTitleInput = z.infer<
	typeof createFinancialTitleSchema
>;
export type UpdateFinancialTitleInput = z.infer<
	typeof updateFinancialTitleSchema
>;
export type CancelFinancialTitleInput = z.infer<
	typeof cancelFinancialTitleSchema
>;
export type RestoreFinancialTitleInput = z.infer<
	typeof restoreFinancialTitleSchema
>;
export type SettleFinancialTitleInput = z.infer<
	typeof settleFinancialTitleSchema
>;
export type EndFinancialTitleSeriesInput = z.infer<
	typeof endFinancialTitleSeriesSchema
>;
export type ExtendFinancialTitleSeriesInput = z.infer<
	typeof extendFinancialTitleSeriesSchema
>;
export type ResumeFinancialTitleSeriesInput = z.infer<
	typeof resumeFinancialTitleSeriesSchema
>;
