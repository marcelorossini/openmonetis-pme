import assert from "node:assert/strict";
import { isFreelanceIncomeCategory } from "./freelance";

assert.equal(
	isFreelanceIncomeCategory({ name: "Serviços Prestados", type: "receita" }),
	true,
);
assert.equal(
	isFreelanceIncomeCategory({ name: "Freelance", type: "receita" }),
	true,
);
assert.equal(
	isFreelanceIncomeCategory({ name: "Serviços Prestados", type: "despesa" }),
	false,
);
assert.equal(
	isFreelanceIncomeCategory({ name: "Consultoria", type: "receita" }),
	false,
);
