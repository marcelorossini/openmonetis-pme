import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

test("api-docs usa o handler oficial do Scalar apontando para /openapi.json", () => {
	assert.match(
		source,
		/@scalar\/nextjs-api-reference/u,
		"A rota /api-docs precisa usar o pacote oficial do Scalar.",
	);
	assert.match(
		source,
		/url:\s*"\/openapi\.json"/u,
		"A rota /api-docs precisa apontar para o spec público em /openapi.json.",
	);
	assert.match(
		source,
		/export const GET = ApiReference\(/u,
		"A rota /api-docs precisa exportar o handler GET do Scalar.",
	);
});
