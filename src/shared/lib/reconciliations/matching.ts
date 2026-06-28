import { parseUtcDateString } from "@/shared/utils/date";
import type {
	ReconciliationTitleCandidate,
	ReconciliationTitleType,
	ReconciliationTransactionCandidate,
} from "./types";

const AUTO_RECONCILIATION_WINDOW_DAYS = 7;

const isDueDateWithinWindow = ({
	dueDate,
	referenceDate,
	daysWindow,
}: {
	dueDate: string;
	referenceDate: string;
	daysWindow: number;
}) => {
	const dueDateValue = parseUtcDateString(dueDate);
	const referenceDateValue = parseUtcDateString(referenceDate);
	if (!dueDateValue || !referenceDateValue) {
		return false;
	}

	const differenceInDays = Math.abs(
		(dueDateValue.getTime() - referenceDateValue.getTime()) /
			(1000 * 60 * 60 * 24),
	);

	return differenceInDays <= daysWindow;
};

const resolveTitleTypeForTransaction = (
	transactionType: ReconciliationTransactionCandidate["transactionType"],
): ReconciliationTitleType =>
	transactionType === "Despesa" ? "payable" : "receivable";

const hasExactOptionalFieldConflict = (
	transactionValue: string | null,
	titleValue: string | null,
) => Boolean(transactionValue && titleValue && transactionValue !== titleValue);

const isMatchingTitle = ({
	transaction,
	title,
}: {
	transaction: ReconciliationTransactionCandidate;
	title: ReconciliationTitleCandidate;
}) => {
	if (title.status !== "pending") return false;
	if (title.userId !== transaction.userId) return false;
	if (
		title.type !== resolveTitleTypeForTransaction(transaction.transactionType)
	) {
		return false;
	}

	if (Math.abs(transaction.amount) !== title.amount) return false;
	if (transaction.paymentMethod !== title.paymentMethod) return false;

	if (
		hasExactOptionalFieldConflict(transaction.categoryId, title.categoryId) ||
		hasExactOptionalFieldConflict(transaction.partyId, title.partyId) ||
		hasExactOptionalFieldConflict(transaction.accountId, title.accountId)
	) {
		return false;
	}

	if (!transaction.purchaseDate) return false;

	return isDueDateWithinWindow({
		referenceDate: transaction.purchaseDate,
		dueDate: title.dueDate,
		daysWindow: AUTO_RECONCILIATION_WINDOW_DAYS,
	});
};

export function matchFinancialTitleForTransaction({
	transaction,
	titles,
}: {
	transaction: ReconciliationTransactionCandidate;
	titles: ReconciliationTitleCandidate[];
}):
	| {
			status: "reconciled";
			matchedTitle: ReconciliationTitleCandidate;
			candidates: ReconciliationTitleCandidate[];
	  }
	| {
			status: "unmatched";
			candidates: [];
	  }
	| {
			status: "ambiguous";
			candidates: ReconciliationTitleCandidate[];
	  } {
	const candidates = titles.filter((title) =>
		isMatchingTitle({
			transaction,
			title,
		}),
	);

	if (candidates.length === 0) {
		return {
			status: "unmatched",
			candidates: [],
		};
	}

	if (candidates.length === 1) {
		return {
			status: "reconciled",
			matchedTitle: candidates[0],
			candidates,
		};
	}

	return {
		status: "ambiguous",
		candidates,
	};
}
