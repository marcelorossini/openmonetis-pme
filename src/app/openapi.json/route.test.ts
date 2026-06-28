import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

test("openapi.json retorna o documento compartilhado como JSON público", () => {
	assert.match(
		source,
		/buildPublicOpenApiDocument/u,
		"A rota /openapi.json precisa reutilizar o builder compartilhado do spec.",
	);
	assert.match(
		source,
		/NextResponse\.json/u,
		"A rota /openapi.json precisa responder JSON.",
	);
});
