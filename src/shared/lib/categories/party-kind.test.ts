import assert from "node:assert/strict";
import {
	canCategoryLinkParty,
	getPartyFieldLabel,
	normalizeCategoryPartyKind,
} from "./party-kind";

assert.equal(normalizeCategoryPartyKind(null), null);
assert.equal(normalizeCategoryPartyKind(""), null);
assert.equal(normalizeCategoryPartyKind("cliente"), "cliente");
assert.equal(normalizeCategoryPartyKind("fornecedor"), "fornecedor");
assert.equal(normalizeCategoryPartyKind("outro"), null);

assert.equal(
	canCategoryLinkParty({ partyKind: "cliente" }, { kind: "cliente" }),
	true,
	"categoria configurada para cliente deve aceitar entidade cliente.",
);

assert.equal(
	canCategoryLinkParty({ partyKind: "cliente" }, { kind: "fornecedor" }),
	false,
	"categoria configurada para cliente não deve aceitar fornecedor.",
);

assert.equal(
	canCategoryLinkParty({ partyKind: "fornecedor" }, { kind: "fornecedor" }),
	true,
	"categoria configurada para fornecedor deve aceitar entidade fornecedor.",
);

assert.equal(
	canCategoryLinkParty({ partyKind: null }, { kind: "cliente" }),
	false,
	"categoria sem vínculo não deve aceitar entidade.",
);

assert.equal(getPartyFieldLabel("cliente"), "Cliente");
assert.equal(getPartyFieldLabel("fornecedor"), "Fornecedor");
