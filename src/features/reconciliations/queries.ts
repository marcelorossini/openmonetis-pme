import { and, asc, count, desc, eq, or } from "drizzle-orm";
import { financialTitles, inboxItems } from "@/db/schema";
import { db } from "@/shared/lib/db";
import { matchFinancialTitleForTransaction } from "@/shared/lib/reconciliations/matching";
import type {
	ReconciliationTitleCandidate,
	ReconciliationTransactionCandidate,
} from "@/shared/lib/reconciliations/types";
import { toDateOnlyString } from "@/shared/utils/date";
import type {
	ReconciliationCandidateItem,
	ReconciliationFilterStatus,
	ReconciliationQueueItem,
	ReconciliationStatusCounts,
	ReconciliationsPageData,
} from "./types";

const RECONCILIATIONS_PAGE_SIZE = 10;
const EXPANDED_CANDIDATES_LIMIT = 5;

const unresolvedReviewWhere = (
	userId: string,
	status?: ReconciliationFilterStatus,
) =>
	and(
		eq(inboxItems.userId, userId),
		eq(inboxItems.status, "processed"),
		eq(inboxItems.autoImportRequested, true),
		eq(inboxItems.reconciliationDismissed, false),
		or(
			eq(inboxItems.reconciliationStatus, "unmatched"),
			eq(inboxItems.reconciliationStatus, "ambiguous"),
		),
		status && status !== "all"
			? eq(inboxItems.reconciliationStatus, status)
			: undefined,
	);

const mapTransactionCandidate = (
	item: ReconciliationQueueItem["transactionType"] extends infer _T
		? {
				id: string;
				userId: string;
				name: string;
				note: string | null;
				amount: string;
				transactionType: string;
				paymentMethod: string;
				purchaseDate: Date;
				categoryId: string | null;
				partyId: string | null;
				accountId: string | null;
			}
		: never,
): ReconciliationTransactionCandidate | null => {
	if (
		item.transactionType !== "Despesa" &&
		item.transactionType !== "Receita"
	) {
		return null;
	}

	return {
		id: item.id,
		userId: item.userId,
		name: item.name,
		note: item.note,
		amount: Number(item.amount ?? 0),
		transactionType: item.transactionType,
		paymentMethod: item.paymentMethod,
		purchaseDate: toDateOnlyString(item.purchaseDate),
		categoryId: item.categoryId,
		partyId: item.partyId,
		accountId: item.accountId,
	};
};

const mapTitleCandidate = (
	row: typeof financialTitles.$inferSelect & {
		financialAccount: { name: string } | null;
		category: { name: string } | null;
		party: { name: string } | null;
	},
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

const mapCandidateItem = (
	row: typeof financialTitles.$inferSelect & {
		financialAccount: { name: string } | null;
		category: { name: string } | null;
		party: { name: string } | null;
	},
): ReconciliationCandidateItem => ({
	id: row.id,
	name: row.name,
	description: row.description ?? null,
	amount: Number(row.amount ?? 0),
	dueDate: toDateOnlyString(row.dueDate) ?? "",
	paymentMethod: row.paymentMethod,
	partyName: row.party?.name ?? null,
	categoryName: row.category?.name ?? null,
	accountName: row.financialAccount?.name ?? null,
});

const resolveExpandedCandidates = ({
	transaction,
	titleRows,
	excludedIds,
}: {
	transaction: ReconciliationTransactionCandidate;
	titleRows: Array<
		typeof financialTitles.$inferSelect & {
			financialAccount: { name: string } | null;
			category: { name: string } | null;
			party: { name: string } | null;
		}
	>;
	excludedIds: Set<string>;
}) =>
	titleRows
		.filter((row) => {
			if (excludedIds.has(row.id)) return false;
			if (row.status !== "pending") return false;
			if (row.userId !== transaction.userId) return false;

			const expectedType =
				transaction.transactionType === "Despesa" ? "payable" : "receivable";
			if (row.type !== expectedType) return false;

			const samePaymentMethod = row.paymentMethod === transaction.paymentMethod;
			const sameAmount =
				Number(row.amount ?? 0) === Math.abs(transaction.amount);
			const sameCategory =
				Boolean(row.categoryId) && row.categoryId === transaction.categoryId;
			const sameParty =
				Boolean(row.partyId) && row.partyId === transaction.partyId;
			const sameAccount =
				Boolean(row.accountId) && row.accountId === transaction.accountId;

			return (
				samePaymentMethod ||
				sameAmount ||
				sameCategory ||
				sameParty ||
				sameAccount
			);
		})
		.map((row) => {
			const dueDate = toDateOnlyString(row.dueDate);
			const referenceDate = transaction.purchaseDate;
			const dueDistance =
				dueDate && referenceDate
					? Math.abs(
							new Date(`${dueDate}T00:00:00Z`).getTime() -
								new Date(`${referenceDate}T00:00:00Z`).getTime(),
						)
					: Number.MAX_SAFE_INTEGER;

			let score = 0;
			if (Number(row.amount ?? 0) === Math.abs(transaction.amount)) score += 4;
			if (row.paymentMethod === transaction.paymentMethod) score += 3;
			if (row.categoryId && row.categoryId === transaction.categoryId)
				score += 2;
			if (row.partyId && row.partyId === transaction.partyId) score += 2;
			if (row.accountId && row.accountId === transaction.accountId) score += 2;

			return {
				row,
				score,
				dueDistance,
			};
		})
		.sort(
			(left, right) =>
				right.score - left.score || left.dueDistance - right.dueDistance,
		)
		.slice(0, EXPANDED_CANDIDATES_LIMIT)
		.map(({ row }) => mapCandidateItem(row));

async function fetchCounts(
	userId: string,
): Promise<ReconciliationStatusCounts> {
	const rows = await db
		.select({
			status: inboxItems.reconciliationStatus,
			total: count(),
		})
		.from(inboxItems)
		.where(unresolvedReviewWhere(userId))
		.groupBy(inboxItems.reconciliationStatus);

	const counts: ReconciliationStatusCounts = {
		unmatched: 0,
		ambiguous: 0,
		total: 0,
	};

	for (const row of rows) {
		if (row.status === "unmatched" || row.status === "ambiguous") {
			counts[row.status] = Number(row.total ?? 0);
			counts.total += Number(row.total ?? 0);
		}
	}

	return counts;
}

export async function fetchReconciliationsPage({
	userId,
	status,
	page,
	pageSize = RECONCILIATIONS_PAGE_SIZE,
}: {
	userId: string;
	status: ReconciliationFilterStatus;
	page: number;
	pageSize?: number;
}): Promise<ReconciliationsPageData> {
	const [countRow] = await db
		.select({ total: count() })
		.from(inboxItems)
		.where(unresolvedReviewWhere(userId, status));

	const totalItems = Number(countRow?.total ?? 0);
	const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
	const currentPage = Math.min(Math.max(page, 1), totalPages);
	const offset = (currentPage - 1) * pageSize;

	const [counts, rows, pendingTitleRows] = await Promise.all([
		fetchCounts(userId),
		db.query.inboxItems.findMany({
			where: unresolvedReviewWhere(userId, status),
			orderBy: [
				desc(inboxItems.reconciliationAttemptedAt),
				desc(inboxItems.processedAt),
				desc(inboxItems.createdAt),
			],
			limit: pageSize,
			offset,
			with: {
				transaction: {
					with: {
						financialAccount: true,
						category: true,
						party: true,
					},
				},
			},
		}),
		db.query.financialTitles.findMany({
			where: and(
				eq(financialTitles.userId, userId),
				eq(financialTitles.status, "pending"),
			),
			orderBy: [asc(financialTitles.dueDate), asc(financialTitles.createdAt)],
			with: {
				financialAccount: true,
				category: true,
				party: true,
			},
		}),
	]);

	const items: ReconciliationQueueItem[] = rows
		.map((row) => {
			const transaction = row.transaction;
			if (!transaction) return null;

			const transactionCandidate = mapTransactionCandidate({
				id: transaction.id,
				userId: transaction.userId,
				name: transaction.name,
				note: transaction.note ?? null,
				amount: transaction.amount,
				transactionType: transaction.transactionType,
				paymentMethod: transaction.paymentMethod,
				purchaseDate: transaction.purchaseDate,
				categoryId: transaction.categoryId ?? null,
				partyId: transaction.partyId ?? null,
				accountId: transaction.accountId ?? null,
			});
			if (!transactionCandidate) return null;

			const match = matchFinancialTitleForTransaction({
				transaction: transactionCandidate,
				titles: pendingTitleRows.map(mapTitleCandidate),
			});
			const exactCandidates = match.candidates.map((candidate) => {
				const source = pendingTitleRows.find(
					(rowCandidate) => rowCandidate.id === candidate.id,
				);
				return source ? mapCandidateItem(source) : null;
			});
			const exactCandidateItems = exactCandidates.filter(
				(candidate): candidate is ReconciliationCandidateItem =>
					candidate !== null,
			);

			return {
				id: row.id,
				sourceApp: row.sourceApp,
				sourceAppName: row.sourceAppName,
				originalTitle: row.originalTitle,
				originalText: row.originalText,
				parsedName: row.parsedName,
				parsedAmount:
					row.parsedAmount === null || row.parsedAmount === undefined
						? null
						: Number(row.parsedAmount),
				notificationTimestamp: row.notificationTimestamp,
				reconciliationStatus:
					row.reconciliationStatus === "ambiguous" ? "ambiguous" : "unmatched",
				reconciliationSummary: row.reconciliationSummary,
				transactionId: transaction.id,
				transactionName: transaction.name,
				transactionAmount: Number(transaction.amount ?? 0),
				transactionType: transaction.transactionType,
				transactionPaymentMethod: transaction.paymentMethod,
				transactionPurchaseDate: toDateOnlyString(transaction.purchaseDate),
				transactionAccountName: transaction.financialAccount?.name ?? null,
				transactionCategoryName: transaction.category?.name ?? null,
				transactionPartyName: transaction.party?.name ?? null,
				exactCandidates: exactCandidateItems,
				expandedCandidates: resolveExpandedCandidates({
					transaction: transactionCandidate,
					titleRows: pendingTitleRows,
					excludedIds: new Set(
						exactCandidateItems.map((candidate) => candidate.id),
					),
				}),
			};
		})
		.filter((item): item is ReconciliationQueueItem => item !== null);

	return {
		items,
		counts,
		pagination: {
			page: currentPage,
			pageSize,
			totalItems,
			totalPages,
		},
		activeStatus: status,
	};
}
