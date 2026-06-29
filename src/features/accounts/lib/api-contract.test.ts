import assert from "node:assert/strict";
import test from "node:test";
import {
	accountsApiCreateSchema,
	accountsApiUpdateSchema,
	parseAccountsApiListSearchParams,
} from "./api-contract";

test("parseAccountsApiListSearchParams usa defaults e normaliza filtros suportados", () => {
	const result = parseAccountsApiListSearchParams(
		new URLSearchParams({
			page: "2",
			pageSize: "50",
			status: "Ativa",
			accountType: "Conta corrente",
			search: "  Nubank  ",
		}),
	);

	assert.deepEqual(result, {
		page: 2,
		pageSize: 50,
		status: "Ativa",
		accountType: "Conta corrente",
		search: "Nubank",
		integration: null,
	});
});

test("parseAccountsApiListSearchParams exige sourceApp e externalKey juntos", () => {
	assert.throws(
		() =>
			parseAccountsApiListSearchParams(
				new URLSearchParams({
					sourceApp: "omie",
				}),
			),
		/sourceApp e externalKey precisam ser informados juntos/u,
	);

	assert.throws(
		() =>
			parseAccountsApiListSearchParams(
				new URLSearchParams({
					externalKey: "conta-1",
				}),
			),
		/sourceApp e externalKey precisam ser informados juntos/u,
	);
});

test("accountsApiCreateSchema aceita integration opcional e normaliza profileKey vazio", () => {
	const result = accountsApiCreateSchema.parse({
		name: "Nubank PJ",
		accountType: "Conta corrente",
		status: "Ativa",
		note: "Conta principal",
		logo: " Nubank ",
		initialBalance: "1500,25",
		excludeFromBalance: "true",
		excludeInitialBalanceFromIncome: false,
		integration: {
			sourceApp: "omie",
			profileKey: "   ",
			externalKey: " conta-1 ",
		},
	});

	assert.equal(result.integration?.sourceApp, "omie");
	assert.equal(result.integration?.profileKey, null);
	assert.equal(result.integration?.externalKey, "conta-1");
	assert.equal(result.logo, "Nubank");
	assert.equal(result.initialBalance, 1500.25);
	assert.equal(result.excludeFromBalance, true);
	assert.equal(result.excludeInitialBalanceFromIncome, false);
});

test("accountsApiUpdateSchema permite payload sem integration", () => {
	const result = accountsApiUpdateSchema.parse({
		name: "Reserva PJ",
		accountType: "Conta investimento",
		status: "Inativa",
		note: null,
		logo: "Reserva",
		initialBalance: 0,
		excludeFromBalance: false,
		excludeInitialBalanceFromIncome: true,
	});

	assert.equal(result.integration, undefined);
	assert.equal(result.status, "Inativa");
	assert.equal(result.excludeInitialBalanceFromIncome, true);
});
