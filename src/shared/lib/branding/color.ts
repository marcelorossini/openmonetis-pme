import type { CSSProperties } from "react";

export const DEFAULT_PRIMARY_COLOR_HEX = "#FF7733";

const HEX_COLOR_PATTERN = /^#?[0-9a-fA-F]{6}$/;

type BrandingCssVariables = CSSProperties & Record<`--${string}`, string>;

export function normalizePrimaryColorHex(value: string | null | undefined) {
	if (!value) return null;
	const trimmed = value.trim();
	if (!HEX_COLOR_PATTERN.test(trimmed)) return null;
	const normalized = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
	return normalized.toUpperCase();
}

function hexToRgb(hex: string) {
	const normalized = normalizePrimaryColorHex(hex);
	if (!normalized) return null;

	return {
		r: Number.parseInt(normalized.slice(1, 3), 16),
		g: Number.parseInt(normalized.slice(3, 5), 16),
		b: Number.parseInt(normalized.slice(5, 7), 16),
	};
}

function getRelativeLuminance(hex: string) {
	const rgb = hexToRgb(hex);
	if (!rgb) return 0;

	const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => {
		const normalized = channel / 255;
		return normalized <= 0.03928
			? normalized / 12.92
			: ((normalized + 0.055) / 1.055) ** 2.4;
	});

	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function getPrimaryForegroundColor(primaryColorHex: string) {
	return getRelativeLuminance(primaryColorHex) > 0.58 ? "#16140a" : "#ffffff";
}

export function buildBrandingCssVariables(
	primaryColorHex: string | null | undefined,
): BrandingCssVariables {
	const normalized = normalizePrimaryColorHex(primaryColorHex);
	if (!normalized || normalized === DEFAULT_PRIMARY_COLOR_HEX) {
		return {};
	}

	const primaryForeground = getPrimaryForegroundColor(normalized);

	return {
		"--primary": normalized,
		"--primary-foreground": primaryForeground,
		"--ring": normalized,
		"--sidebar-primary": normalized,
		"--sidebar-primary-foreground": primaryForeground,
		"--sidebar-ring": normalized,
	};
}
