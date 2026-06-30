import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./mock-data.ts", import.meta.url), "utf8");

test("mock-data reutiliza o helper compartilhado ao completar categorias faltantes", () => {
	assert.match(
		source,
		/buildDefaultCategoryValues\(userId\)/u,
		"O mock-data precisa complementar categorias via helper compartilhado para manter partyKind.",
	);
});

test("mock-data troca referencias da seed domestica por categorias empresariais", () => {
	assert.doesNotMatch(source, /getCategoryId\("Mercado"\)/u);
	assert.doesNotMatch(source, /getCategoryId\("Restaurantes"\)/u);
	assert.doesNotMatch(source, /getCategoryId\("Delivery"\)/u);
	assert.doesNotMatch(source, /getCategoryId\("Moradia"\)/u);
	assert.doesNotMatch(source, /getCategoryId\("Lazer"\)/u);
	assert.doesNotMatch(source, /getCategoryId\("Vestuário"\)/u);
	assert.doesNotMatch(source, /getCategoryId\("Presentes"\)/u);
	assert.doesNotMatch(source, /getCategoryId\("Salário"\)/u);

	assert.match(source, /getCategoryId\("Mensalidades e contratos"\)/u);
	assert.match(source, /getCategoryId\("Serviços terceirizados"\)/u);
	assert.match(source, /getCategoryId\("Software e SaaS"\)/u);
	assert.match(source, /getCategoryId\("Aluguel e condomínio"\)/u);
	assert.match(source, /getCategoryId\("Transporte e deslocamento"\)/u);
	assert.match(source, /getCategoryId\("Alimentação de trabalho"\)/u);
});
