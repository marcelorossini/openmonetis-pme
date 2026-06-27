import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const accountDialogSource = readFileSync(
	new URL("../../accounts/components/account-dialog.tsx", import.meta.url),
	"utf8",
);
const categoryDialogSource = readFileSync(
	new URL("../../categories/components/category-dialog.tsx", import.meta.url),
	"utf8",
);
const partyDialogSource = readFileSync(
	new URL("../../parties/components/party-dialog.tsx", import.meta.url),
	"utf8",
);

for (const [name, source] of [
	["conta", accountDialogSource],
	["categoria", categoryDialogSource],
	["cliente/fornecedor", partyDialogSource],
] as const) {
	assert.match(
		source,
		/Integrações/u,
		`O dialog de ${name} deve expor um atalho para Integrações no modo edição.`,
	);
}
