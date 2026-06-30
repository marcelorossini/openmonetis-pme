import assert from "node:assert/strict";
import test from "node:test";
import { buildDefaultCategoryValues, DEFAULT_CATEGORIES } from "./defaults";

test("DEFAULT_CATEGORIES prioriza operacao empresarial e remove categorias domesticas antigas", () => {
	const names = DEFAULT_CATEGORIES.map((category) => category.name);

	assert.deepEqual(names, [
		"Pró-labore",
		"Folha e encargos",
		"Impostos e taxas",
		"Contabilidade",
		"Serviços terceirizados",
		"Marketing e publicidade",
		"Software e SaaS",
		"Internet e telefonia",
		"Equipamentos e informática",
		"Materiais de escritório",
		"Aluguel e condomínio",
		"Energia e água",
		"Serviços bancários",
		"Seguros",
		"Capacitação e cursos",
		"Viagens e hospedagem",
		"Transporte e deslocamento",
		"Alimentação de trabalho",
		"Assinaturas",
		"Pagamentos",
		"Outras despesas",
		"Serviços Prestados",
		"Mensalidades e contratos",
		"Vendas",
		"Comissões",
		"Reembolso",
		"Rendimentos financeiros",
		"Investimentos",
		"Outras receitas",
		"Saldo inicial",
		"Transferência interna",
	]);

	assert.equal(names.includes("Lazer"), false);
	assert.equal(names.includes("Pets"), false);
	assert.equal(names.includes("Mercado"), false);
	assert.equal(names.includes("Restaurantes"), false);
	assert.equal(names.includes("Delivery"), false);
	assert.equal(names.includes("Salário"), false);
});

test("buildDefaultCategoryValues aplica userId e partyKind predefinido nas categorias empresariais", () => {
	const values = buildDefaultCategoryValues("user-seed");
	const byName = new Map(values.map((category) => [category.name, category]));

	assert.equal(byName.get("Serviços Prestados")?.partyKind, "cliente");
	assert.equal(byName.get("Mensalidades e contratos")?.partyKind, "cliente");
	assert.equal(byName.get("Serviços terceirizados")?.partyKind, "fornecedor");
	assert.equal(byName.get("Software e SaaS")?.partyKind, "fornecedor");
	assert.equal(byName.get("Pagamentos")?.partyKind, null);
	assert.equal(byName.get("Transferência interna")?.partyKind, null);
	assert.equal(
		values.every((category) => category.userId === "user-seed"),
		true,
	);
});
