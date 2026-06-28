import { formatDecimalForDbRequired } from "@/shared/utils/currency";
import type {
	ReconciliationSettlementTitle,
	ReconciliationTransactionCandidate,
} from "./types";

export function buildSettlementUpdateFromTransaction({
	title,
	transaction,
	notificationDate,
}: {
	title: ReconciliationSettlementTitle;
	transaction: ReconciliationTransactionCandidate;
	notificationDate: string;
}) {
	return {
		status: "settled" as const,
		settlementTransactionId: transaction.id,
		settledAt: transaction.purchaseDate ?? notificationDate,
		settledAmount: formatDecimalForDbRequired(Math.abs(transaction.amount)),
		paymentMethod: transaction.paymentMethod,
		accountId: transaction.accountId ?? title.accountId,
	};
}
