import assert from "node:assert/strict";
import test from "node:test";
import * as titleFilters from "./title-filters";

const sortSearchParams = (params: URLSearchParams) =>
	[...params.entries()].sort(([leftKey], [rightKey]) =>
		leftKey.localeCompare(rightKey),
	);

test("resolveFinancialTitlePagination usa defaults e aceita apenas tamanhos homologados", () => {
	assert.equal(
		typeof titleFilters.resolveFinancialTitlePagination,
		"function",
		"resolveFinancialTitlePagination deve ser exportada para a listagem paginada.",
	);

	assert.deepEqual(titleFilters.resolveFinancialTitlePagination(undefined), {
		page: 1,
		pageSize: 30,
	});

	assert.deepEqual(
		titleFilters.resolveFinancialTitlePagination({
			page: "3",
			pageSize: "20",
		}),
		{
			page: 3,
			pageSize: 20,
		},
	);

	assert.deepEqual(
		titleFilters.resolveFinancialTitlePagination({
			page: "0",
			pageSize: "999",
		}),
		{
			page: 1,
			pageSize: 30,
		},
	);
});

test("buildFinancialTitleFilterSearchParams preserva contexto e reseta a página ao trocar filtros", () => {
	assert.equal(
		typeof titleFilters.buildFinancialTitleFilterSearchParams,
		"function",
		"buildFinancialTitleFilterSearchParams deve existir para sincronizar a toolbar com a URL.",
	);

	const current = new URLSearchParams(
		"periodo=2026-06&page=4&pageSize=20&type=payable&status=overdue&q=aluguel",
	);

	const updated = titleFilters.buildFinancialTitleFilterSearchParams(current, {
		status: "settled",
		q: "energia",
	});

	assert.equal(
		updated.toString(),
		"periodo=2026-06&pageSize=20&type=payable&status=settled&q=energia",
	);

	const cleared = titleFilters.buildFinancialTitleFilterSearchParams(current, {
		status: "all",
		q: "",
	});

	assert.equal(cleared.toString(), "periodo=2026-06&pageSize=20&type=payable");
});

test("buildFinancialTitlePaginationSearchParams preserva filtros ativos e remove defaults da URL", () => {
	assert.equal(
		typeof titleFilters.buildFinancialTitlePaginationSearchParams,
		"function",
		"buildFinancialTitlePaginationSearchParams deve existir para a navegação paginada.",
	);

	const current = new URLSearchParams(
		"periodo=2026-06&pageSize=20&type=payable&status=overdue",
	);

	assert.deepEqual(
		sortSearchParams(
			titleFilters.buildFinancialTitlePaginationSearchParams(current, {
				page: 2,
				pageSize: 20,
			}),
		),
		sortSearchParams(
			new URLSearchParams(
				"periodo=2026-06&page=2&pageSize=20&type=payable&status=overdue",
			),
		),
	);

	assert.deepEqual(
		sortSearchParams(
			titleFilters.buildFinancialTitlePaginationSearchParams(current, {
				page: 1,
				pageSize: 30,
			}),
		),
		sortSearchParams(
			new URLSearchParams("periodo=2026-06&type=payable&status=overdue"),
		),
	);
});
