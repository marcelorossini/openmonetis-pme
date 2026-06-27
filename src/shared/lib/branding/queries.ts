import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { appBrandingSettings } from "@/db/schema";
import { db } from "@/shared/lib/db";
import { DEFAULT_PRIMARY_COLOR_HEX, normalizePrimaryColorHex } from "./color";
import { isBrandingSettingsTableMissing } from "./errors";

export const APP_BRANDING_ID = "global";
export const APP_BRANDING_CACHE_TAG = "app-branding";

export type AppBranding = {
	primaryColorHex: string;
	logoUrl: string | null;
	logoFileName: string | null;
	logoUpdatedAt: Date | null;
};

export type AppBrandingSettingsData = AppBranding & {
	logoFileSize: number | null;
	logoMimeType: string | null;
};

export type AppBrandingLogoImage = {
	contentBase64: string;
	mimeType: string;
	fileName: string | null;
	updatedAt: Date;
};

const DEFAULT_APP_BRANDING: AppBrandingSettingsData = {
	primaryColorHex: DEFAULT_PRIMARY_COLOR_HEX,
	logoUrl: null,
	logoFileName: null,
	logoFileSize: null,
	logoMimeType: null,
	logoUpdatedAt: null,
};

function isBrandingDatabaseConfigured() {
	return !!process.env.DATABASE_URL;
}

async function fetchBrandingRow() {
	"use cache";

	cacheTag(APP_BRANDING_CACHE_TAG);
	cacheLife("max");

	const [row] = await db
		.select({
			primaryColorHex: appBrandingSettings.primaryColorHex,
			logoFileName: appBrandingSettings.logoFileName,
			logoMimeType: appBrandingSettings.logoMimeType,
			logoFileSize: appBrandingSettings.logoFileSize,
			updatedAt: appBrandingSettings.updatedAt,
		})
		.from(appBrandingSettings)
		.where(eq(appBrandingSettings.id, APP_BRANDING_ID))
		.limit(1);

	return row ?? null;
}

export async function fetchAppBranding(): Promise<AppBranding> {
	const branding = await fetchAppBrandingSettings();
	return {
		primaryColorHex: branding.primaryColorHex,
		logoUrl: branding.logoUrl,
		logoFileName: branding.logoFileName,
		logoUpdatedAt: branding.logoUpdatedAt,
	};
}

export async function fetchAppBrandingSettings(): Promise<AppBrandingSettingsData> {
	if (!isBrandingDatabaseConfigured()) return DEFAULT_APP_BRANDING;

	let row: Awaited<ReturnType<typeof fetchBrandingRow>>;
	try {
		row = await fetchBrandingRow();
	} catch (error) {
		if (isBrandingSettingsTableMissing(error)) return DEFAULT_APP_BRANDING;
		throw error;
	}

	if (!row) return DEFAULT_APP_BRANDING;

	const primaryColorHex =
		normalizePrimaryColorHex(row.primaryColorHex) ?? DEFAULT_PRIMARY_COLOR_HEX;
	const logoUrl =
		row.logoFileSize && row.logoMimeType
			? `/api/branding/logo?v=${row.updatedAt.getTime()}`
			: null;

	return {
		primaryColorHex,
		logoUrl,
		logoFileName: row.logoFileName,
		logoFileSize: row.logoFileSize,
		logoMimeType: row.logoMimeType,
		logoUpdatedAt: row.logoFileSize ? row.updatedAt : null,
	};
}

export async function fetchAppBrandingLogoImage(): Promise<AppBrandingLogoImage | null> {
	if (!isBrandingDatabaseConfigured()) return null;

	try {
		const [row] = await db
			.select({
				contentBase64: appBrandingSettings.logoContentBase64,
				mimeType: appBrandingSettings.logoMimeType,
				fileName: appBrandingSettings.logoFileName,
				updatedAt: appBrandingSettings.updatedAt,
			})
			.from(appBrandingSettings)
			.where(eq(appBrandingSettings.id, APP_BRANDING_ID))
			.limit(1);

		if (!row?.contentBase64 || !row.mimeType) return null;

		return {
			contentBase64: row.contentBase64,
			mimeType: row.mimeType,
			fileName: row.fileName,
			updatedAt: row.updatedAt,
		};
	} catch (error) {
		if (isBrandingSettingsTableMissing(error)) return null;
		throw error;
	}
}
