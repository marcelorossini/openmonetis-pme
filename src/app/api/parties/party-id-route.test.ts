import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
	new URL("./[partyId]/route.ts", import.meta.url),
	"utf8",
);

test("route de detalhe de parties expõe GET, PATCH e DELETE autenticados", () => {
	assert.match(
		source,
		/export async function GET\(/u,
		"A rota /api/parties/[partyId] precisa expor GET.",
	);
	assert.match(
		source,
		/export async function PATCH\(/u,
		"A rota /api/parties/[partyId] precisa expor PATCH.",
	);
	assert.match(
		source,
		/export async function DELETE\(/u,
		"A rota /api/parties/[partyId] precisa expor DELETE.",
	);
	assert.match(
		source,
		/authenticateApiTokenRequest/u,
		"A rota de detalhe precisa reutilizar o helper compartilhado de token.",
	);
	assert.match(
		source,
		/"Cache-Control": "private, no-store"/u,
		"A rota de detalhe precisa responder como conteúdo privado sem cache.",
	);
});

test("route de detalhe de parties atualiza e inativa via serviços da feature", () => {
	assert.match(
		source,
		/partiesApiUpdateSchema/u,
		"O PATCH precisa validar o payload com o schema da feature.",
	);
	assert.match(
		source,
		/updatePartyFromApi/u,
		"O PATCH precisa reutilizar o serviço de atualização da feature.",
	);
	assert.match(
		source,
		/inactivatePartyForUser/u,
		"O DELETE da API deve inativar o cadastro, não removê-lo fisicamente.",
	);
	assert.match(
		source,
		/from "@\/features\/parties\/queries"/u,
		"A rota de detalhe deve consumir o entry point de leitura da feature.",
	);
	assert.match(
		source,
		/from "@\/features\/parties\/actions"/u,
		"A rota de detalhe deve consumir o entry point de escrita da feature.",
	);
});
