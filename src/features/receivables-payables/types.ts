import type { PAYMENT_METHODS } from "@/features/transactions/lib/constants";

export const FINANCIAL_TITLE_TYPES = ["receivable", "payable"] as const;
export const FINANCIAL_TITLE_STATUSES = [
	"pending",
	"settled",
	"cancelled",
] as const;
export const FINANCIAL_TITLE_SERIES_ROLES = ["origin", "occurrence"] as const;
export const FINANCIAL_TITLE_SERIES_FREQUENCIES = ["monthly"] as const;
export const FINANCIAL_TITLE_EDIT_SCOPES = ["single", "this_and_next"] as const;

export type FinancialTitleType = (typeof FINANCIAL_TITLE_TYPES)[number];
export type FinancialTitleStatus = (typeof FINANCIAL_TITLE_STATUSES)[number];
export type FinancialTitleSeriesRole =
	(typeof FINANCIAL_TITLE_SERIES_ROLES)[number];
export type FinancialTitleSeriesFrequency =
	(typeof FINANCIAL_TITLE_SERIES_FREQUENCIES)[number];
export type FinancialTitleEditScope =
	(typeof FINANCIAL_TITLE_EDIT_SCOPES)[number];

export type FinancialTitleComputedStatus = FinancialTitleStatus | "overdue";

export type FinancialTitleRecurrenceSettings = {
	frequency: FinancialTitleSeriesFrequency;
	generateRetroactive: boolean;
	endDate: string | null;
};

export type FinancialTitleListItem = {
	id: string;
	type: FinancialTitleType;
	status: FinancialTitleStatus;
	name: string;
	description: string | null;
	amount: number;
	dueDate: string;
	competencePeriod: string;
	paymentMethod: string;
	partyId: string | null;
	partyName: string | null;
	partyKind: string | null;
	categoryId: string | null;
	categoryName: string | null;
	categoryType: string | null;
	categoryIcon: string | null;
	accountId: string | null;
	accountName: string | null;
	accountLogo: string | null;
	payerId: string | null;
	payerName: string | null;
	settledAt: string | null;
	settledAmount: number | null;
	settlementTransactionId: string | null;
	cancelledAt: string | null;
	computedStatus: FinancialTitleComputedStatus;
	isRecurring: boolean;
	seriesId: string | null;
	seriesRole: FinancialTitleSeriesRole | null;
	seriesFrequency: FinancialTitleSeriesFrequency | null;
	seriesIndex: number | null;
	seriesStartDate: string | null;
	seriesEndDate: string | null;
	seriesAnchorDay: number | null;
	seriesGeneratedThrough: string | null;
};

export type FinancialTitleSummary = {
	totalReceivablePending: number;
	totalPayablePending: number;
	projectedBalance: number;
	overdueCount: number;
	settledInPeriod: number;
};

export type FinancialTitlesPaginationState = {
	page: number;
	pageSize: number;
	totalItems: number;
	totalPages: number;
};

export type FinancialTitleFormValues = {
	type: FinancialTitleType;
	name: string;
	description: string;
	amount: string;
	dueDate: string;
	paymentMethod: (typeof PAYMENT_METHODS)[number];
	partyId: string;
	categoryId: string;
	accountId: string;
	payerId: string;
	isRecurring: boolean;
	generateRetroactive: boolean;
	recurrenceEndDate: string;
	editScope: FinancialTitleEditScope;
};

export type FinancialTitleSettlementFormValues = {
	accountId: string;
	paymentMethod: (typeof PAYMENT_METHODS)[number];
	settledAt: string;
	settledAmount: string;
};

export type FinancialTitleSeriesBoundaryFormValues = {
	endDate: string;
};
