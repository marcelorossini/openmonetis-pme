export function isBrandingSettingsTableMissing(error: unknown): boolean {
	if (!(error instanceof Error)) return false;

	const message = error.message.toLowerCase();

	return (
		(message.includes("app_branding_settings") ||
			message.includes("logo_content_base64")) &&
		(message.includes("does not exist") ||
			message.includes("relation") ||
			message.includes("column"))
	);
}
