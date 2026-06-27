import { randomUUID } from "node:crypto";
import { transactions } from "@/db/schema";
import { handleActionError } from "@/shared/lib/actions/helpers";
import { db } from "@/shared/lib/db";
import {
	buildEntriesByPayer,
	sendPayerAutoEmails,
} from "@/shared/lib/payers/notifications";
import type { ActionResult } from "@/shared/lib/types/actions";
import {
	getBusinessTodayDate,
	parseLocalDateString,
} from "@/shared/utils/date";
import { copyAttachmentsForImport } from "../lib/attachment-copy";
import {
	buildShares,
	buildTransactionRecords,
	type CreateInput,
	createSchema,
	formatPaidInvoicePeriods,
	getPaidInvoicePeriods,
	resolvePartyForTransaction,
	resolvePeriod,
	revalidate,
	validateAllOwnership,
	validateCardLimit,
} from "./core";

type CreateTransactionForUserInput = {
	userId: string;
	userLabel: string;
	input: CreateInput;
};

export async function createTransactionForUser({
	userId,
	userLabel,
	input,
}: CreateTransactionForUserInput): Promise<ActionResult<{ ids: string[] }>> {
	try {
		const data = createSchema.parse(input);
		const party = await resolvePartyForTransaction(userId, data);
		if (!party.ok) {
			return { success: false, error: party.error };
		}

		const ownershipError = await validateAllOwnership(userId, {
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

		const period = resolvePeriod(data.purchaseDate, data.period);
		const purchaseDate = parseLocalDateString(data.purchaseDate);
		const dueDate = data.dueDate ? parseLocalDateString(data.dueDate) : null;
		const shouldSetBoletoPaymentDate =
			data.paymentMethod === "Boleto" && (data.isSettled ?? false);
		const boletoPaymentDate = shouldSetBoletoPaymentDate
			? data.boletoPaymentDate
				? parseLocalDateString(data.boletoPaymentDate)
				: getBusinessTodayDate()
			: null;

		const amountSign: 1 | -1 = data.transactionType === "Despesa" ? -1 : 1;
		const totalCents = Math.round(Math.abs(data.amount) * 100);
		const shouldNullifySettled = data.paymentMethod === "Cartão de crédito";

		const shares = buildShares({
			totalCents,
			payerId: data.payerId ?? null,
			isSplit: data.isSplit ?? false,
			secondaryPayerId: data.secondaryPayerId,
			splitShares: data.splitShares,
			primarySplitAmountCents: data.primarySplitAmount
				? Math.round(data.primarySplitAmount * 100)
				: undefined,
			secondarySplitAmountCents: data.secondarySplitAmount
				? Math.round(data.secondarySplitAmount * 100)
				: undefined,
		});

		const isSeriesTransaction =
			data.condition === "Parcelado" || data.condition === "Recorrente";
		const seriesId = isSeriesTransaction ? randomUUID() : null;

		const records = buildTransactionRecords({
			data,
			userId,
			period,
			purchaseDate,
			dueDate,
			shares,
			amountSign,
			shouldNullifySettled,
			boletoPaymentDate,
			seriesId,
			categoryPartyKind: party.categoryPartyKind,
		});

		if (!records.length) {
			throw new Error("Não foi possível criar os lançamentos solicitados.");
		}

		if (data.cardId) {
			const uniquePeriods = [
				...new Set(
					records.map((record) => record.period).filter(Boolean) as string[],
				),
			];

			const paidPeriods = await getPaidInvoicePeriods(
				userId,
				data.cardId,
				uniquePeriods,
			);

			if (paidPeriods.length > 0) {
				return {
					success: false,
					error: `As faturas dos meses ${formatPaidInvoicePeriods(
						paidPeriods,
					)} já estão pagas. Desfaça o pagamento antes de adicionar este lançamento.`,
				};
			}

			if (data.transactionType === "Despesa") {
				const limitCheck = await validateCardLimit({
					userId,
					cardId: data.cardId,
					addAmount: Math.abs(data.amount),
				});
				if (!limitCheck.ok) {
					return { success: false, error: limitCheck.error };
				}
			}
		}

		const inserted = await db
			.insert(transactions)
			.values(records)
			.returning({ id: transactions.id });

		if (data.importFromTransactionId && inserted.length > 0) {
			await copyAttachmentsForImport({
				sourceTransactionId: data.importFromTransactionId,
				targetTransactionIds: inserted.map((record) => record.id),
				targetUserId: userId,
			});
		}

		const notificationEntries = buildEntriesByPayer(
			records.map((record) => ({
				payerId: record.payerId ?? null,
				name: record.name ?? null,
				amount: record.amount ?? null,
				transactionType: record.transactionType ?? null,
				paymentMethod: record.paymentMethod ?? null,
				condition: record.condition ?? null,
				purchaseDate: record.purchaseDate ?? null,
				period: record.period ?? null,
				note: record.note ?? null,
			})),
		);

		if (notificationEntries.size > 0) {
			await sendPayerAutoEmails({
				userLabel,
				action: "created",
				entriesByPayer: notificationEntries,
			});
		}

		revalidate(userId);

		return {
			success: true,
			message: "Lançamento criado com sucesso.",
			data: { ids: inserted.map((record) => record.id) },
		};
	} catch (error) {
		return handleActionError(error) as ActionResult<{ ids: string[] }>;
	}
}
