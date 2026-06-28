import { and, asc, eq, gte, lte } from "drizzle-orm";
import {
	type categories,
	type financialAccounts,
	financialTitles,
	type parties,
	type payers,
} from "@/db/schema";
import { ensureRecurringFinancialTitleCoverage } from "@/features/receivables-payables/lib/recurring-series-service";
import { getComputedFinancialTitleStatus } from "@/features/receivables-payables/lib/status";
import {
	extractFinancialTitleSearchFilters,
	type FinancialTitleSearchFilters,
	resolveFinancialTitlePagination,
} from "@/features/receivables-payables/lib/title-filters";
import type {
	FinancialTitleComputedStatus,
	FinancialTitleListItem,
	FinancialTitleSummary,
	FinancialTitlesPaginationState,
} from "@/features/receivables-payables/types";
import type { SelectOption } from "@/features/transactions/components/types";
import {
	buildOptionSets,
	buildSluggedFilters,
	type ResolvedSearchParams,
} from "@/features/transactions/lib/page-helpers";
import { fetchTransactionFilterSources } from "@/features/transactions/queries";
import { db } from "@/shared/lib/db";
import {
	getBusinessDateString,
	isDateOnlyWithinDays,
	toDateOnlyString,
} from "@/shared/utils/date";
import { parsePeriod } from "@/shared/utils/period";

type FinancialTitleWithRelations = typeof financialTitles.$inferSelect & {
	party: typeof parties.$inferSelect | null;
	category: typeof categories.$inferSelect | null;
	financialAccount: typeof financialAccounts.$inferSelect | null;
	payer: typeof payers.$inferSelect | null;
};

type FinancialTitleOptions = {
	payerOptions: SelectOption[];
	defaultPayerId: string | null;
	partyOptions: SelectOption[];
	categoryOptions: SelectOption[];
	accountOptions: SelectOption[];
};

export type FinancialTitlesPageData = {
	titles: FinancialTitleListItem[];
	summary: FinancialTitleSummary;
	filters: FinancialTitleSearchFilters;
	options: FinancialTitleOptions;
	pagination: FinancialTitlesPaginationState;
};

export type DashboardFinancialTitlesSnapshot = {
	totalReceivablePending: number;
	totalPayablePending: number;
	projectedBalance: number;
	overdueCount: number;
	dueTodayCount: number;
	upcomingCount: number;
	items: FinancialTitleListItem[];
};

const mapFinancialTitleRow = (
	row: FinancialTitleWithRelations,
): FinancialTitleListItem => {
	const dueDate = toDateOnlyString(row.dueDate) ?? "";
	const settledAt = toDateOnlyString(row.settledAt);
	const cancelledAt = row.cancelledAt?.toISOString() ?? null;

	return {
		id: row.id,
		type: row.type === "payable" ? "payable" : "receivable",
		status:
			row.status === "settled" || row.status === "cancelled"
				? row.status
				: "pending",
		name: row.name,
		description: row.description,
		amount: Number(row.amount ?? 0),
		dueDate,
		competencePeriod: row.competencePeriod,
		paymentMethod: row.paymentMethod,
		partyId: row.partyId ?? null,
		partyName: row.party?.name ?? null,
		partyKind: row.party?.kind ?? null,
		categoryId: row.categoryId ?? null,
		categoryName: row.category?.name ?? null,
		categoryType: row.category?.type ?? null,
		categoryIcon: row.category?.icon ?? null,
		accountId: row.accountId ?? null,
		accountName: row.financialAccount?.name ?? null,
		accountLogo: row.financialAccount?.logo ?? null,
		payerId: row.payerId ?? null,
		payerName: row.payer?.name ?? null,
		settledAt,
		settledAmount:
			row.settledAmount === null || row.settledAmount === undefined
				? null
				: Number(row.settledAmount),
		settlementTransactionId: row.settlementTransactionId ?? null,
		cancelledAt,
		computedStatus: getComputedFinancialTitleStatus({
			status:
				row.status === "settled" || row.status === "cancelled"
					? row.status
					: "pending",
			dueDate,
		}),
		isRecurring: Boolean(row.seriesId),
		seriesId: row.seriesId ?? null,
		seriesRole:
			row.seriesRole === "origin" || row.seriesRole === "occurrence"
				? row.seriesRole
				: null,
		seriesFrequency: row.seriesFrequency === "monthly" ? "monthly" : null,
		seriesIndex: row.seriesIndex ?? null,
		seriesStartDate: toDateOnlyString(row.seriesStartDate),
		seriesEndDate: toDateOnlyString(row.seriesEndDate),
		seriesAnchorDay: row.seriesAnchorDay ?? null,
		seriesGeneratedThrough: row.seriesGeneratedThrough ?? null,
	};
};

const sortTitles = (items: FinancialTitleListItem[]) => {
	const priority: Record<FinancialTitleComputedStatus, number> = {
		overdue: 0,
		pending: 1,
		settled: 2,
		cancelled: 3,
	};

	return [...items].sort((left, right) => {
		const statusDiff =
			priority[left.computedStatus] - priority[right.computedStatus];
		if (statusDiff !== 0) {
			return statusDiff;
		}

		if (
			(left.computedStatus === "overdue" ||
				left.computedStatus === "pending") &&
			(right.computedStatus === "overdue" || right.computedStatus === "pending")
		) {
			if (left.dueDate !== right.dueDate) {
				return left.dueDate.localeCompare(right.dueDate);
			}
		}

		if (
			left.computedStatus === "settled" &&
			right.computedStatus === "settled"
		) {
			const leftSettledAt = left.settledAt ?? "";
			const rightSettledAt = right.settledAt ?? "";
			if (leftSettledAt !== rightSettledAt) {
				return rightSettledAt.localeCompare(leftSettledAt);
			}
		}

		return left.name.localeCompare(right.name, "pt-BR", {
			sensitivity: "base",
		});
	});
};

const applyFilters = (
	items: FinancialTitleListItem[],
	filters: FinancialTitleSearchFilters,
) => {
	const search = filters.searchFilter.trim().toLowerCase();

	return items.filter((item) => {
		if (filters.typeFilter !== "all" && item.type !== filters.typeFilter) {
			return false;
		}

		if (
			filters.statusFilter !== "all" &&
			item.computedStatus !== filters.statusFilter
		) {
			return false;
		}

		if (filters.partyFilter !== "all" && item.partyId !== filters.partyFilter) {
			return false;
		}

		if (
			filters.categoryFilter !== "all" &&
			item.categoryId !== filters.categoryFilter
		) {
			return false;
		}

		if (!search) {
			return true;
		}

		const haystack = [
			item.name,
			item.description,
			item.partyName,
			item.categoryName,
			item.accountName,
			item.payerName,
		]
			.filter(Boolean)
			.join(" ")
			.toLowerCase();

		return haystack.includes(search);
	});
};

const buildSummary = (
	items: FinancialTitleListItem[],
	period: string,
): FinancialTitleSummary => {
	let totalReceivablePending = 0;
	let totalPayablePending = 0;
	let overdueCount = 0;
	let settledInPeriod = 0;

	for (const item of items) {
		if (item.computedStatus === "overdue") {
			overdueCount += 1;
		}

		if (
			item.computedStatus === "pending" ||
			item.computedStatus === "overdue"
		) {
			if (item.type === "receivable") {
				totalReceivablePending += item.amount;
			} else {
				totalPayablePending += item.amount;
			}
		}

		if (item.status === "settled" && item.settledAt?.startsWith(period)) {
			settledInPeriod += 1;
		}
	}

	return {
		totalReceivablePending,
		totalPayablePending,
		projectedBalance: totalReceivablePending - totalPayablePending,
		overdueCount,
		settledInPeriod,
	};
};

async function fetchFinancialTitleOptions(
	userId: string,
): Promise<FinancialTitleOptions> {
	const filterSources = await fetchTransactionFilterSources(userId);
	const sluggedFilters = buildSluggedFilters({
		payerRows: filterSources.payerRows,
		partyRows: filterSources.partyRows,
		categoryRows: filterSources.categoryRows,
		accountRows: filterSources.accountRows,
		cardRows: filterSources.cardRows,
	});
	const optionSets = buildOptionSets({
		...sluggedFilters,
		payerRows: filterSources.payerRows,
	});

	return {
		payerOptions: optionSets.payerOptions,
		defaultPayerId: optionSets.defaultPayerId,
		partyOptions: optionSets.partyOptions,
		categoryOptions: optionSets.categoryOptions,
		accountOptions: optionSets.accountOptions,
	};
}

async function fetchTitlesForPeriod(userId: string, period: string) {
	const rows = (await db.query.financialTitles.findMany({
		where: and(
			eq(financialTitles.userId, userId),
			eq(financialTitles.competencePeriod, period),
		),
		with: {
			party: true,
			category: true,
			financialAccount: true,
			payer: true,
		},
		orderBy: [asc(financialTitles.dueDate), asc(financialTitles.createdAt)],
	})) as FinancialTitleWithRelations[];

	return rows.map(mapFinancialTitleRow);
}

export async function fetchFinancialTitlesPage({
	userId,
	period,
	searchParams,
}: {
	userId: string;
	period: string;
	searchParams?: ResolvedSearchParams;
}): Promise<FinancialTitlesPageData> {
	await ensureRecurringFinancialTitleCoverage({
		referencePeriod: period,
		userId,
	});

	const [items, options] = await Promise.all([
		fetchTitlesForPeriod(userId, period),
		fetchFinancialTitleOptions(userId),
	]);

	const filters = extractFinancialTitleSearchFilters(searchParams);
	const filteredItems = sortTitles(applyFilters(items, filters));
	const { page, pageSize } = resolveFinancialTitlePagination(searchParams);
	const totalItems = filteredItems.length;
	const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
	const currentPage = Math.min(page, totalPages);
	const titles = filteredItems.slice(
		(currentPage - 1) * pageSize,
		currentPage * pageSize,
	);

	return {
		titles,
		summary: buildSummary(filteredItems, period),
		filters,
		options,
		pagination: {
			page: currentPage,
			pageSize,
			totalItems,
			totalPages,
		},
	};
}

export async function fetchDashboardFinancialTitlesSnapshot(
	userId: string,
	period: string,
): Promise<DashboardFinancialTitlesSnapshot> {
	await ensureRecurringFinancialTitleCoverage({
		referencePeriod: period,
		userId,
	});

	const { year, month } = parsePeriod(period);
	const rangeStart = new Date(Date.UTC(year, month - 1, 1));
	const rangeEnd = new Date(Date.UTC(year, month, 0));
	const rows = (await db.query.financialTitles.findMany({
		where: and(
			eq(financialTitles.userId, userId),
			lte(financialTitles.dueDate, rangeEnd),
		),
		with: {
			party: true,
			category: true,
			financialAccount: true,
			payer: true,
		},
		orderBy: [asc(financialTitles.dueDate), asc(financialTitles.createdAt)],
	})) as FinancialTitleWithRelations[];

	const today = getBusinessDateString();
	const items = sortTitles(
		rows
			.map(mapFinancialTitleRow)
			.filter(
				(item) =>
					item.computedStatus === "overdue" ||
					(item.status === "pending" &&
						item.dueDate >= (toDateOnlyString(rangeStart) ?? today)),
			),
	).slice(0, 5);

	const pendingRows = rows
		.map(mapFinancialTitleRow)
		.filter(
			(item) =>
				item.computedStatus === "pending" || item.computedStatus === "overdue",
		);

	const totalReceivablePending = pendingRows
		.filter((item) => item.type === "receivable")
		.reduce((total, item) => total + item.amount, 0);
	const totalPayablePending = pendingRows
		.filter((item) => item.type === "payable")
		.reduce((total, item) => total + item.amount, 0);

	return {
		totalReceivablePending,
		totalPayablePending,
		projectedBalance: totalReceivablePending - totalPayablePending,
		overdueCount: pendingRows.filter(
			(item) => item.computedStatus === "overdue",
		).length,
		dueTodayCount: pendingRows.filter((item) => item.dueDate === today).length,
		upcomingCount: pendingRows.filter((item) =>
			isDateOnlyWithinDays(item.dueDate, 7, today),
		).length,
		items,
	};
}

export async function fetchFinancialTitleCalendarEvents({
	userId,
	period,
}: {
	userId: string;
	period: string;
}) {
	await ensureRecurringFinancialTitleCoverage({
		referencePeriod: period,
		userId,
	});

	const { year, month } = parsePeriod(period);
	const rangeStart = new Date(Date.UTC(year, month - 1, 1));
	const rangeEnd = new Date(Date.UTC(year, month, 0));

	const rows = (await db.query.financialTitles.findMany({
		where: and(
			eq(financialTitles.userId, userId),
			gte(financialTitles.dueDate, rangeStart),
			lte(financialTitles.dueDate, rangeEnd),
		),
		with: {
			party: true,
			category: true,
			financialAccount: true,
			payer: true,
		},
		orderBy: [asc(financialTitles.dueDate), asc(financialTitles.createdAt)],
	})) as FinancialTitleWithRelations[];

	return rows.map(mapFinancialTitleRow);
}
