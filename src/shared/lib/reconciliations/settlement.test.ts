import assert from "node:assert/strict";
import test from "node:test";
import { buildSettlementUpdateFromTransaction } from "./settlement";
import type { ReconciliationSettlementTitle } from "./types";

const title: ReconciliationSettlementTitle = {
	id: "title-1",
	userId: "user-1",
	accountId: "account-title",
};

test("usa o lançamento existente para montar a baixa do título", () => {
	const result = buildSettlementUpdateFromTransaction({
		title,
		transaction: {
			id: "tx-1",
			userId: "user-1",
			transactionType: "Despesa",
			amount: -75.5,
			paymentMethod: "Pix",
			purchaseDate: "2026-06-20",
			categoryId: null,
			partyId: null,
			accountId: "account-tx",
			name: "Mercado",
			note: null,
		},
		notificationDate: "2026-06-19",
	});

	assert.deepEqual(result, {
		status: "settled",
		settlementTransactionId: "tx-1",
		settledAt: "2026-06-20",
		settledAmount: "75.50",
		paymentMethod: "Pix",
		accountId: "account-tx",
	});
});

test("preserva a conta do título quando o lançamento importado não tiver conta", () => {
	const result = buildSettlementUpdateFromTransaction({
		title,
		transaction: {
			id: "tx-2",
			userId: "user-1",
			transactionType: "Receita",
			amount: 120,
			paymentMethod: "Boleto",
			purchaseDate: null,
			categoryId: null,
			partyId: null,
			accountId: null,
			name: "Recebimento",
			note: null,
		},
		notificationDate: "2026-06-22",
	});

	assert.deepEqual(result, {
		status: "settled",
		settlementTransactionId: "tx-2",
		settledAt: "2026-06-22",
		settledAmount: "120.00",
		paymentMethod: "Boleto",
		accountId: "account-title",
	});
});
