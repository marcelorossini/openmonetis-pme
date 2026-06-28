import assert from "node:assert/strict";
import test from "node:test";
import {
	parsePartiesApiListSearchParams,
	partiesApiCreateSchema,
	partiesApiUpdateSchema,
} from "./api-contract";

test("parsePartiesApiListSearchParams usa defaults e normaliza filtros suportados", () => {
	const result = parsePartiesApiListSearchParams(
		new URLSearchParams({
			page: "2",
			pageSize: "50",
			kind: "fornecedor",
			status: "Inativo",
			search: "  ACME  ",
		}),
	);

	assert.deepEqual(result, {
		page: 2,
		pageSize: 50,
		kind: "fornecedor",
		status: "Inativo",
		search: "ACME",
		integration: null,
	});
});

test("parsePartiesApiListSearchParams exige sourceApp e externalKey juntos", () => {
	assert.throws(
		() =>
			parsePartiesApiListSearchParams(
				new URLSearchParams({
					sourceApp: "omie",
				}),
			),
		/sourceApp e externalKey precisam ser informados juntos/u,
	);

	assert.throws(
		() =>
			parsePartiesApiListSearchParams(
				new URLSearchParams({
					externalKey: "cli-1",
				}),
			),
		/sourceApp e externalKey precisam ser informados juntos/u,
	);
});

test("partiesApiCreateSchema aceita integration opcional e normaliza profileKey vazio", () => {
	const result = partiesApiCreateSchema.parse({
		kind: "cliente",
		name: "ACME Ltda",
		document: "12.345.678/0001-00",
		email: "financeiro@acme.test",
		phone: "(11) 99999-9999",
		status: "Ativo",
		note: "Conta principal",
		integration: {
			sourceApp: "omie",
			profileKey: "   ",
			externalKey: " cli-1 ",
		},
	});

	assert.equal(result.integration?.sourceApp, "omie");
	assert.equal(result.integration?.profileKey, null);
	assert.equal(result.integration?.externalKey, "cli-1");
});

test("partiesApiUpdateSchema permite payload sem integration", () => {
	const result = partiesApiUpdateSchema.parse({
		kind: "fornecedor",
		name: "Papelaria Centro",
		document: null,
		email: null,
		phone: null,
		status: "Inativo",
		note: null,
	});

	assert.equal(result.integration, undefined);
	assert.equal(result.kind, "fornecedor");
});
