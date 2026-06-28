import { and, asc, eq } from "drizzle-orm";
import { financialTitles } from "@/db/schema";
import { db } from "@/shared/lib/db";
import {
	getBusinessTodayInfo,
	parseLocalDateString,
	toDateOnlyString,
} from "@/shared/utils/date";
import { comparePeriods } from "@/shared/utils/period";
import {
	buildSeriesPeriodsToGenerate,
	getMonthlySeriesDueDate,
	getRecurringSeriesIndex,
} from "./recurrence";
import { deriveTitlePeriodFromDate } from "./status";

export const RECURRING_FINANCIAL_TITLE_HORIZON_MONTHS = 12;

type RecurringSeriesOrigin = typeof financialTitles.$inferSelect;

type EnsureRecurringFinancialTitleCoverageOptions = {
	referencePeriod?: string;
	seriesId?: string;
	userId?: string;
};

const getSeriesStartPeriod = (title: RecurringSeriesOrigin) =>
	title.seriesStartDate
		? deriveTitlePeriodFromDate(toDateOnlyString(title.seriesStartDate) ?? "")
		: title.competencePeriod;

const getSeriesEndPeriod = (title: RecurringSeriesOrigin) =>
	title.seriesEndDate
		? deriveTitlePeriodFromDate(toDateOnlyString(title.seriesEndDate) ?? "")
		: null;

const getSeriesAnchorDay = (title: RecurringSeriesOrigin) => {
	if (title.seriesAnchorDay) {
		return Number(title.seriesAnchorDay);
	}

	const fallbackDate =
		toDateOnlyString(title.seriesStartDate) ??
		toDateOnlyString(title.dueDate) ??
		"";
	const [, , dayPart] = fallbackDate.split("-");
	return Number.parseInt(dayPart ?? "1", 10) || 1;
};

const buildRecurringOccurrenceRow = (
	origin: RecurringSeriesOrigin,
	period: string,
) => {
	const dueDate = getMonthlySeriesDueDate(period, getSeriesAnchorDay(origin));
	return {
		userId: origin.userId,
		type: origin.type,
		status: "pending" as const,
		name: origin.name,
		description: origin.description,
		amount: origin.amount,
		dueDate: parseLocalDateString(dueDate),
		competencePeriod: period,
		paymentMethod: origin.paymentMethod,
		settledAt: null,
		settledAmount: null,
		cancelledAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		partyId: origin.partyId,
		categoryId: origin.categoryId,
		accountId: origin.accountId,
		payerId: origin.payerId,
		settlementTransactionId: null,
		seriesId: origin.seriesId,
		seriesRole: "occurrence",
		seriesFrequency: origin.seriesFrequency,
		seriesIndex: getRecurringSeriesIndex({
			seriesStartPeriod: getSeriesStartPeriod(origin),
			targetPeriod: period,
		}),
		seriesStartDate: origin.seriesStartDate,
		seriesEndDate: origin.seriesEndDate,
		seriesAnchorDay: origin.seriesAnchorDay,
		seriesGeneratedThrough: null,
		seriesClosedAt: origin.seriesClosedAt,
	};
};

async function fetchRecurringSeriesOrigins(
	options: EnsureRecurringFinancialTitleCoverageOptions,
) {
	return db.query.financialTitles.findMany({
		where: and(
			eq(financialTitles.seriesRole, "origin"),
			eq(financialTitles.seriesFrequency, "monthly"),
			...(options.seriesId
				? [eq(financialTitles.seriesId, options.seriesId)]
				: []),
			...(options.userId ? [eq(financialTitles.userId, options.userId)] : []),
		),
		orderBy: [asc(financialTitles.createdAt)],
	});
}

export async function ensureRecurringFinancialTitleCoverage(
	options: EnsureRecurringFinancialTitleCoverageOptions = {},
) {
	const referencePeriod =
		options.referencePeriod ?? getBusinessTodayInfo().period;
	const origins = await fetchRecurringSeriesOrigins(options);

	let createdCount = 0;

	for (const origin of origins) {
		if (!origin.seriesId) {
			continue;
		}

		const periodsToGenerate = buildSeriesPeriodsToGenerate({
			currentPeriod: referencePeriod,
			generateRetroactive: true,
			horizonMonths: RECURRING_FINANCIAL_TITLE_HORIZON_MONTHS,
			seriesGeneratedThrough: origin.seriesGeneratedThrough,
			seriesStartPeriod: getSeriesStartPeriod(origin),
			seriesEndPeriod: getSeriesEndPeriod(origin),
		});

		if (periodsToGenerate.length === 0) {
			continue;
		}

		const rows = periodsToGenerate.map((period) =>
			buildRecurringOccurrenceRow(origin, period),
		);

		await db.transaction(async (tx) => {
			await tx.insert(financialTitles).values(rows);
			await tx
				.update(financialTitles)
				.set({
					seriesGeneratedThrough: periodsToGenerate.at(-1) ?? null,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(financialTitles.id, origin.id),
						eq(financialTitles.userId, origin.userId),
					),
				);
		});

		createdCount += rows.length;
	}

	return { createdCount };
}

export async function syncRecurringSeriesMetadata(
	userId: string,
	seriesId: string,
	values: {
		seriesEndDate?: Date | null;
		seriesClosedAt?: Date | null;
		seriesAnchorDay?: number | null;
	},
) {
	await db
		.update(financialTitles)
		.set({
			...(values.seriesEndDate !== undefined && {
				seriesEndDate: values.seriesEndDate,
			}),
			...(values.seriesClosedAt !== undefined && {
				seriesClosedAt: values.seriesClosedAt,
			}),
			...(values.seriesAnchorDay !== undefined && {
				seriesAnchorDay: values.seriesAnchorDay,
			}),
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(financialTitles.userId, userId),
				eq(financialTitles.seriesId, seriesId),
			),
		);
}

export function getSeriesRegenerationReferencePeriod(
	titlePeriod: string,
	referencePeriod = getBusinessTodayInfo().period,
) {
	return comparePeriods(titlePeriod, referencePeriod) > 0
		? titlePeriod
		: referencePeriod;
}
