import assert from "node:assert/strict";
import test from "node:test";
import { version } from "@/package.json";
import { buildPublicOpenApiDocument } from "./openapi";

test("spec público expõe os endpoints externos esperados com versão do app", () => {
	const document = buildPublicOpenApiDocument();

	assert.equal(document.openapi, "3.1.0");
	assert.equal(document.info.version, version);
	assert.deepEqual(Object.keys(document.paths).sort(), [
		"/api/auth/device/verify",
		"/api/health",
		"/api/inbox",
		"/api/inbox/batch",
		"/api/parties",
		"/api/parties/{partyId}",
	]);
});

test("spec público define bearerAuth e deixa health sem autenticação", () => {
	const document = buildPublicOpenApiDocument();
	const health = document.paths["/api/health"];
	const inbox = document.paths["/api/inbox"];

	assert.equal(document.components.securitySchemes.bearerAuth.type, "http");
	assert.deepEqual(
		document.components.securitySchemes.bearerAuth.scheme,
		"bearer",
	);
	assert.deepEqual(health.get.security, []);
	assert.deepEqual(inbox.post.security, [{ bearerAuth: [] }]);
});

test("spec público inclui exemplos completos para inbox e parties", () => {
	const document = buildPublicOpenApiDocument();
	const inboxPost = document.paths["/api/inbox"].post;
	const partiesPost = document.paths["/api/parties"].post;
	const partyPatch = document.paths["/api/parties/{partyId}"].patch;
	const createdExamples = partiesPost.responses["201"].content[
		"application/json"
	].examples as Record<string, { value?: unknown }>;

	assert.ok(
		inboxPost.requestBody.content["application/json"].examples.default.value,
		"Inbox precisa expor um exemplo de payload.",
	);
	assert.ok(
		createdExamples.created?.value,
		"Parties precisa expor resposta de criação.",
	);
	assert.ok(
		partyPatch.requestBody.content["application/json"].examples.default.value
			.integration,
		"PATCH de party precisa demonstrar uso de integration.",
	);
});
