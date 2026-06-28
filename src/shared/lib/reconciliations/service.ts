import { and, eq } from "drizzle-orm";
import { financialTitles, inboxItems, transactions } from "@/db/schema";
import { db } from "@/shared/lib/db";
import { parseLocalDateString, toDateOnlyString } from "@/shared/utils/date";
import { matchFinancialTitleForTransaction } from "./matching";
import { buildSettlementUpdateFromTransaction } from "./settlement";
import type {
	ReconciliationSettlementTitle,
	ReconciliationStatus,
	ReconciliationTitleCandidate,
	ReconciliationTransactionCandidate,
} from "./types";

type ReconciliationResult = {
	status: ReconciliationStatus;
	reconciledTitleId: string | null;
	summary: string;
	attemptedAt: Date | null;
	resolvedAt: Date | null;
	dismissed: boolean;
	dismissedAt: Date | null;
};

const AUTO_RECONCILIATION_SUCCESS_SUMMARY =
	"Título conciliado automaticamente com o lançamento importado.";
const MANUAL_RECONCILIATION_SUMMARY =
	"Conciliação definida manualmente com um título existente.";
const DISMISSED_RECONCILIATION_SUMMARY =
	"Conciliação dispensada manualmente pelo usuário.";

const UNMATCHED_RECONCILIATION_SUMMARY =
	"Nenhum título pendente compatível foi encontrado pela regra automática.";

const resolveAmbiguousSummary = (candidateCount: number) =>
	`${candidateCount} títulos pendentes compatíveis foram encontrados e exigem revisão manual.`;

const isPendingReviewStatus = (status: string | null) =>
	status === "unmatched" || status === "ambiguous";

const mapTransactionCandidate = (
	row: typeof transactions.$inferSelect,
): ReconciliationTransactionCandidate | null => {
	if (row.transactionType !== "Despesa" && row.transactionType !== "Receita") {
		return null;
	}

	return {
		id: row.id,
		userId: row.userId,
		transactionType: row.transactionType,
		amount: Number(row.amount ?? 0),
		paymentMethod: row.paymentMethod,
		purchaseDate: toDateOnlyString(row.purchaseDate),
		categoryId: row.categoryId ?? null,
		partyId: row.partyId ?? null,
		accountId: row.accountId ?? null,
		name: row.name,
		note: row.note ?? null,
	};
};

const mapTitleCandidate = (
	row: typeof financialTitles.$inferSelect,
): ReconciliationTitleCandidate => ({
	id: row.id,
	userId: row.userId,
	type: row.type === "payable" ? "payable" : "receivable",
	status:
		row.status === "settled" || row.status === "cancelled"
			? row.status
			: "pending",
	amount: Number(row.amount ?? 0),
	dueDate: toDateOnlyString(row.dueDate) ?? "",
	paymentMethod: row.paymentMethod,
	categoryId: row.categoryId ?? null,
	partyId: row.partyId ?? null,
	accountId: row.accountId ?? null,
	name: row.name,
	description: row.description ?? null,
});

async function loadInboxTransactionContext({
	userId,
	inboxItemId,
	transactionId,
}: {
	userId: string;
	inboxItemId: string;
	transactionId: string;
}) {
	const [item, transaction] = await Promise.all([
		db.query.inboxItems.findFirst({
			where: and(eq(inboxItems.id, inboxItemId), eq(inboxItems.userId, userId)),
		}),
		db.query.transactions.findFirst({
			where: and(
				eq(transactions.id, transactionId),
				eq(transactions.userId, userId),
			),
		}),
	]);

	return { item, transaction };
}

async function applySettlementToTitle({
	userId,
	title,
	transaction,
	notificationDate,
}: {
	userId: string;
	title: ReconciliationSettlementTitle;
	transaction: ReconciliationTransactionCandidate;
	notificationDate: string;
}) {
	const settlement = buildSettlementUpdateFromTransaction({
		title,
		transaction,
		notificationDate,
	});

	await db
		.update(financialTitles)
		.set({
			status: settlement.status,
			settlementTransactionId: settlement.settlementTransactionId,
			settledAt: parseLocalDateString(settlement.settledAt),
			settledAmount: settlement.settledAmount,
			paymentMethod: settlement.paymentMethod,
			accountId: settlement.accountId,
			updatedAt: new Date(),
		})
		.where(
			and(eq(financialTitles.id, title.id), eq(financialTitles.userId, userId)),
		);
}

async function saveInboxReconciliationResult({
	inboxItemId,
	result,
}: {
	inboxItemId: string;
	result: ReconciliationResult;
}) {
	await db
		.update(inboxItems)
		.set({
			reconciliationStatus: result.status,
			reconciledTitleId: result.reconciledTitleId,
			reconciliationSummary: result.summary,
			reconciliationAttemptedAt: result.attemptedAt,
			reconciliationResolvedAt: result.resolvedAt,
			reconciliationDismissed: result.dismissed,
			reconciliationDismissedAt: result.dismissedAt,
			updatedAt: new Date(),
		})
		.where(eq(inboxItems.id, inboxItemId));
}

export async function attemptInboxItemAutoReconciliation({
	userId,
	inboxItemId,
	transactionId,
}: {
	userId: string;
	inboxItemId: string;
	transactionId: string;
}): Promise<ReconciliationResult> {
	const { item, transaction } = await loadInboxTransactionContext({
		userId,
		inboxItemId,
		transactionId,
	});

	if (!item || !transaction) {
		return {
			status: "unmatched",
			reconciledTitleId: null,
			summary: UNMATCHED_RECONCILIATION_SUMMARY,
			attemptedAt: null,
			resolvedAt: null,
			dismissed: false,
			dismissedAt: null,
		};
	}

	const transactionCandidate = mapTransactionCandidate(transaction);
	const attemptedAt = new Date();
	if (!transactionCandidate) {
		const result: ReconciliationResult = {
			status: "unmatched",
			reconciledTitleId: null,
			summary: UNMATCHED_RECONCILIATION_SUMMARY,
			attemptedAt,
			resolvedAt: null,
			dismissed: false,
			dismissedAt: null,
		};
		await saveInboxReconciliationResult({ inboxItemId, result });
		return result;
	}

	const candidateRows = await db.query.financialTitles.findMany({
		where: and(
			eq(financialTitles.userId, userId),
			eq(financialTitles.status, "pending"),
		),
	});

	const match = matchFinancialTitleForTransaction({
		transaction: transactionCandidate,
		titles: candidateRows.map(mapTitleCandidate),
	});

	if (match.status === "unmatched") {
		const result: ReconciliationResult = {
			status: "unmatched",
			reconciledTitleId: null,
			summary: UNMATCHED_RECONCILIATION_SUMMARY,
			attemptedAt,
			resolvedAt: null,
			dismissed: false,
			dismissedAt: null,
		};
		await saveInboxReconciliationResult({ inboxItemId, result });
		return result;
	}

	if (match.status === "ambiguous") {
		const result: ReconciliationResult = {
			status: "ambiguous",
			reconciledTitleId: null,
			summary: resolveAmbiguousSummary(match.candidates.length),
			attemptedAt,
			resolvedAt: null,
			dismissed: false,
			dismissedAt: null,
		};
		await saveInboxReconciliationResult({ inboxItemId, result });
		return result;
	}

	const settlementTitle: ReconciliationSettlementTitle = {
		id: match.matchedTitle.id,
		userId,
		accountId: match.matchedTitle.accountId,
	};
	const notificationDate =
		toDateOnlyString(item.notificationTimestamp) ??
		transactionCandidate.purchaseDate ??
		new Date().toISOString().slice(0, 10);

	await applySettlementToTitle({
		userId,
		title: settlementTitle,
		transaction: transactionCandidate,
		notificationDate,
	});

	const result: ReconciliationResult = {
		status: "reconciled",
		reconciledTitleId: settlementTitle.id,
		summary: AUTO_RECONCILIATION_SUCCESS_SUMMARY,
		attemptedAt,
		resolvedAt: attemptedAt,
		dismissed: false,
		dismissedAt: null,
	};
	await saveInboxReconciliationResult({ inboxItemId, result });
	return result;
}

export async function reconcileInboxItemWithTitle({
	userId,
	inboxItemId,
	titleId,
}: {
	userId: string;
	inboxItemId: string;
	titleId: string;
}): Promise<ReconciliationResult | null> {
	const item = await db.query.inboxItems.findFirst({
		where: and(eq(inboxItems.id, inboxItemId), eq(inboxItems.userId, userId)),
	});
	if (
		!item?.transactionId ||
		item.status !== "processed" ||
		item.reconciliationDismissed ||
		!isPendingReviewStatus(item.reconciliationStatus)
	) {
		return null;
	}

	const [transaction, title] = await Promise.all([
		db.query.transactions.findFirst({
			where: and(
				eq(transactions.id, item.transactionId),
				eq(transactions.userId, userId),
			),
		}),
		db.query.financialTitles.findFirst({
			where: and(
				eq(financialTitles.id, titleId),
				eq(financialTitles.userId, userId),
			),
		}),
	]);

	const transactionCandidate = transaction
		? mapTransactionCandidate(transaction)
		: null;
	if (!item || !title || !transactionCandidate) {
		return null;
	}

	if (title.status !== "pending") {
		return null;
	}

	const expectedType =
		transactionCandidate.transactionType === "Despesa"
			? "payable"
			: "receivable";
	if (title.type !== expectedType) {
		return null;
	}

	await applySettlementToTitle({
		userId,
		title: {
			id: title.id,
			userId,
			accountId: title.accountId ?? null,
		},
		transaction: transactionCandidate,
		notificationDate:
			toDateOnlyString(item.notificationTimestamp) ??
			new Date().toISOString().slice(0, 10),
	});

	const resolvedAt = new Date();
	const result: ReconciliationResult = {
		status: "reconciled",
		reconciledTitleId: title.id,
		summary: MANUAL_RECONCILIATION_SUMMARY,
		attemptedAt: item.reconciliationAttemptedAt ?? resolvedAt,
		resolvedAt,
		dismissed: false,
		dismissedAt: null,
	};
	await saveInboxReconciliationResult({ inboxItemId, result });
	return result;
}

export async function dismissInboxItemReconciliation({
	userId,
	inboxItemId,
}: {
	userId: string;
	inboxItemId: string;
}): Promise<ReconciliationResult | null> {
	const item = await db.query.inboxItems.findFirst({
		where: and(eq(inboxItems.id, inboxItemId), eq(inboxItems.userId, userId)),
	});
	if (
		item?.status !== "processed" ||
		item.reconciliationDismissed ||
		!isPendingReviewStatus(item.reconciliationStatus)
	) {
		return null;
	}

	const resolvedAt = new Date();
	const result: ReconciliationResult = {
		status: "dismissed",
		reconciledTitleId: item.reconciledTitleId ?? null,
		summary: DISMISSED_RECONCILIATION_SUMMARY,
		attemptedAt: item.reconciliationAttemptedAt ?? resolvedAt,
		resolvedAt,
		dismissed: true,
		dismissedAt: resolvedAt,
	};
	await saveInboxReconciliationResult({ inboxItemId, result });
	return result;
}
