export type IntegrationEntityType = "account" | "party" | "category";

export type IntegrationFocusContext = {
	entityType: IntegrationEntityType;
	entityId: string;
	entityLabel?: string | null;
};

export function buildIntegrationsSettingsHref(
	context: IntegrationFocusContext,
): string {
	const params = new URLSearchParams({
		tab: "integracoes",
		entityType: context.entityType,
		entityId: context.entityId,
	});

	return `/settings?${params.toString()}`;
}
