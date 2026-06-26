import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
	new URL("./category-details-queries.ts", import.meta.url),
	"utf8",
);

assert.match(
	source,
	/with:\s*\{[\s\S]*\bclient:\s*true[\s\S]*\}/u,
	"fetchCategoryDetails deve carregar a relação client para exibir Cliente na lista de lançamentos da categoria.",
);
