export const BRANDING_LOGO_MIME_TYPES = [
	"image/png",
	"image/jpeg",
	"image/webp",
] as const;

export const BRANDING_LOGO_MAX_FILE_SIZE = 2 * 1024 * 1024;

export type BrandingLogoMimeType = (typeof BRANDING_LOGO_MIME_TYPES)[number];

export type StoredBrandingLogo = {
	logoContentBase64: string;
	logoMimeType: BrandingLogoMimeType;
	logoFileName: string;
	logoFileSize: number;
};

export class BrandingLogoValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "BrandingLogoValidationError";
	}
}

export async function prepareBrandingLogoForStorage(
	file: File,
): Promise<StoredBrandingLogo> {
	if (!BRANDING_LOGO_MIME_TYPES.includes(file.type as BrandingLogoMimeType)) {
		throw new BrandingLogoValidationError(
			"Tipo de arquivo não suportado. Use PNG, JPEG ou WebP.",
		);
	}

	if (file.size <= 0) {
		throw new BrandingLogoValidationError("Arquivo de logo inválido.");
	}

	if (file.size > BRANDING_LOGO_MAX_FILE_SIZE) {
		throw new BrandingLogoValidationError("Logo deve ter no máximo 2 MB.");
	}

	const content = Buffer.from(await file.arrayBuffer()).toString("base64");

	return {
		logoContentBase64: content,
		logoMimeType: file.type as BrandingLogoMimeType,
		logoFileName: file.name.slice(0, 255) || "logo",
		logoFileSize: file.size,
	};
}

export function decodeBrandingLogoBase64(contentBase64: string): Uint8Array {
	return Buffer.from(contentBase64, "base64");
}
