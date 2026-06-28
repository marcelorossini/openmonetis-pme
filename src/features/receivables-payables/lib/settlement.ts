import type { FinancialTitleType } from "@/features/receivables-payables/types";
import { formatDecimalForDbRequired } from "@/shared/utils/currency";
import { parseLocalDateString } from "@/shared/utils/date";
import { deriveTitlePeriodFromDate } from "./status";

export const FINANCIAL_TITLE_SETTLEMENT_NOTE_PREFIX = "Baixa do título:";

type BuildSettlementTransactionInput = {
	title: {
		type: FinancialTitleType;
		name: string;
		description: string | null;
		dueDate: string;
		categoryId: string | null;
		partyId: string | null;
		payerId: string | null;
	};
	userId: string;
	accountId: string;
	paymentMethod: string;
	settledAt: string;
	settledAmount: number;
};

export function buildSettlementTransactionValues({
	title,
	userId,
	accountId,
	paymentMethod,
	settledAt,
	settledAmount,
}: BuildSettlementTransactionInput) {
	const signedAmount =
		title.type === "payable"
			? -Math.abs(settledAmount)
			: Math.abs(settledAmount);

	const noteParts = [FINANCIAL_TITLE_SETTLEMENT_NOTE_PREFIX, title.name];
	if (title.description) {
		noteParts.push(`| ${title.description}`);
	}

	return {
		userId,
		name: title.name,
		condition: "À vista",
		paymentMethod,
		note: noteParts.join(" "),
		amount: formatDecimalForDbRequired(signedAmount),
		purchaseDate: parseLocalDateString(settledAt),
		transactionType: title.type === "payable" ? "Despesa" : "Receita",
		period: deriveTitlePeriodFromDate(settledAt),
		dueDate: parseLocalDateString(title.dueDate),
		boletoPaymentDate:
			paymentMethod === "Boleto" ? parseLocalDateString(settledAt) : null,
		isSettled: true,
		accountId,
		categoryId: title.categoryId,
		partyId: title.partyId,
		payerId: title.payerId,
	};
}
