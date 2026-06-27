import assert from "node:assert/strict";
import { resolveInboxMappingIds } from "./mapping";

const baseItem = {
	sourceApp: "bank-api",
	profileKey: "inter-webhook",
	accountId: null,
	partyId: null,
	categoryId: null,
	accountExternalKey: "conta:asaas",
	partyExternalKey: "pix:cnpj:12345678000199",
	categoryExternalKey: "categoria:servicos-prestados",
};

const mappings = {
	accounts: [
		{
			sourceApp: "bank-api",
			profileKey: "inter-webhook",
			externalKey: "conta:asaas",
			accountId: "account-1",
		},
	],
	parties: [
		{
			sourceApp: "bank-api",
			profileKey: "inter-webhook",
			externalKey: "pix:cnpj:12345678000199",
			partyId: "party-1",
		},
	],
	categories: [
		{
			sourceApp: "bank-api",
			profileKey: "inter-webhook",
			externalKey: "categoria:servicos-prestados",
			categoryId: "category-1",
		},
	],
};

assert.deepEqual(resolveInboxMappingIds(baseItem, mappings), {
	accountId: "account-1",
	partyId: "party-1",
	categoryId: "category-1",
});

assert.deepEqual(
	resolveInboxMappingIds(
		{
			...baseItem,
			accountId: "account-explicita",
			partyId: "party-explicito",
			categoryId: "category-explicita",
		},
		mappings,
	),
	{
		accountId: "account-explicita",
		partyId: "party-explicito",
		categoryId: "category-explicita",
	},
);

assert.deepEqual(
	resolveInboxMappingIds(
		{
			...baseItem,
			profileKey: "outro-perfil",
		},
		mappings,
	),
	{
		accountId: null,
		partyId: null,
		categoryId: null,
	},
);

assert.deepEqual(
	resolveInboxMappingIds(
		{
			...baseItem,
			accountExternalKey: "conta:outra",
			partyExternalKey: "12345678000199",
		},
		mappings,
	),
	{
		accountId: null,
		partyId: null,
		categoryId: "category-1",
	},
);

assert.deepEqual(
	resolveInboxMappingIds(
		{
			...baseItem,
			profileKey: "   ",
			accountExternalKey: "conta:sem-perfil",
		},
		{
			...mappings,
			accounts: [
				{
					sourceApp: "bank-api",
					profileKey: "",
					externalKey: "conta:sem-perfil",
					accountId: "account-sem-perfil",
				},
			],
		},
	),
	{
		accountId: "account-sem-perfil",
		partyId: null,
		categoryId: null,
	},
);
