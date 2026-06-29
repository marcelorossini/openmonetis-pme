import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
	new URL("./[categoryId]/route.ts", import.meta.url),
	"utf8",
);

test("route de detalhe de categories expõe GET, PATCH e DELETE autenticados", () => {
	assert.match(
		source,
		/export async function GET\(/u,
		"A rota /api/categories/[categoryId] precisa expor GET.",
	);
	assert.match(
		source,
		/export async function PATCH\(/u,
		"A rota /api/categories/[categoryId] precisa expor PATCH.",
	);
	assert.match(
		source,
		/export async function DELETE\(/u,
		"A rota /api/categories/[categoryId] precisa expor DELETE.",
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

test("route de detalhe de categories atualiza e remove via serviços da feature", () => {
	assert.match(
		source,
		/categoriesApiUpdateSchema/u,
		"O PATCH precisa validar o payload com o schema da feature.",
	);
	assert.match(
		source,
		/updateCategoryFromApi/u,
		"O PATCH precisa reutilizar o serviço de atualização da feature.",
	);
	assert.match(
		source,
		/deleteCategoryFromApi/u,
		"O DELETE da API deve remover a categoria via serviço da feature.",
	);
	assert.match(
		source,
		/from "@\/features\/categories\/queries"/u,
		"A rota de detalhe deve consumir o entry point de leitura da feature.",
	);
	assert.match(
		source,
		/from "@\/features\/categories\/actions"/u,
		"A rota de detalhe deve consumir o entry point de escrita da feature.",
	);
});
