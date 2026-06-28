import {
	addMonthsToPeriod,
	buildPeriodRange,
	comparePeriods,
	parsePeriod,
} from "@/shared/utils/period";

type CoverageTargetInput = {
	currentPeriod: string;
	horizonMonths: number;
	seriesStartPeriod: string;
};

type BuildSeriesPeriodsInput = CoverageTargetInput & {
	generateRetroactive: boolean;
	seriesGeneratedThrough: string | null;
	seriesEndPeriod?: string | null;
};

const getLastDayOfMonth = (period: string) => {
	const { year, month } = parsePeriod(period);
	return new Date(year, month, 0).getDate();
};

export function getMonthlySeriesDueDate(
	period: string,
	anchorDay: number,
): string {
	const { year, month } = parsePeriod(period);
	const day = Math.min(Math.max(anchorDay, 1), getLastDayOfMonth(period));
	return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
		2,
		"0",
	)}`;
}

export function getSeriesCoverageTargetPeriod({
	currentPeriod,
	horizonMonths,
	seriesStartPeriod,
}: CoverageTargetInput): string {
	const referencePeriod =
		comparePeriods(seriesStartPeriod, currentPeriod) > 0
			? seriesStartPeriod
			: currentPeriod;

	return addMonthsToPeriod(referencePeriod, Math.max(horizonMonths, 0));
}

export function getRecurringSeriesIndex({
	seriesStartPeriod,
	targetPeriod,
}: {
	seriesStartPeriod: string;
	targetPeriod: string;
}): number {
	const { year: startYear, month: startMonth } = parsePeriod(seriesStartPeriod);
	const { year: targetYear, month: targetMonth } = parsePeriod(targetPeriod);
	return (targetYear - startYear) * 12 + (targetMonth - startMonth) + 1;
}

export function normalizeRecurringDueDateForPeriod({
	competencePeriod,
	selectedDate,
}: {
	competencePeriod: string;
	selectedDate: string;
}): string {
	const [, , dayPart] = selectedDate.split("-");
	const day = Number.parseInt(dayPart ?? "", 10);
	return getMonthlySeriesDueDate(competencePeriod, day);
}

export function buildSeriesPeriodsToGenerate({
	currentPeriod,
	generateRetroactive,
	horizonMonths,
	seriesGeneratedThrough,
	seriesStartPeriod,
	seriesEndPeriod = null,
}: BuildSeriesPeriodsInput): string[] {
	const firstPeriod =
		generateRetroactive || comparePeriods(seriesStartPeriod, currentPeriod) > 0
			? seriesStartPeriod
			: currentPeriod;

	const coverageTarget = getSeriesCoverageTargetPeriod({
		currentPeriod,
		horizonMonths,
		seriesStartPeriod,
	});
	const lastPeriod =
		seriesEndPeriod && comparePeriods(seriesEndPeriod, coverageTarget) < 0
			? seriesEndPeriod
			: coverageTarget;

	if (comparePeriods(firstPeriod, lastPeriod) > 0) {
		return [];
	}

	const rangeStart = seriesGeneratedThrough
		? addMonthsToPeriod(seriesGeneratedThrough, 1)
		: firstPeriod;

	if (comparePeriods(rangeStart, lastPeriod) > 0) {
		return [];
	}

	return buildPeriodRange(rangeStart, lastPeriod);
}
