import assert from "node:assert/strict";
import { shouldShowClientColumn } from "./client-column";

assert.equal(
	shouldShowClientColumn([
		{ clientId: null, clientName: null },
		{ clientId: "", clientName: "   " },
	]),
	false,
	"não deve exibir a coluna Cliente quando nenhum lançamento tem vínculo de cliente.",
);

assert.equal(
	shouldShowClientColumn([
		{ clientId: null, clientName: null },
		{ clientId: "client-1", clientName: null },
	]),
	true,
	"deve exibir a coluna Cliente quando algum lançamento tem clientId.",
);

assert.equal(
	shouldShowClientColumn([{ clientId: null, clientName: "Cliente ACME" }]),
	true,
	"deve exibir a coluna Cliente quando algum lançamento tem nome de cliente carregado.",
);
