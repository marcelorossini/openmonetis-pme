import type {
	FinancialTitleComputedStatus,
	FinancialTitleStatus,
} from "@/features/receivables-payables/types";
import { getBusinessDateString, isDateOnlyPast } from "@/shared/utils/date";

type StatusInput = {
	status: FinancialTitleStatus;
	dueDate: string | null;
	referenceDate?: string;
};

export function deriveTitlePeriodFromDate(date: string): string {
	return date.slice(0, 7);
}

export function getComputedFinancialTitleStatus({
	status,
	dueDate,
	referenceDate = getBusinessDateString(),
}: StatusInput): FinancialTitleComputedStatus {
	if (status === "settled" || status === "cancelled") {
		return status;
	}

	if (dueDate && isDateOnlyPast(dueDate, referenceDate)) {
		return "overdue";
	}

	return "pending";
}
