import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
	new URL("./preferences-form.tsx", import.meta.url),
	"utf8",
);

assert.match(
	source,
	/<DndContext[\s\S]*id="settings-preferences-column-order"/u,
	"O DndContext das preferências deve usar id estável para evitar mismatch de hidratação no SSR.",
);
