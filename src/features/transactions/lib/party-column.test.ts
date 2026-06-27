import assert from "node:assert/strict";
import { shouldShowPartyColumn } from "./party-column";

assert.equal(
	shouldShowPartyColumn([
		{ partyId: null, partyName: null },
		{ partyId: "", partyName: "   " },
	]),
	false,
	"não deve exibir a coluna Cliente/Fornecedor quando nenhum lançamento tem vínculo.",
);

assert.equal(
	shouldShowPartyColumn([
		{ partyId: null, partyName: null },
		{ partyId: "party-1", partyName: null },
	]),
	true,
	"deve exibir a coluna Cliente/Fornecedor quando algum lançamento tem partyId.",
);

assert.equal(
	shouldShowPartyColumn([{ partyId: null, partyName: "Cliente ACME" }]),
	true,
	"deve exibir a coluna Cliente/Fornecedor quando algum lançamento tem nome carregado.",
);
