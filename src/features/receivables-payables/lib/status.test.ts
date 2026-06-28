import assert from "node:assert/strict";
import type { FinancialTitleComputedStatus } from "../types";
import {
	deriveTitlePeriodFromDate,
	getComputedFinancialTitleStatus,
} from "./status";

const expectStatus = (
	actual: FinancialTitleComputedStatus,
	expected: FinancialTitleComputedStatus,
	message: string,
) => {
	assert.equal(actual, expected, message);
};

expectStatus(
	getComputedFinancialTitleStatus({
		status: "pending",
		dueDate: "2026-06-05",
	}),
	"overdue",
	"titulo pendente com vencimento anterior deve ficar atrasado.",
);

expectStatus(
	getComputedFinancialTitleStatus({
		status: "pending",
		dueDate: "2099-06-05",
	}),
	"pending",
	"titulo pendente com vencimento futuro deve permanecer pendente.",
);

expectStatus(
	getComputedFinancialTitleStatus({
		status: "settled",
		dueDate: "2026-06-05",
	}),
	"settled",
	"titulo baixado deve permanecer baixado independentemente do vencimento.",
);

expectStatus(
	getComputedFinancialTitleStatus({
		status: "cancelled",
		dueDate: "2026-06-05",
	}),
	"cancelled",
	"titulo cancelado deve permanecer cancelado.",
);

assert.equal(
	deriveTitlePeriodFromDate("2026-07-19"),
	"2026-07",
	"o periodo deve ser derivado da data no formato YYYY-MM.",
);
