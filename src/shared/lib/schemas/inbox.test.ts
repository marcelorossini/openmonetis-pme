import assert from "node:assert/strict";
import { inboxItemSchema } from "./inbox";

const validBasePayload = {
	sourceApp: "com.bank.app",
	sourceAppName: "Banco Teste",
	originalTitle: "Compra aprovada",
	originalText: "Compra de R$ 42,50 em Padaria Central",
	notificationTimestamp: "2026-06-26T12:00:00.000Z",
	parsedName: "Padaria Central",
	parsedAmount: "42.50",
	clientId: "notification-1",
};

const expanded = inboxItemSchema.parse({
	...validBasePayload,
	purchaseDate: "2026-06-25",
	transactionType: "Despesa",
	paymentMethod: "Pix",
	accountId: "11111111-1111-4111-8111-111111111111",
	categoryId: "22222222-2222-4222-8222-222222222222",
	payerId: "33333333-3333-4333-8333-333333333333",
	partyId: "44444444-4444-4444-8444-444444444444",
	autoImport: true,
});

assert.equal(expanded.purchaseDate, "2026-06-25");
assert.equal(expanded.transactionType, "Despesa");
assert.equal(expanded.paymentMethod, "Pix");
assert.equal(expanded.accountId, "11111111-1111-4111-8111-111111111111");
assert.equal(expanded.cardId, null);
assert.equal(expanded.autoImport, true);

const legacy = inboxItemSchema.parse(validBasePayload);
assert.equal(legacy.autoImport, false);
assert.equal(legacy.purchaseDate, undefined);
assert.equal(legacy.paymentMethod, undefined);

assert.throws(
	() =>
		inboxItemSchema.parse({
			...validBasePayload,
			purchaseDate: "26/06/2026",
		}),
	/Data de compra inválida/u,
);

assert.throws(
	() =>
		inboxItemSchema.parse({
			...validBasePayload,
			paymentMethod: "Cheque",
		}),
	/Forma de pagamento inválida/u,
);
