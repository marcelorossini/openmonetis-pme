import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

test("route de accounts expõe GET e POST com cache privado e autenticação por token", () => {
	assert.match(
		source,
		/export async function GET\(/u,
		"A rota /api/accounts precisa expor GET.",
	);
	assert.match(
		source,
		/export async function POST\(/u,
		"A rota /api/accounts precisa expor POST.",
	);
	assert.match(
		source,
		/"Cache-Control": "private, no-store"/u,
		"A rota /api/accounts precisa responder como conteúdo privado sem cache.",
	);
	assert.match(
		source,
		/authenticateApiTokenRequest/u,
		"A rota /api/accounts precisa reutilizar o helper compartilhado de token.",
	);
});

test("route de accounts usa o contrato da feature para listagem e criação", () => {
	assert.match(
		source,
		/parseAccountsApiListSearchParams/u,
		"O GET precisa usar o parser de filtros da feature.",
	);
	assert.match(
		source,
		/accountsApiCreateSchema/u,
		"O POST precisa validar o payload com o schema da feature.",
	);
	assert.match(
		source,
		/upsertAccountFromApi/u,
		"O POST precisa fazer upsert orientado a integração quando aplicável.",
	);
	assert.match(
		source,
		/from "@\/features\/accounts\/queries"/u,
		"A rota /api/accounts deve consumir o entry point de leitura da feature.",
	);
	assert.match(
		source,
		/from "@\/features\/accounts\/actions"/u,
		"A rota /api/accounts deve consumir o entry point de escrita da feature.",
	);
});
