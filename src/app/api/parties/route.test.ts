import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

test("route de parties expõe GET e POST com cache privado e autenticação por token", () => {
	assert.match(
		source,
		/export async function GET\(/u,
		"A rota /api/parties precisa expor GET.",
	);
	assert.match(
		source,
		/export async function POST\(/u,
		"A rota /api/parties precisa expor POST.",
	);
	assert.match(
		source,
		/"Cache-Control": "private, no-store"/u,
		"A rota /api/parties precisa responder como conteúdo privado sem cache.",
	);
	assert.match(
		source,
		/authenticateApiTokenRequest/u,
		"A rota /api/parties precisa reutilizar o helper compartilhado de token.",
	);
});

test("route de parties usa o contrato da feature para listagem e criação", () => {
	assert.match(
		source,
		/parsePartiesApiListSearchParams/u,
		"O GET precisa usar o parser de filtros da feature.",
	);
	assert.match(
		source,
		/partiesApiCreateSchema/u,
		"O POST precisa validar o payload com o schema da feature.",
	);
	assert.match(
		source,
		/upsertPartyFromApi/u,
		"O POST precisa fazer upsert orientado a integração quando aplicável.",
	);
	assert.match(
		source,
		/from "@\/features\/parties\/queries"/u,
		"A rota /api/parties deve consumir o entry point de leitura da feature.",
	);
	assert.match(
		source,
		/from "@\/features\/parties\/actions"/u,
		"A rota /api/parties deve consumir o entry point de escrita da feature.",
	);
});
