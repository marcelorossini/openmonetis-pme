export type ReconciliationStatus =
	| "reconciled"
	| "unmatched"
	| "ambiguous"
	| "dismissed";

export type ReconciliationTransactionType = "Despesa" | "Receita";
export type ReconciliationTitleType = "payable" | "receivable";

export type ReconciliationTransactionCandidate = {
	id: string;
	userId: string;
	transactionType: ReconciliationTransactionType;
	amount: number;
	paymentMethod: string;
	purchaseDate: string | null;
	categoryId: string | null;
	partyId: string | null;
	accountId: string | null;
	name: string | null;
	note: string | null;
};

export type ReconciliationTitleCandidate = {
	id: string;
	userId: string;
	type: ReconciliationTitleType;
	status: "pending" | "settled" | "cancelled";
	amount: number;
	dueDate: string;
	paymentMethod: string;
	categoryId: string | null;
	partyId: string | null;
	accountId: string | null;
	name: string;
	description: string | null;
};

export type ReconciliationSettlementTitle = {
	id: string;
	userId: string;
	accountId: string | null;
};

export type ReconciliationSettlementUpdate = {
	status: "settled";
	settlementTransactionId: string;
	settledAt: string;
	settledAmount: string;
	paymentMethod: string;
	accountId: string | null;
};
