import { decodeBrandingLogoBase64 } from "@/shared/lib/branding/logo";
import { fetchAppBrandingLogoImage } from "@/shared/lib/branding/queries";

export async function GET() {
	const logo = await fetchAppBrandingLogoImage();

	if (!logo) {
		return new Response(null, { status: 404 });
	}

	const bytes = decodeBrandingLogoBase64(logo.contentBase64);
	const body = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(body).set(bytes);

	return new Response(body, {
		headers: {
			"Cache-Control": "public, max-age=31536000, immutable",
			"Content-Type": logo.mimeType,
			"Content-Length": String(bytes.byteLength),
			"Last-Modified": logo.updatedAt.toUTCString(),
		},
	});
}
