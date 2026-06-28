import type {
	FinancialTitleComputedStatus,
	FinancialTitleType,
} from "@/features/receivables-payables/types";
import type { ResolvedSearchParams } from "@/features/transactions/lib/page-helpers";
import { getSingleParam } from "@/features/transactions/lib/page-helpers";

export const FINANCIAL_TITLES_DEFAULT_PAGE_SIZE = 30;
export const FINANCIAL_TITLES_PAGE_SIZE_OPTIONS = [5, 10, 20, 30, 40, 50, 100];

export type FinancialTitleSearchFilters = {
	typeFilter: FinancialTitleType | "all";
	statusFilter: FinancialTitleComputedStatus | "all";
	partyFilter: string | "all";
	categoryFilter: string | "all";
	searchFilter: string;
};

type FinancialTitleFilterParamKey =
	| "type"
	| "status"
	| "party"
	| "category"
	| "q";

type FinancialTitleFilterParamUpdates = Partial<
	Record<FinancialTitleFilterParamKey, string | null>
>;

const toMutableSearchParams = (params: URLSearchParams | string) =>
	new URLSearchParams(params.toString());

const normalizeParamValue = (value: string | null | undefined) => {
	const normalized = value?.trim();
	if (!normalized || normalized === "all") {
		return null;
	}
	return normalized;
};

export function extractFinancialTitleSearchFilters(
	params: ResolvedSearchParams,
): FinancialTitleSearchFilters {
	const typeValue = getSingleParam(params, "type");
	const statusValue = getSingleParam(params, "status");
	const partyValue = getSingleParam(params, "party");
	const categoryValue = getSingleParam(params, "category");
	const searchValue = getSingleParam(params, "q");

	return {
		typeFilter:
			typeValue === "receivable" || typeValue === "payable" ? typeValue : "all",
		statusFilter:
			statusValue === "pending" ||
			statusValue === "overdue" ||
			statusValue === "settled" ||
			statusValue === "cancelled"
				? statusValue
				: "all",
		partyFilter: partyValue?.trim() || "all",
		categoryFilter: categoryValue?.trim() || "all",
		searchFilter: searchValue?.trim() ?? "",
	};
}

export function resolveFinancialTitlePagination(params: ResolvedSearchParams): {
	page: number;
	pageSize: number;
} {
	const pageParam = Number.parseInt(getSingleParam(params, "page") ?? "", 10);
	const pageSizeParam = Number.parseInt(
		getSingleParam(params, "pageSize") ?? "",
		10,
	);

	return {
		page: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1,
		pageSize: FINANCIAL_TITLES_PAGE_SIZE_OPTIONS.includes(pageSizeParam)
			? pageSizeParam
			: FINANCIAL_TITLES_DEFAULT_PAGE_SIZE,
	};
}

export function buildFinancialTitleFilterSearchParams(
	params: URLSearchParams | string,
	updates: FinancialTitleFilterParamUpdates,
) {
	const nextParams = toMutableSearchParams(params);

	for (const [key, value] of Object.entries(updates)) {
		const normalized = normalizeParamValue(value);
		if (normalized) {
			nextParams.set(key, normalized);
		} else {
			nextParams.delete(key);
		}
	}

	nextParams.delete("page");

	return nextParams;
}

export function buildFinancialTitlePaginationSearchParams(
	params: URLSearchParams | string,
	{
		page,
		pageSize,
	}: {
		page: number;
		pageSize: number;
	},
) {
	const nextParams = toMutableSearchParams(params);

	if (page <= 1) {
		nextParams.delete("page");
	} else {
		nextParams.set("page", page.toString());
	}

	if (pageSize === FINANCIAL_TITLES_DEFAULT_PAGE_SIZE) {
		nextParams.delete("pageSize");
	} else {
		nextParams.set("pageSize", pageSize.toString());
	}

	return nextParams;
}
