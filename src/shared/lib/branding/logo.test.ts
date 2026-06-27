import assert from "node:assert/strict";
import {
	BRANDING_LOGO_MAX_FILE_SIZE,
	prepareBrandingLogoForStorage,
} from "./logo";

async function main() {
	const validLogo = new File([new Uint8Array([1, 2, 3, 4])], "marca.png", {
		type: "image/png",
	});
	const prepared = await prepareBrandingLogoForStorage(validLogo);

	assert.equal(prepared.logoContentBase64, "AQIDBA==");
	assert.equal(prepared.logoFileName, "marca.png");
	assert.equal(prepared.logoMimeType, "image/png");
	assert.equal(prepared.logoFileSize, 4);

	await assert.rejects(
		() =>
			prepareBrandingLogoForStorage(
				new File(["texto"], "marca.txt", { type: "text/plain" }),
			),
		/Tipo de arquivo não suportado/,
	);

	await assert.rejects(
		() =>
			prepareBrandingLogoForStorage(
				new File(["<svg></svg>"], "marca.svg", { type: "image/svg+xml" }),
			),
		/Tipo de arquivo não suportado/,
	);

	await assert.rejects(
		() =>
			prepareBrandingLogoForStorage(
				new File(
					[new Uint8Array(BRANDING_LOGO_MAX_FILE_SIZE + 1)],
					"marca.png",
					{
						type: "image/png",
					},
				),
			),
		/Logo deve ter no máximo 2 MB/,
	);
}

main();
