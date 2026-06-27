import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
	new URL("./integrations-tab.tsx", import.meta.url),
	"utf8",
);

assert.match(
	source,
	/Cliente\/Fornecedor[\s\S]*Categoria[\s\S]*Conta/u,
	"A aba de integrações deve suportar Cliente/Fornecedor, Categoria e Conta.",
);

assert.match(
	source,
	/Perfil da integração \(opcional\)|<Label>Perfil<\/Label>/u,
	"A UI de integrações deve expor o campo de perfil.",
);
