import assert from "node:assert/strict";
import test from "node:test";
import {
	categoriesApiCreateSchema,
	categoriesApiUpdateSchema,
	parseCategoriesApiListSearchParams,
} from "./api-contract";

test("parseCategoriesApiListSearchParams usa defaults e normaliza filtros suportados", () => {
	const result = parseCategoriesApiListSearchParams(
		new URLSearchParams({
			page: "2",
			pageSize: "50",
			type: "receita",
			partyKind: "cliente",
			search: "  Servicos  ",
		}),
	);

	assert.deepEqual(result, {
		page: 2,
		pageSize: 50,
		type: "receita",
		partyKind: "cliente",
		search: "Servicos",
		integration: null,
	});
});

test("parseCategoriesApiListSearchParams exige sourceApp e externalKey juntos", () => {
	assert.throws(
		() =>
			parseCategoriesApiListSearchParams(
				new URLSearchParams({
					sourceApp: "omie",
				}),
			),
		/sourceApp e externalKey precisam ser informados juntos/u,
	);

	assert.throws(
		() =>
			parseCategoriesApiListSearchParams(
				new URLSearchParams({
					externalKey: "cat-1",
				}),
			),
		/sourceApp e externalKey precisam ser informados juntos/u,
	);
});

test("categoriesApiCreateSchema aceita integration opcional e normaliza profileKey vazio", () => {
	const result = categoriesApiCreateSchema.parse({
		name: "Serviços Prestados",
		type: "receita",
		icon: " RiUserStarLine ",
		partyKind: "cliente",
		integration: {
			sourceApp: "omie",
			profileKey: "   ",
			externalKey: " cat-1 ",
		},
	});

	assert.equal(result.integration?.sourceApp, "omie");
	assert.equal(result.integration?.profileKey, null);
	assert.equal(result.integration?.externalKey, "cat-1");
	assert.equal(result.icon, "RiUserStarLine");
});

test("categoriesApiUpdateSchema permite payload sem integration", () => {
	const result = categoriesApiUpdateSchema.parse({
		name: "Fornecedores",
		type: "despesa",
		icon: null,
		partyKind: "fornecedor",
	});

	assert.equal(result.integration, undefined);
	assert.equal(result.partyKind, "fornecedor");
});
