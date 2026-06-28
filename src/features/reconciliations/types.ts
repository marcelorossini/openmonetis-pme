export type ReconciliationFilterStatus = "all" | "unmatched" | "ambiguous";

export type ReconciliationCandidateItem = {
	id: string;
	name: string;
	description: string | null;
	amount: number;
	dueDate: string;
	paymentMethod: string;
	partyName: string | null;
	categoryName: string | null;
	accountName: string | null;
};

export type ReconciliationQueueItem = {
	id: string;
	sourceApp: string;
	sourceAppName: string | null;
	originalTitle: string | null;
	originalText: string;
	parsedName: string | null;
	parsedAmount: number | null;
	notificationTimestamp: Date;
	reconciliationStatus: "unmatched" | "ambiguous";
	reconciliationSummary: string | null;
	transactionId: string;
	transactionName: string;
	transactionAmount: number;
	transactionType: "Despesa" | "Receita";
	transactionPaymentMethod: string;
	transactionPurchaseDate: string | null;
	transactionAccountName: string | null;
	transactionCategoryName: string | null;
	transactionPartyName: string | null;
	exactCandidates: ReconciliationCandidateItem[];
	expandedCandidates: ReconciliationCandidateItem[];
};

export type ReconciliationStatusCounts = {
	unmatched: number;
	ambiguous: number;
	total: number;
};

export type ReconciliationPagination = {
	page: number;
	pageSize: number;
	totalItems: number;
	totalPages: number;
};

export type ReconciliationsPageData = {
	items: ReconciliationQueueItem[];
	counts: ReconciliationStatusCounts;
	pagination: ReconciliationPagination;
	activeStatus: ReconciliationFilterStatus;
};
