import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
	new URL("./category-details-queries.ts", import.meta.url),
	"utf8",
);

assert.match(
	source,
	/with:\s*\{[\s\S]*\bparty:\s*true[\s\S]*\}/u,
	"fetchCategoryDetails deve carregar a relação party para exibir Cliente/Fornecedor na lista de lançamentos da categoria.",
);
