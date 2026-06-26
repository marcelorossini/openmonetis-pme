import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildInitials } from "@/shared/utils/initials";

assert.equal(buildInitials("Aryane"), "AR");
assert.equal(buildInitials("Marcelo Rossini"), "MR");
assert.equal(buildInitials("  Marcelo   Rossini  "), "MR");

const componentSource = readFileSync(
	new URL("./client-avatar.tsx", import.meta.url),
	"utf8",
);

assert.match(componentSource, /buildInitials/u);
assert.match(componentSource, /getCategoryBgColorFromName/u);
assert.match(componentSource, /getCategoryColorFromName/u);
assert.match(
	componentSource,
	/fontSize:\s*Math\.max\(10,\s*Math\.round\(pixelSize\s*\*\s*0\.38\)\)/u,
);
assert.match(componentSource, /export function ClientAvatar/u);
assert.match(componentSource, /export function ClientAvatarLabel/u);

const usageFiles = [
	new URL(
		"../../../features/transactions/components/table/transactions-columns.tsx",
		import.meta.url,
	),
	new URL(
		"../../../features/transactions/components/table/transactions-mobile-list.tsx",
		import.meta.url,
	),
	new URL(
		"../../../features/transactions/components/dialogs/transaction-dialog/client-section.tsx",
		import.meta.url,
	),
	new URL(
		"../../../features/transactions/components/dialogs/transaction-details-dialog.tsx",
		import.meta.url,
	),
	new URL(
		"../../../features/transactions/components/table/transactions-filters.tsx",
		import.meta.url,
	),
	new URL(
		"../../../features/clients/components/clients-page.tsx",
		import.meta.url,
	),
];

for (const file of usageFiles) {
	const source = readFileSync(file, "utf8");
	assert.match(
		source,
		/ClientAvatarLabel/u,
		`${file.pathname} deve renderizar clientes com iniciais em avatar.`,
	);
}

const transactionsTableSource = readFileSync(
	new URL(
		"../../../features/transactions/components/table/transactions-columns.tsx",
		import.meta.url,
	),
	"utf8",
);
assert.match(
	transactionsTableSource,
	/ClientAvatarLabel[\s\S]*size="md"/u,
	"Cliente na tabela de lançamentos deve usar avatar do mesmo porte de Pessoa/Categoria.",
);

const clientsPageSource = readFileSync(
	new URL(
		"../../../features/clients/components/clients-page.tsx",
		import.meta.url,
	),
	"utf8",
);
assert.match(
	clientsPageSource,
	/ClientAvatarLabel[\s\S]*size="md"/u,
	"Cliente na listagem de clientes deve usar avatar de listagem, não avatar compacto de select.",
);
