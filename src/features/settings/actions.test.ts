import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

function sliceBetween(
	fileSource: string,
	startMarker: string,
	endMarker: string,
): string {
	const startIndex = fileSource.indexOf(startMarker);
	const endIndex = fileSource.indexOf(endMarker, startIndex);

	assert.notEqual(
		startIndex,
		-1,
		`Não foi possível localizar o início do bloco ${startMarker}.`,
	);
	assert.notEqual(
		endIndex,
		-1,
		`Não foi possível localizar o fim do bloco ${startMarker}.`,
	);

	return fileSource.slice(startIndex, endIndex);
}

const resetBlock = sliceBetween(
	source,
	"async function resetUserAppData(",
	"async function upsertBrandingSettings(",
);

const resetActionBlock = sliceBetween(
	source,
	"export async function resetAccountAction(",
	"export async function updatePreferencesAction(",
);

test("resetUserAppData remove todas as tabelas de negócio do usuário antes de recriar defaults", () => {
	const requiredDeletes = [
		"schema.userPreferences",
		"schema.integrationPartyMappings",
		"schema.integrationAccountMappings",
		"schema.integrationCategoryMappings",
		"schema.importCategoryMappings",
		"schema.dashboardNotificationStates",
		"schema.establishmentLogos",
		"schema.apiTokens",
		"schema.savedInsights",
		"schema.notes",
		"schema.inboxItems",
		"schema.budgets",
		"schema.financialTitles",
		"schema.installmentAnticipations",
		"schema.transactions",
		"schema.attachments",
		"schema.invoices",
		"schema.cards",
		"schema.financialAccounts",
		"schema.parties",
		"schema.payers",
		"schema.categories",
	];

	for (const tableRef of requiredDeletes) {
		assert.match(
			resetBlock,
			new RegExp(`delete\\(${tableRef.replaceAll(".", "\\.")}\\)`, "u"),
			`O reset precisa apagar ${tableRef} para zerar toda a conta.`,
		);
	}
});

test("resetAccountAction revalida as áreas de clientes/fornecedores e títulos financeiros", () => {
	assert.match(
		resetActionBlock,
		/revalidateForEntity\("parties", session\.user\.id\)/u,
		"O reset precisa revalidar a feature de clientes/fornecedores.",
	);
	assert.match(
		resetActionBlock,
		/revalidateForEntity\("financialTitles", session\.user\.id\)/u,
		"O reset precisa revalidar a feature de contas a pagar/receber.",
	);
});

test("resetUserAppData recria categorias padrão com helper compartilhado da seed", () => {
	assert.match(
		resetBlock,
		/buildDefaultCategoryValues\(userId\)/u,
		"O reset precisa reutilizar o helper compartilhado para recriar categorias com partyKind.",
	);
});
