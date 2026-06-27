"use server";

import { randomUUID } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import {
	attachments,
	financialAccounts,
	transactionAttachments,
	transactions,
} from "@/db/schema";
import { ACCOUNT_AUTO_INVOICE_NOTE_PREFIX } from "@/shared/lib/accounts/constants";
import { handleActionError } from "@/shared/lib/actions/helpers";
import { getUser } from "@/shared/lib/auth/server";
import { db } from "@/shared/lib/db";
import {
	buildEntriesByPayer,
	sendPayerAutoEmails,
} from "@/shared/lib/payers/notifications";
import type { ActionResult } from "@/shared/lib/types/actions";
import { formatDecimalForDbRequired } from "@/shared/utils/currency";
import {
	getBusinessTodayDate,
	parseLocalDateString,
} from "@/shared/utils/date";
import { detectInstallmentFromName } from "../lib/installment-detection";
import { cleanupAttachmentsAfterTransactionDelete } from "./attachments";
import {
	buildTransactionRecords,
	type ConvertToInstallmentInput,
	type ConvertToRecurringInput,
	type CreateInput,
	centsToDecimalString,
	convertToInstallmentSchema,
	convertToRecurringSchema,
	type DeleteInput,
	deleteSchema,
	formatPaidInvoicePeriods,
	getPaidInvoicePeriods,
	isInitialBalanceTransaction,
	resolveCategoryPartyKind,
	resolvePartyForTransaction,
	resolvePeriod,
	resolveUserLabel,
	revalidate,
	type ToggleSettlementInput,
	toggleSettlementSchema,
	type UpdateInput,
	updateSchema,
	validateAllOwnership,
	validateCardLimit,
} from "./core";
import { createTransactionForUser } from "./create-service";

export async function createTransactionAction(
	input: CreateInput,
): Promise<ActionResult<{ ids: string[] }>> {
	const user = await getUser();
	return createTransactionForUser({
		userId: user.id,
		userLabel: resolveUserLabel(user),
		input,
	});
}

export async function updateTransactionAction(
	input: UpdateInput,
): Promise<ActionResult> {
	try {
		const user = await getUser();
		const data = updateSchema.parse(input);
		const party = await resolvePartyForTransaction(user.id, data);
		if (!party.ok) {
			return { success: false, error: party.error };
		}

		const ownershipError = await validateAllOwnership(user.id, {
			payerId: data.payerId,
			secondaryPayerId: data.secondaryPayerId,
			splitPayerIds: data.splitShares?.map((share) => share.payerId),
			categoryId: data.categoryId,
			partyId: party.partyId,
			accountId: data.accountId,
			cardId: data.cardId,
		});
		if (ownershipError) {
			return { success: false, error: ownershipError };
		}

		const existing = (await db.query.transactions.findFirst({
			columns: {
				id: true,
				note: true,
				period: true,
				transactionType: true,
				condition: true,
				paymentMethod: true,
				accountId: true,
				cardId: true,
				categoryId: true,
			},
			where: and(
				eq(transactions.id, data.id),
				eq(transactions.userId, user.id),
			),
		})) as
			| {
					id: string;
					note: string | null;
					period: string;
					transactionType: string;
					condition: string;
					paymentMethod: string;
					accountId: string | null;
					cardId: string | null;
					categoryId: string | null;
			  }
			| undefined;

		if (!existing) {
			return { success: false, error: "Lançamento não encontrado." };
		}

		if (existing.note?.startsWith(ACCOUNT_AUTO_INVOICE_NOTE_PREFIX)) {
			return {
				success: false,
				error: "Pagamentos automáticos de fatura não podem ser editados.",
			};
		}

		if (isInitialBalanceTransaction(existing)) {
			return {
				success: false,
				error: "Lançamentos de saldo inicial não podem ser editados.",
			};
		}

		const period = resolvePeriod(data.purchaseDate, data.period);
		const amountSign: 1 | -1 = data.transactionType === "Despesa" ? -1 : 1;
		const amountCents = Math.round(Math.abs(data.amount) * 100);
		const normalizedAmount = centsToDecimalString(amountCents * amountSign);
		const normalizedSettled =
			data.paymentMethod === "Cartão de crédito"
				? null
				: (data.isSettled ?? false);
		const shouldSetBoletoPaymentDate =
			data.paymentMethod === "Boleto" && Boolean(normalizedSettled);
		const boletoPaymentDateValue = shouldSetBoletoPaymentDate
			? data.boletoPaymentDate
				? parseLocalDateString(data.boletoPaymentDate)
				: getBusinessTodayDate()
			: null;
		const targetCardId = data.cardId ?? existing.cardId;
		const movedInvoice =
			data.paymentMethod === "Cartão de crédito" &&
			targetCardId &&
			(targetCardId !== existing.cardId || period !== existing.period);

		if (movedInvoice) {
			const paidPeriods = await getPaidInvoicePeriods(user.id, targetCardId, [
				period,
			]);
			if (paidPeriods.length > 0) {
				return {
					success: false,
					error: `As faturas dos meses ${formatPaidInvoicePeriods(
						paidPeriods,
					)} já estão pagas. Desfaça o pagamento antes de mover este lançamento.`,
				};
			}
		}

		if (
			data.paymentMethod === "Cartão de crédito" &&
			data.cardId &&
			data.transactionType === "Despesa"
		) {
			const limitCheck = await validateCardLimit({
				userId: user.id,
				cardId: data.cardId,
				addAmount: Math.abs(data.amount),
				excludeTransactionIds: [data.id],
			});
			if (!limitCheck.ok) {
				return { success: false, error: limitCheck.error };
			}
		}

		await db
			.update(transactions)
			.set({
				name: data.name,
				purchaseDate: parseLocalDateString(data.purchaseDate),
				transactionType: data.transactionType,
				amount: normalizedAmount,
				condition: data.condition,
				paymentMethod: data.paymentMethod,
				payerId: data.payerId ?? null,
				partyId: party.partyId,
				accountId: data.accountId ?? null,
				cardId: data.cardId ?? null,
				categoryId: data.categoryId ?? null,
				note: data.note ?? null,
				isSettled: normalizedSettled,
				installmentCount: data.installmentCount ?? null,
				recurrenceCount: data.recurrenceCount ?? null,
				dueDate: data.dueDate ? parseLocalDateString(data.dueDate) : null,
				boletoPaymentDate: boletoPaymentDateValue,
				period,
			})
			.where(
				and(eq(transactions.id, data.id), eq(transactions.userId, user.id)),
			);

		if (isInitialBalanceTransaction(existing) && existing.accountId) {
			const updatedInitialBalance = formatDecimalForDbRequired(
				Math.abs(data.amount ?? 0),
			);
			await db
				.update(financialAccounts)
				.set({ initialBalance: updatedInitialBalance })
				.where(
					and(
						eq(financialAccounts.id, existing.accountId),
						eq(financialAccounts.userId, user.id),
					),
				);
		}

		revalidate(user.id);

		return { success: true, message: "Lançamento atualizado com sucesso." };
	} catch (error) {
		return handleActionError(error);
	}
}

export async function deleteTransactionAction(
	input: DeleteInput,
): Promise<ActionResult> {
	try {
		const user = await getUser();
		const data = deleteSchema.parse(input);

		const existing = (await db.query.transactions.findFirst({
			columns: {
				id: true,
				name: true,
				payerId: true,
				amount: true,
				transactionType: true,
				paymentMethod: true,
				condition: true,
				purchaseDate: true,
				period: true,
				note: true,
				categoryId: true,
			},
			where: and(
				eq(transactions.id, data.id),
				eq(transactions.userId, user.id),
			),
		})) as
			| {
					id: string;
					name: string | null;
					payerId: string | null;
					amount: string | null;
					transactionType: string;
					paymentMethod: string;
					condition: string;
					purchaseDate: Date | null;
					period: string;
					note: string | null;
					categoryId: string | null;
			  }
			| undefined;

		if (!existing) {
			return { success: false, error: "Lançamento não encontrado." };
		}

		if (existing.note?.startsWith(ACCOUNT_AUTO_INVOICE_NOTE_PREFIX)) {
			return {
				success: false,
				error: "Pagamentos automáticos de fatura não podem ser removidos.",
			};
		}

		if (isInitialBalanceTransaction(existing)) {
			return {
				success: false,
				error: "Lançamentos de saldo inicial não podem ser removidos.",
			};
		}

		const linkedAttachments = await db
			.select({ id: attachments.id, fileKey: attachments.fileKey })
			.from(transactionAttachments)
			.innerJoin(
				attachments,
				eq(transactionAttachments.attachmentId, attachments.id),
			)
			.where(eq(transactionAttachments.transactionId, data.id));

		await db
			.delete(transactions)
			.where(
				and(eq(transactions.id, data.id), eq(transactions.userId, user.id)),
			);

		await cleanupAttachmentsAfterTransactionDelete(linkedAttachments);

		if (existing.payerId) {
			const notificationEntries = buildEntriesByPayer([
				{
					payerId: existing.payerId,
					name: existing.name ?? null,
					amount: existing.amount ?? null,
					transactionType: existing.transactionType ?? null,
					paymentMethod: existing.paymentMethod ?? null,
					condition: existing.condition ?? null,
					purchaseDate: existing.purchaseDate ?? null,
					period: existing.period ?? null,
					note: existing.note ?? null,
				},
			]);

			await sendPayerAutoEmails({
				userLabel: resolveUserLabel(user),
				action: "deleted",
				entriesByPayer: notificationEntries,
			});
		}

		revalidate(user.id);

		return { success: true, message: "Lançamento removido com sucesso." };
	} catch (error) {
		return handleActionError(error);
	}
}

export async function convertTransactionToInstallmentAction(
	input: ConvertToInstallmentInput,
): Promise<ActionResult<{ createdCount: number }>> {
	try {
		const user = await getUser();
		const data = convertToInstallmentSchema.parse(input);

		const existing = await db.query.transactions.findFirst({
			where: and(
				eq(transactions.id, data.id),
				eq(transactions.userId, user.id),
			),
		});

		if (!existing) {
			return { success: false, error: "Lançamento não encontrado." };
		}

		if (existing.note?.startsWith(ACCOUNT_AUTO_INVOICE_NOTE_PREFIX)) {
			return {
				success: false,
				error: "Pagamentos automáticos de fatura não podem ser convertidos.",
			};
		}

		if (isInitialBalanceTransaction(existing)) {
			return {
				success: false,
				error: "Lançamentos de saldo inicial não podem ser convertidos.",
			};
		}

		if (
			existing.paymentMethod !== "Cartão de crédito" ||
			!existing.cardId ||
			existing.condition !== "À vista"
		) {
			return {
				success: false,
				error:
					"Apenas lançamentos à vista de cartão de crédito podem ser convertidos.",
			};
		}

		if (existing.splitGroupId || existing.isDivided) {
			return {
				success: false,
				error:
					"Lançamentos divididos ainda não podem ser convertidos em parcelamento.",
			};
		}

		const detected = detectInstallmentFromName(existing.name);
		const transactionName =
			detected?.installmentCount === data.installmentCount
				? detected.name
				: existing.name;
		const amountSign: 1 | -1 = existing.transactionType === "Despesa" ? -1 : 1;
		const totalCents = Math.round(Math.abs(Number(existing.amount)) * 100);
		const seriesId = randomUUID();
		const categoryPartyKind = await resolveCategoryPartyKind(
			user.id,
			existing.categoryId,
		);
		const records = buildTransactionRecords({
			data: {
				purchaseDate: existing.purchaseDate.toISOString().slice(0, 10),
				period: existing.period,
				name: transactionName,
				transactionType: existing.transactionType as "Receita" | "Despesa",
				amount: totalCents / 100,
				condition: "Parcelado",
				paymentMethod: "Cartão de crédito",
				payerId: existing.payerId,
				partyId: existing.partyId,
				isSplit: false,
				accountId: null,
				cardId: existing.cardId,
				categoryId: existing.categoryId,
				note: existing.note,
				installmentCount: data.installmentCount,
				startInstallment: 1,
				dueDate: existing.dueDate?.toISOString().slice(0, 10),
				isSettled: null,
			},
			userId: user.id,
			period: existing.period,
			purchaseDate: existing.purchaseDate,
			dueDate: existing.dueDate,
			boletoPaymentDate: null,
			shares: [{ payerId: existing.payerId, amountCents: totalCents }],
			amountSign,
			shouldNullifySettled: true,
			seriesId,
			categoryPartyKind,
		}).map((record) => ({
			...record,
			importBatchId: existing.importBatchId,
		}));

		const currentRow = records[0];
		const rowsToInsert = records.slice(1);
		if (!currentRow) {
			throw new Error("Não foi possível montar o parcelamento.");
		}

		const periodsToUpdate = records
			.map((row) => row.period)
			.filter((period): period is string => Boolean(period));
		const paidPeriods = await getPaidInvoicePeriods(
			user.id,
			existing.cardId,
			periodsToUpdate,
		);

		if (paidPeriods.length > 0) {
			return {
				success: false,
				error: `As faturas dos meses ${formatPaidInvoicePeriods(
					paidPeriods,
				)} já estão pagas. Desfaça o pagamento antes de converter este lançamento.`,
			};
		}

		if (existing.transactionType === "Despesa") {
			const limitCheck = await validateCardLimit({
				userId: user.id,
				cardId: existing.cardId,
				addAmount: records.reduce(
					(acc, row) => acc + Math.abs(Number(row.amount)),
					0,
				),
				excludeTransactionIds: [existing.id],
			});

			if (!limitCheck.ok) {
				return { success: false, error: limitCheck.error };
			}
		}

		await db.transaction(async (tx: typeof db) => {
			await tx
				.update(transactions)
				.set({
					condition: currentRow.condition,
					name: currentRow.name,
					amount: currentRow.amount,
					installmentCount: currentRow.installmentCount,
					currentInstallment: currentRow.currentInstallment,
					recurrenceCount: null,
					period: currentRow.period,
					dueDate: currentRow.dueDate,
					partyId: currentRow.partyId,
					isSettled: null,
					seriesId,
				})
				.where(
					and(
						eq(transactions.id, existing.id),
						eq(transactions.userId, user.id),
					),
				);

			if (rowsToInsert.length > 0) {
				await tx.insert(transactions).values(rowsToInsert);
			}
		});

		revalidate(user.id);

		return {
			success: true,
			message: `Lançamento convertido em ${data.installmentCount} parcelas.`,
			data: { createdCount: rowsToInsert.length },
		};
	} catch (error) {
		return handleActionError(error) as ActionResult<{ createdCount: number }>;
	}
}

export async function convertTransactionToRecurringAction(
	input: ConvertToRecurringInput,
): Promise<ActionResult<{ createdCount: number }>> {
	try {
		const user = await getUser();
		const data = convertToRecurringSchema.parse(input);

		const existing = await db.query.transactions.findFirst({
			where: and(
				eq(transactions.id, data.id),
				eq(transactions.userId, user.id),
			),
		});

		if (!existing) {
			return { success: false, error: "Lançamento não encontrado." };
		}

		if (existing.note?.startsWith(ACCOUNT_AUTO_INVOICE_NOTE_PREFIX)) {
			return {
				success: false,
				error: "Pagamentos automáticos de fatura não podem ser convertidos.",
			};
		}

		if (isInitialBalanceTransaction(existing)) {
			return {
				success: false,
				error: "Lançamentos de saldo inicial não podem ser convertidos.",
			};
		}

		if (existing.condition !== "À vista") {
			return {
				success: false,
				error:
					"Apenas lançamentos à vista podem ser convertidos em recorrência.",
			};
		}

		if (existing.splitGroupId || existing.isDivided) {
			return {
				success: false,
				error:
					"Lançamentos divididos ainda não podem ser convertidos em recorrência.",
			};
		}

		const amountSign: 1 | -1 = existing.transactionType === "Despesa" ? -1 : 1;
		const totalCents = Math.round(Math.abs(Number(existing.amount)) * 100);
		const seriesId = randomUUID();
		const isCreditCard = existing.paymentMethod === "Cartão de crédito";
		const categoryPartyKind = await resolveCategoryPartyKind(
			user.id,
			existing.categoryId,
		);
		const records = buildTransactionRecords({
			data: {
				purchaseDate: existing.purchaseDate.toISOString().slice(0, 10),
				period: existing.period,
				name: existing.name,
				transactionType: existing.transactionType as "Receita" | "Despesa",
				amount: totalCents / 100,
				condition: "Recorrente",
				paymentMethod: existing.paymentMethod as
					| "Pix"
					| "Boleto"
					| "Dinheiro"
					| "Cartão de débito"
					| "Cartão de crédito"
					| "Pré-Pago | VR/VA"
					| "Transferência bancária",
				payerId: existing.payerId,
				partyId: existing.partyId,
				isSplit: false,
				accountId: isCreditCard ? null : existing.accountId,
				cardId: isCreditCard ? existing.cardId : null,
				categoryId: existing.categoryId,
				note: existing.note,
				recurrenceCount: data.recurrenceCount,
				dueDate: existing.dueDate?.toISOString().slice(0, 10),
				boletoPaymentDate: existing.boletoPaymentDate
					?.toISOString()
					.slice(0, 10),
				isSettled: existing.isSettled,
			},
			userId: user.id,
			period: existing.period,
			purchaseDate: existing.purchaseDate,
			dueDate: existing.dueDate,
			boletoPaymentDate: existing.boletoPaymentDate,
			shares: [{ payerId: existing.payerId, amountCents: totalCents }],
			amountSign,
			shouldNullifySettled: isCreditCard,
			seriesId,
			categoryPartyKind,
		}).map((record) => ({
			...record,
			importBatchId: existing.importBatchId,
		}));

		const currentRow = records[0];
		const rowsToInsert = records.slice(1);
		if (!currentRow) {
			throw new Error("Não foi possível montar a recorrência.");
		}

		if (isCreditCard && existing.cardId) {
			const periodsToUpdate = records
				.map((row) => row.period)
				.filter((period): period is string => Boolean(period));
			const paidPeriods = await getPaidInvoicePeriods(
				user.id,
				existing.cardId,
				periodsToUpdate,
			);

			if (paidPeriods.length > 0) {
				return {
					success: false,
					error: `As faturas dos meses ${formatPaidInvoicePeriods(
						paidPeriods,
					)} já estão pagas. Desfaça o pagamento antes de converter este lançamento.`,
				};
			}

			if (existing.transactionType === "Despesa") {
				const limitCheck = await validateCardLimit({
					userId: user.id,
					cardId: existing.cardId,
					addAmount: records.reduce(
						(acc, row) => acc + Math.abs(Number(row.amount)),
						0,
					),
					excludeTransactionIds: [existing.id],
				});

				if (!limitCheck.ok) {
					return { success: false, error: limitCheck.error };
				}
			}
		}

		await db.transaction(async (tx: typeof db) => {
			await tx
				.update(transactions)
				.set({
					condition: currentRow.condition,
					name: currentRow.name,
					amount: currentRow.amount,
					recurrenceCount: currentRow.recurrenceCount,
					installmentCount: null,
					currentInstallment: null,
					period: currentRow.period,
					purchaseDate: currentRow.purchaseDate,
					dueDate: currentRow.dueDate,
					partyId: currentRow.partyId,
					isSettled: currentRow.isSettled,
					boletoPaymentDate: currentRow.boletoPaymentDate,
					seriesId,
				})
				.where(
					and(
						eq(transactions.id, existing.id),
						eq(transactions.userId, user.id),
					),
				);

			if (rowsToInsert.length > 0) {
				await tx.insert(transactions).values(rowsToInsert);
			}
		});

		revalidate(user.id);

		return {
			success: true,
			message: `Lançamento convertido em recorrência de ${data.recurrenceCount} meses.`,
			data: { createdCount: rowsToInsert.length },
		};
	} catch (error) {
		return handleActionError(error) as ActionResult<{ createdCount: number }>;
	}
}

export async function updateTransactionSplitPairAction(
	input: UpdateInput,
): Promise<ActionResult> {
	try {
		const user = await getUser();
		const data = updateSchema.parse(input);
		const party = await resolvePartyForTransaction(user.id, data);
		if (!party.ok) {
			return { success: false, error: party.error };
		}

		const ownershipError = await validateAllOwnership(user.id, {
			payerId: data.payerId,
			splitPayerIds: data.splitShares?.map((share) => share.payerId),
			categoryId: data.categoryId,
			partyId: party.partyId,
			accountId: data.accountId,
			cardId: data.cardId,
		});
		if (ownershipError) {
			return { success: false, error: ownershipError };
		}

		const existing = await db.query.transactions.findFirst({
			columns: {
				id: true,
				period: true,
				transactionType: true,
				condition: true,
				paymentMethod: true,
				accountId: true,
				cardId: true,
				categoryId: true,
				splitGroupId: true,
			},
			where: and(
				eq(transactions.id, data.id),
				eq(transactions.userId, user.id),
			),
		});

		if (!existing) {
			return { success: false, error: "Lançamento não encontrado." };
		}

		const period = resolvePeriod(data.purchaseDate, data.period);
		const amountSign: 1 | -1 = data.transactionType === "Despesa" ? -1 : 1;
		const amountCents = Math.round(Math.abs(data.amount) * 100);
		const normalizedAmount = centsToDecimalString(amountCents * amountSign);
		const normalizedSettled =
			data.paymentMethod === "Cartão de crédito"
				? null
				: (data.isSettled ?? false);
		const shouldSetBoletoPaymentDate =
			data.paymentMethod === "Boleto" && Boolean(normalizedSettled);
		const boletoPaymentDateValue = shouldSetBoletoPaymentDate
			? data.boletoPaymentDate
				? parseLocalDateString(data.boletoPaymentDate)
				: getBusinessTodayDate()
			: null;
		const targetCardId = data.cardId ?? existing.cardId;
		const movedInvoice =
			data.paymentMethod === "Cartão de crédito" &&
			targetCardId &&
			(targetCardId !== existing.cardId || period !== existing.period);

		if (movedInvoice) {
			const paidPeriods = await getPaidInvoicePeriods(user.id, targetCardId, [
				period,
			]);
			if (paidPeriods.length > 0) {
				return {
					success: false,
					error: `As faturas dos meses ${formatPaidInvoicePeriods(
						paidPeriods,
					)} já estão pagas. Desfaça o pagamento antes de mover este lançamento.`,
				};
			}
		}

		const purchaseDate = parseLocalDateString(data.purchaseDate);
		const dueDate = data.dueDate ? parseLocalDateString(data.dueDate) : null;

		const sharedPayload = {
			name: data.name,
			purchaseDate,
			transactionType: data.transactionType,
			condition: data.condition,
			paymentMethod: data.paymentMethod,
			accountId: data.accountId ?? null,
			cardId: data.cardId ?? null,
			categoryId: data.categoryId ?? null,
			partyId: party.partyId,
			note: data.note ?? null,
			dueDate,
			period,
			isSettled: normalizedSettled,
			boletoPaymentDate: boletoPaymentDateValue,
		};

		await db.transaction(async (tx: typeof db) => {
			await tx
				.update(transactions)
				.set({
					...sharedPayload,
					amount: normalizedAmount,
					payerId: data.payerId ?? null,
					installmentCount: data.installmentCount ?? null,
					recurrenceCount: data.recurrenceCount ?? null,
				})
				.where(
					and(eq(transactions.id, data.id), eq(transactions.userId, user.id)),
				);

			if (existing.splitGroupId) {
				await tx
					.update(transactions)
					.set(sharedPayload)
					.where(
						and(
							eq(transactions.splitGroupId, existing.splitGroupId),
							eq(transactions.userId, user.id),
							ne(transactions.id, data.id),
						),
					);
			}
		});

		revalidate(user.id);
		return { success: true, message: "Lançamentos atualizados com sucesso." };
	} catch (error) {
		return handleActionError(error);
	}
}

export async function toggleTransactionSettlementAction(
	input: ToggleSettlementInput,
): Promise<ActionResult> {
	try {
		const user = await getUser();
		const data = toggleSettlementSchema.parse(input);

		const existing = await db.query.transactions.findFirst({
			columns: {
				id: true,
				paymentMethod: true,
				accountId: true,
				transactionType: true,
			},
			where: and(
				eq(transactions.id, data.id),
				eq(transactions.userId, user.id),
			),
		});

		if (!existing) {
			return { success: false, error: "Lançamento não encontrado." };
		}

		if (existing.paymentMethod === "Cartão de crédito") {
			return {
				success: false,
				error: "Pagamentos com cartão são conciliados automaticamente.",
			};
		}

		const isBoleto = existing.paymentMethod === "Boleto";
		const isIncomeBill = isBoleto && existing.transactionType === "Receita";
		const customPaymentDate =
			isBoleto && data.value && data.paymentDate
				? parseLocalDateString(data.paymentDate)
				: null;
		const boletoPaymentDate = isBoleto
			? data.value
				? (customPaymentDate ?? getBusinessTodayDate())
				: null
			: null;

		const shouldUpdateAccount =
			isBoleto && data.value && data.paymentAccountId !== undefined;

		if (shouldUpdateAccount && data.paymentAccountId) {
			const paymentAccount = await db.query.financialAccounts.findFirst({
				columns: { id: true },
				where: and(
					eq(financialAccounts.id, data.paymentAccountId),
					eq(financialAccounts.userId, user.id),
				),
			});

			if (!paymentAccount) {
				return {
					success: false,
					error: `Conta de ${isIncomeBill ? "recebimento" : "pagamento"} não encontrada.`,
				};
			}
		}

		const updatePayload: {
			isSettled: boolean;
			boletoPaymentDate: Date | null;
			accountId?: string | null;
		} = {
			isSettled: data.value,
			boletoPaymentDate,
		};

		if (shouldUpdateAccount) {
			updatePayload.accountId = data.paymentAccountId ?? null;
		}

		await db
			.update(transactions)
			.set(updatePayload)
			.where(
				and(eq(transactions.id, data.id), eq(transactions.userId, user.id)),
			);

		revalidate(user.id);

		return {
			success: true,
			message: data.value
				? `Lançamento marcado como ${isIncomeBill ? "recebido" : "pago"}.`
				: `${isIncomeBill ? "Recebimento" : "Pagamento"} desfeito com sucesso.`,
		};
	} catch (error) {
		return handleActionError(error);
	}
}
