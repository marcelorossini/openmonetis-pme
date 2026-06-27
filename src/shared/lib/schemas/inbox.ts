import { z } from "zod";

const PAYMENT_METHODS = [
	"Cartão de crédito",
	"Cartão de débito",
	"Pix",
	"Dinheiro",
	"Boleto",
	"Pré-Pago | VR/VA",
	"Transferência bancária",
] as const;

const TRANSACTION_TYPES = ["Despesa", "Receita", "Transferência"] as const;

const optionalUuidSchema = z
	.string()
	.uuid("ID inválido")
	.nullable()
	.optional()
	.transform((value) => value ?? null);

export const inboxItemSchema = z.object({
	sourceApp: z.string().min(1, "sourceApp é obrigatório").max(255),
	sourceAppName: z.string().max(255).optional(),
	profileKey: z.string().max(255).optional(),
	originalTitle: z.string().max(500).optional(),
	originalText: z.string().min(1, "originalText é obrigatório").max(5000),
	notificationTimestamp: z
		.string()
		.transform((val) => new Date(val))
		.refine((d) => !Number.isNaN(d.getTime()), "Data de notificação inválida"),
	parsedName: z.string().max(500).optional(),
	parsedAmount: z.coerce.number().optional(),
	clientId: z.string().max(255).optional(), // ID local do app para rastreamento
	purchaseDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Data de compra inválida")
		.optional(),
	transactionType: z.enum(TRANSACTION_TYPES).optional(),
	paymentMethod: z
		.enum(PAYMENT_METHODS, {
			message: "Forma de pagamento inválida",
		})
		.optional(),
	accountId: optionalUuidSchema,
	accountExternalKey: z.string().max(255).optional(),
	cardId: optionalUuidSchema,
	categoryId: optionalUuidSchema,
	categoryExternalKey: z.string().max(255).optional(),
	payerId: optionalUuidSchema,
	partyId: optionalUuidSchema,
	partyExternalKey: z.string().max(255).optional(),
	autoImport: z.boolean().optional().default(false),
});

export const inboxBatchSchema = z.object({
	items: z.array(inboxItemSchema).min(1).max(50),
});
