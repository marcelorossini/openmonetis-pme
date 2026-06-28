import type { SelectOption as TransactionSelectOption } from "@/features/transactions/components/types";

export type InboxStatus = "pending" | "processed" | "discarded";

export interface InboxItem {
	id: string;
	sourceApp: string;
	sourceAppName: string | null;
	profileKey: string | null;
	originalTitle: string | null;
	originalText: string;
	notificationTimestamp: Date;
	parsedName: string | null;
	parsedAmount: string | null;
	purchaseDate: Date | null;
	transactionType: string | null;
	paymentMethod: string | null;
	accountId: string | null;
	accountExternalKey: string | null;
	cardId: string | null;
	categoryId: string | null;
	categoryExternalKey: string | null;
	payerId: string | null;
	partyId: string | null;
	partyExternalKey: string | null;
	autoImportRequested: boolean;
	autoImportError: string | null;
	reconciliationStatus: string | null;
	reconciledTitleId: string | null;
	reconciliationSummary: string | null;
	reconciliationAttemptedAt: Date | null;
	reconciliationResolvedAt: Date | null;
	reconciliationDismissed: boolean;
	reconciliationDismissedAt: Date | null;
	status: string;
	transactionId: string | null;
	processedAt: Date | null;
	discardedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

export type InboxStatusCounts = Record<InboxStatus, number>;

export type InboxPaginationState = {
	page: number;
	pageSize: number;
	totalItems: number;
	totalPages: number;
};

// Re-export the lancamentos SelectOption for use in inbox components
export type SelectOption = TransactionSelectOption;
