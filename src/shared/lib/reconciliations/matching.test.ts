import assert from "node:assert/strict";
import test from "node:test";
import { matchFinancialTitleForTransaction } from "./matching";
import type {
	ReconciliationTitleCandidate,
	ReconciliationTransactionCandidate,
} from "./types";

const baseTransaction: ReconciliationTransactionCandidate = {
	id: "tx-1",
	userId: "user-1",
	transactionType: "Despesa",
	amount: -150.25,
	paymentMethod: "Pix",
	purchaseDate: "2026-06-20",
	categoryId: "cat-1",
	partyId: "party-1",
	accountId: "account-1",
	name: "Padaria do Centro",
	note: "Compra do dia",
};

const baseTitle: ReconciliationTitleCandidate = {
	id: "title-1",
	userId: "user-1",
	type: "payable",
	status: "pending",
	amount: 150.25,
	dueDate: "2026-06-21",
	paymentMethod: "Pix",
	categoryId: "cat-1",
	partyId: "party-1",
	accountId: "account-1",
	name: "Fornecedor XPTO",
	description: "Mensalidade",
};

test("concilia automaticamente quando existe um único título compatível", () => {
	const result = matchFinancialTitleForTransaction({
		transaction: baseTransaction,
		titles: [baseTitle],
	});

	assert.equal(result.status, "reconciled");
	assert.equal(result.matchedTitle.id, "title-1");
	assert.deepEqual(
		result.candidates.map((candidate) => candidate.id),
		["title-1"],
	);
});

test("retorna unmatched quando não existe título compatível", () => {
	const result = matchFinancialTitleForTransaction({
		transaction: baseTransaction,
		titles: [
			{
				...baseTitle,
				id: "title-2",
				amount: 999.99,
			},
		],
	});

	assert.equal(result.status, "unmatched");
	assert.deepEqual(result.candidates, []);
});

test("retorna ambiguous quando há mais de um candidato claro", () => {
	const result = matchFinancialTitleForTransaction({
		transaction: baseTransaction,
		titles: [
			baseTitle,
			{
				...baseTitle,
				id: "title-2",
				dueDate: "2026-06-19",
			},
		],
	});

	assert.equal(result.status, "ambiguous");
	assert.deepEqual(
		result.candidates.map((candidate) => candidate.id),
		["title-1", "title-2"],
	);
});

test("respeita categoria, cliente/fornecedor e conta quando ambos os lados informam o campo", () => {
	const result = matchFinancialTitleForTransaction({
		transaction: baseTransaction,
		titles: [
			{
				...baseTitle,
				id: "wrong-category",
				categoryId: "cat-2",
			},
			{
				...baseTitle,
				id: "wrong-party",
				partyId: "party-2",
			},
			{
				...baseTitle,
				id: "wrong-account",
				accountId: "account-2",
			},
			{
				...baseTitle,
				id: "missing-account-still-valid",
				accountId: null,
			},
		],
	});

	assert.equal(result.status, "reconciled");
	assert.equal(result.matchedTitle.id, "missing-account-still-valid");
});

test("não usa nome nem descrição para decidir a conciliação", () => {
	const result = matchFinancialTitleForTransaction({
		transaction: {
			...baseTransaction,
			name: "Empresa totalmente diferente",
			note: "Texto sem relação",
		},
		titles: [
			{
				...baseTitle,
				name: "Outro nome sem similaridade",
				description: "Outro texto",
			},
		],
	});

	assert.equal(result.status, "reconciled");
	assert.equal(result.matchedTitle.id, "title-1");
});
