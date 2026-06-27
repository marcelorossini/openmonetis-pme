"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { categories, financialAccounts, transactions } from "@/db/schema";
import {
	ACCOUNT_BALANCE_ADJUSTMENT_NAME,
	INITIAL_BALANCE_CATEGORY_NAME,
	INITIAL_BALANCE_CONDITION,
	INITIAL_BALANCE_NOTE,
	INITIAL_BALANCE_PAYMENT_METHOD,
	INITIAL_BALANCE_TRANSACTION_TYPE,
} from "@/shared/lib/accounts/constants";
import {
	type ActionResult,
	handleActionError,
	revalidateForEntity,
} from "@/shared/lib/actions/helpers";
import { getUser } from "@/shared/lib/auth/server";
import { db } from "@/shared/lib/db";
import { PERIOD_FORMAT_REGEX } from "@/shared/lib/invoices";
import { getAdminPayerId } from "@/shared/lib/payers/get-admin-id";
import { noteSchema, uuidSchema } from "@/shared/lib/schemas/common";
import {
	TRANSFER_CATEGORY_NAME,
	TRANSFER_CONDITION,
	TRANSFER_ESTABLISHMENT_ENTRADA,
	TRANSFER_ESTABLISHMENT_SAIDA,
	TRANSFER_PAYMENT_METHOD,
} from "@/shared/lib/transfers/constants";
import {
	formatCurrency,
	formatDecimalForDbRequired,
} from "@/shared/utils/currency";
import {
	getBusinessTodayDate,
	getTodayInfo,
	parseLocalDateString,
} from "@/shared/utils/date";
import { derivePeriodFromDate } from "@/shared/utils/period";
import { normalizeFilePath } from "@/shared/utils/string";

const ACCOUNT_YIELD_CATEGORY_NAME = "Rendimentos";
const ACCOUNT_YIELD_CATEGORY_ICON = "RiFundsLine";
const ACCOUNT_YIELD_TRANSACTION_NAME = "Rendimento";
const ACCOUNT_YIELD_CONDITION = INITIAL_BALANCE_CONDITION;
const ACCOUNT_YIELD_PAYMENT_METHOD = "Transferência bancária" as const;

const accountBaseSchema = z.object({
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

const createAccountSchema = accountBaseSchema;
const updateAccountSchema = accountBaseSchema.extend({
	id: uuidSchema("FinancialAccount"),
});
const deleteAccountSchema = z.object({
	id: uuidSchema("FinancialAccount"),
});

type AccountCreateInput = z.infer<typeof createAccountSchema>;
type AccountUpdateInput = z.infer<typeof updateAccountSchema>;
type AccountDeleteInput = z.infer<typeof deleteAccountSchema>;

export async function createAccountAction(
	input: AccountCreateInput,
): Promise<ActionResult<{ id: string }>> {
	try {
		const user = await getUser();
		const data = createAccountSchema.parse(input);

		const logoFile = normalizeFilePath(data.logo);

		const normalizedInitialBalance = Math.abs(data.initialBalance);
		const hasInitialBalance = normalizedInitialBalance > 0;
		const adminPayerId = hasInitialBalance
			? await getAdminPayerId(user.id)
			: null;

		if (hasInitialBalance && !adminPayerId) {
			throw new Error(
				"Pessoa com papel administrador não encontrada. Crie uma pessoa admin antes de definir um saldo inicial.",
			);
		}

		let createdAccountId: string | null = null;

		await db.transaction(async (tx: typeof db) => {
			const [createdAccount] = await tx
				.insert(financialAccounts)
				.values({
					name: data.name,
					accountType: data.accountType,
					status: data.status,
					note: data.note ?? null,
					logo: logoFile,
					initialBalance: formatDecimalForDbRequired(data.initialBalance),
					excludeFromBalance: data.excludeFromBalance,
					excludeInitialBalanceFromIncome: data.excludeInitialBalanceFromIncome,
					userId: user.id,
				})
				.returning({ id: financialAccounts.id, name: financialAccounts.name });

			if (!createdAccount) {
				throw new Error("Não foi possível criar a conta.");
			}

			createdAccountId = createdAccount.id;

			if (!hasInitialBalance) {
				return;
			}

			const [category] = await Promise.all([
				tx.query.categories.findFirst({
					columns: { id: true },
					where: and(
						eq(categories.userId, user.id),
						eq(categories.name, INITIAL_BALANCE_CATEGORY_NAME),
					),
				}),
			]);

			if (!category) {
				throw new Error(
					'Category "Saldo inicial" não encontrada. Crie-a antes de definir um saldo inicial.',
				);
			}

			const { date, period } = getTodayInfo();

			await tx.insert(transactions).values({
				condition: INITIAL_BALANCE_CONDITION,
				name: `Saldo inicial - ${createdAccount.name}`,
				paymentMethod: INITIAL_BALANCE_PAYMENT_METHOD,
				note: INITIAL_BALANCE_NOTE,
				amount: formatDecimalForDbRequired(normalizedInitialBalance),
				purchaseDate: date,
				transactionType: INITIAL_BALANCE_TRANSACTION_TYPE,
				period,
				isSettled: true,
				userId: user.id,
				accountId: createdAccount.id,
				categoryId: category.id,
				payerId: adminPayerId,
			});
		});

		revalidateForEntity("accounts", user.id);

		return {
			success: true,
			message: "Conta criada com sucesso.",
			data: createdAccountId ? { id: createdAccountId } : undefined,
		};
	} catch (error) {
		return handleActionError(error) as ActionResult<{ id: string }>;
	}
}

export async function updateAccountAction(
	input: AccountUpdateInput,
): Promise<ActionResult> {
	try {
		const user = await getUser();
		const data = updateAccountSchema.parse(input);

		const logoFile = normalizeFilePath(data.logo);

		const [updated] = await db
			.update(financialAccounts)
			.set({
				name: data.name,
				accountType: data.accountType,
				status: data.status,
				note: data.note ?? null,
				logo: logoFile,
				initialBalance: formatDecimalForDbRequired(data.initialBalance),
				excludeFromBalance: data.excludeFromBalance,
				excludeInitialBalanceFromIncome: data.excludeInitialBalanceFromIncome,
			})
			.where(
				and(
					eq(financialAccounts.id, data.id),
					eq(financialAccounts.userId, user.id),
				),
			)
			.returning();

		if (!updated) {
			return {
				success: false,
				error: "Conta não encontrada.",
			};
		}

		revalidateForEntity("accounts", user.id);

		return {
			success: true,
			message: "Conta atualizada com sucesso.",
		};
	} catch (error) {
		return handleActionError(error);
	}
}

export async function deleteAccountAction(
	input: AccountDeleteInput,
): Promise<ActionResult> {
	try {
		const user = await getUser();
		const data = deleteAccountSchema.parse(input);

		const [deleted] = await db
			.delete(financialAccounts)
			.where(
				and(
					eq(financialAccounts.id, data.id),
					eq(financialAccounts.userId, user.id),
				),
			)
			.returning({ id: financialAccounts.id });

		if (!deleted) {
			return {
				success: false,
				error: "Conta não encontrada.",
			};
		}

		revalidateForEntity("accounts", user.id);

		return {
			success: true,
			message: "Conta removida com sucesso.",
		};
	} catch (error) {
		return handleActionError(error);
	}
}

// Transfer between accounts
const transferSchema = z.object({
	fromAccountId: uuidSchema("Conta de origem"),
	toAccountId: uuidSchema("Conta de destino"),
	amount: z
		.string()
		.trim()
		.transform((value) => (value.length === 0 ? "0" : value.replace(",", ".")))
		.refine(
			(value) => !Number.isNaN(Number.parseFloat(value)),
			"Informe um valor válido.",
		)
		.transform((value) => Number.parseFloat(value))
		.refine((value) => value > 0, "O valor deve ser maior que zero."),
	date: z.coerce.date({ message: "Informe uma data válida." }),
	period: z
		.string({ message: "Informe o período." })
		.trim()
		.min(1, "Informe o período."),
});

type TransferInput = z.input<typeof transferSchema>;

export async function transferBetweenAccountsAction(
	input: TransferInput,
): Promise<ActionResult> {
	try {
		const user = await getUser();
		const data = transferSchema.parse(input);

		// Validate that accounts are different
		if (data.fromAccountId === data.toAccountId) {
			return {
				success: false,
				error: "A conta de origem e destino devem ser diferentes.",
			};
		}

		// Generate a unique transfer ID to link both transactions
		const transferId = crypto.randomUUID();
		const adminPayerId = await getAdminPayerId(user.id);

		if (!adminPayerId) {
			throw new Error(
				"Pessoa administrador não encontrada. Por favor, crie uma pessoa admin.",
			);
		}

		await db.transaction(async (tx: typeof db) => {
			// Verify both accounts exist and belong to the user
			const [fromAccount, toAccount] = await Promise.all([
				tx.query.financialAccounts.findFirst({
					columns: { id: true, name: true },
					where: and(
						eq(financialAccounts.id, data.fromAccountId),
						eq(financialAccounts.userId, user.id),
					),
				}),
				tx.query.financialAccounts.findFirst({
					columns: { id: true, name: true },
					where: and(
						eq(financialAccounts.id, data.toAccountId),
						eq(financialAccounts.userId, user.id),
					),
				}),
			]);

			if (!fromAccount) {
				throw new Error("Conta de origem não encontrada.");
			}

			if (!toAccount) {
				throw new Error("Conta de destino não encontrada.");
			}

			// Get the transfer category and admin payer in parallel
			const [transferCategory] = await Promise.all([
				tx.query.categories.findFirst({
					columns: { id: true },
					where: and(
						eq(categories.userId, user.id),
						eq(categories.name, TRANSFER_CATEGORY_NAME),
					),
				}),
			]);

			if (!transferCategory) {
				throw new Error(
					`Category "${TRANSFER_CATEGORY_NAME}" não encontrada. Por favor, crie esta categoria antes de fazer transferências.`,
				);
			}

			const transferNote = `de ${fromAccount.name} -> ${toAccount.name}`;

			const sharedFields = {
				condition: TRANSFER_CONDITION,
				paymentMethod: TRANSFER_PAYMENT_METHOD,
				note: transferNote,
				purchaseDate: data.date,
				transactionType: "Transferência" as const,
				period: data.period,
				isSettled: true,
				userId: user.id,
				categoryId: transferCategory.id,
				payerId: adminPayerId,
				transferId,
			};

			// Create both transactions in a single batch insert
			await tx.insert(transactions).values([
				{
					...sharedFields,
					name: TRANSFER_ESTABLISHMENT_SAIDA,
					amount: formatDecimalForDbRequired(-Math.abs(data.amount)),
					accountId: fromAccount.id,
				},
				{
					...sharedFields,
					name: TRANSFER_ESTABLISHMENT_ENTRADA,
					amount: formatDecimalForDbRequired(Math.abs(data.amount)),
					accountId: toAccount.id,
				},
			]);
		});

		revalidateForEntity("accounts", user.id);
		revalidateForEntity("transactions", user.id);

		return {
			success: true,
			message: "Transferência registrada com sucesso.",
		};
	} catch (error) {
		return handleActionError(error);
	}
}

const adjustAccountBalanceSchema = z.object({
	accountId: uuidSchema("FinancialAccount"),
	period: z
		.string({ message: "Período inválido." })
		.regex(PERIOD_FORMAT_REGEX, "Período inválido."),
	currentBalance: z.number({ message: "Saldo atual inválido." }),
	targetBalance: z.number({ message: "Saldo correto inválido." }),
});

type AdjustAccountBalanceInput = z.infer<typeof adjustAccountBalanceSchema>;

const addAccountYieldSchema = z.object({
	accountId: uuidSchema("FinancialAccount"),
	amount: z
		.number({ message: "Valor inválido." })
		.positive("Informe um valor maior que zero."),
	date: z
		.string({ message: "Data inválida." })
		.trim()
		.regex(/^\d{4}-\d{2}-\d{2}$/u, "Data inválida."),
});

type AddAccountYieldInput = z.infer<typeof addAccountYieldSchema>;

export async function addAccountYieldAction(
	input: AddAccountYieldInput,
): Promise<ActionResult> {
	try {
		const user = await getUser();
		const data = addAccountYieldSchema.parse(input);
		const adminPayerId = await getAdminPayerId(user.id);

		if (!adminPayerId) {
			throw new Error(
				"Pessoa com papel administrador não encontrada. Crie uma pessoa admin antes de adicionar rendimentos.",
			);
		}

		const purchaseDate = parseLocalDateString(data.date);
		if (Number.isNaN(purchaseDate.getTime())) {
			throw new Error("Data inválida.");
		}

		await db.transaction(async (tx: typeof db) => {
			const account = await tx.query.financialAccounts.findFirst({
				columns: { id: true },
				where: and(
					eq(financialAccounts.id, data.accountId),
					eq(financialAccounts.userId, user.id),
				),
			});

			if (!account) {
				throw new Error("Conta não encontrada.");
			}

			const existingCategory = await tx.query.categories.findFirst({
				columns: { id: true },
				where: and(
					eq(categories.userId, user.id),
					eq(categories.type, "receita"),
					eq(categories.name, ACCOUNT_YIELD_CATEGORY_NAME),
				),
			});

			const category =
				existingCategory ??
				(
					await tx
						.insert(categories)
						.values({
							name: ACCOUNT_YIELD_CATEGORY_NAME,
							type: "receita",
							icon: ACCOUNT_YIELD_CATEGORY_ICON,
							userId: user.id,
						})
						.returning({ id: categories.id })
				)[0];

			if (!category) {
				throw new Error(
					"Não foi possível preparar a categoria de rendimentos.",
				);
			}

			await tx.insert(transactions).values({
				condition: ACCOUNT_YIELD_CONDITION,
				name: ACCOUNT_YIELD_TRANSACTION_NAME,
				paymentMethod: ACCOUNT_YIELD_PAYMENT_METHOD,
				note: null,
				amount: formatDecimalForDbRequired(data.amount),
				purchaseDate,
				transactionType: "Receita" as const,
				period: derivePeriodFromDate(data.date),
				isSettled: true,
				userId: user.id,
				accountId: data.accountId,
				cardId: null,
				categoryId: category.id,
				payerId: adminPayerId,
			});
		});

		revalidateForEntity("accounts", user.id);
		revalidateForEntity("transactions", user.id);

		return { success: true, message: "Rendimento adicionado com sucesso." };
	} catch (error) {
		return handleActionError(error);
	}
}

export async function adjustAccountBalanceAction(
	input: AdjustAccountBalanceInput,
): Promise<ActionResult> {
	try {
		const user = await getUser();
		const data = adjustAccountBalanceSchema.parse(input);
		const adminPayerId = await getAdminPayerId(user.id);

		if (!adminPayerId) {
			throw new Error(
				"Pessoa com papel administrador não encontrada. Crie uma pessoa admin antes de ajustar o saldo.",
			);
		}

		let message = "Ajuste de saldo registrado.";

		await db.transaction(async (tx: typeof db) => {
			const account = await tx.query.financialAccounts.findFirst({
				columns: { id: true },
				where: and(
					eq(financialAccounts.id, data.accountId),
					eq(financialAccounts.userId, user.id),
				),
			});

			if (!account) {
				throw new Error("Conta não encontrada.");
			}

			const existing = await tx.query.transactions.findFirst({
				columns: { id: true, amount: true },
				where: and(
					eq(transactions.userId, user.id),
					eq(transactions.accountId, data.accountId),
					eq(transactions.period, data.period),
					eq(transactions.name, ACCOUNT_BALANCE_ADJUSTMENT_NAME),
				),
			});

			const existingAmount = Number(existing?.amount ?? 0);
			const baseBalance = data.currentBalance - existingAmount;
			const adjustmentAmount =
				Math.round((data.targetBalance - baseBalance) * 100) / 100;

			if (adjustmentAmount === 0) {
				if (existing) {
					await tx.delete(transactions).where(eq(transactions.id, existing.id));
					message = "Ajuste de saldo removido.";
				} else {
					message = "Nada a ajustar — o saldo já está correto.";
				}
				return;
			}

			const isExpense = adjustmentAmount < 0;
			const categoryName = isExpense ? "Outras despesas" : "Outras receitas";

			const category = await tx.query.categories.findFirst({
				columns: { id: true },
				where: and(
					eq(categories.userId, user.id),
					eq(categories.name, categoryName),
				),
			});

			const amount = formatDecimalForDbRequired(adjustmentAmount);
			const note = `O saldo era ${formatCurrency(baseBalance)} mas o correto é ${formatCurrency(data.targetBalance)}.`;

			const payload = {
				condition: INITIAL_BALANCE_CONDITION,
				name: ACCOUNT_BALANCE_ADJUSTMENT_NAME,
				paymentMethod: INITIAL_BALANCE_PAYMENT_METHOD,
				note,
				amount,
				purchaseDate: getBusinessTodayDate(),
				transactionType: isExpense
					? ("Despesa" as const)
					: ("Receita" as const),
				period: data.period,
				isSettled: true,
				userId: user.id,
				accountId: data.accountId,
				cardId: null,
				categoryId: category?.id ?? null,
				payerId: adminPayerId,
			};

			if (existing) {
				await tx
					.update(transactions)
					.set(payload)
					.where(eq(transactions.id, existing.id));
			} else {
				await tx.insert(transactions).values(payload);
			}
		});

		revalidateForEntity("accounts", user.id);
		revalidateForEntity("transactions", user.id);

		return { success: true, message };
	} catch (error) {
		return handleActionError(error);
	}
}
