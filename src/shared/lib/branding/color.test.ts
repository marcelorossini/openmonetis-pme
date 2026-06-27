import assert from "node:assert/strict";
import {
	buildBrandingCssVariables,
	DEFAULT_PRIMARY_COLOR_HEX,
	normalizePrimaryColorHex,
} from "./color";

assert.equal(normalizePrimaryColorHex("#0f766e"), "#0F766E");
assert.equal(normalizePrimaryColorHex("0f766e"), "#0F766E");
assert.equal(normalizePrimaryColorHex("#abc"), null);
assert.equal(normalizePrimaryColorHex("#zzzzzz"), null);

const defaultVariables = buildBrandingCssVariables(null);
assert.deepEqual(defaultVariables, {});

const variables = buildBrandingCssVariables("#0f766e");
assert.equal(variables["--primary"], "#0F766E");
assert.equal(variables["--ring"], "#0F766E");
assert.equal(variables["--sidebar-primary"], "#0F766E");
assert.equal(variables["--sidebar-ring"], "#0F766E");
assert.equal(variables["--primary-foreground"], "#ffffff");

const lightVariables = buildBrandingCssVariables("#FACC15");
assert.equal(lightVariables["--primary"], "#FACC15");
assert.equal(lightVariables["--primary-foreground"], "#16140a");

assert.equal(DEFAULT_PRIMARY_COLOR_HEX, "#FF7733");
