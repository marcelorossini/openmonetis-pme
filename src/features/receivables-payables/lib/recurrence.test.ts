import assert from "node:assert/strict";
import test from "node:test";
import {
	buildSeriesPeriodsToGenerate,
	getMonthlySeriesDueDate,
	getRecurringSeriesIndex,
	getSeriesCoverageTargetPeriod,
	normalizeRecurringDueDateForPeriod,
} from "./recurrence";

test("getMonthlySeriesDueDate usa o último dia do mês quando o dia âncora não existe", () => {
	assert.equal(getMonthlySeriesDueDate("2026-02", 31), "2026-02-28");
	assert.equal(getMonthlySeriesDueDate("2028-02", 31), "2028-02-29");
	assert.equal(getMonthlySeriesDueDate("2026-04", 30), "2026-04-30");
});

test("getSeriesCoverageTargetPeriod mantém 12 meses posteriores ao período de referência", () => {
	assert.equal(
		getSeriesCoverageTargetPeriod({
			currentPeriod: "2026-07",
			horizonMonths: 12,
			seriesStartPeriod: "2026-03",
		}),
		"2027-07",
	);
	assert.equal(
		getSeriesCoverageTargetPeriod({
			currentPeriod: "2026-07",
			horizonMonths: 12,
			seriesStartPeriod: "2026-12",
		}),
		"2027-12",
	);
});

test("buildSeriesPeriodsToGenerate gera apenas os meses faltantes até o horizonte", () => {
	assert.deepEqual(
		buildSeriesPeriodsToGenerate({
			currentPeriod: "2026-07",
			generateRetroactive: false,
			horizonMonths: 12,
			seriesGeneratedThrough: "2026-09",
			seriesStartPeriod: "2026-07",
		}),
		[
			"2026-10",
			"2026-11",
			"2026-12",
			"2027-01",
			"2027-02",
			"2027-03",
			"2027-04",
			"2027-05",
			"2027-06",
			"2027-07",
		],
	);
});

test("buildSeriesPeriodsToGenerate respeita retroativo e data final inclusiva", () => {
	assert.deepEqual(
		buildSeriesPeriodsToGenerate({
			currentPeriod: "2026-07",
			generateRetroactive: true,
			horizonMonths: 12,
			seriesGeneratedThrough: null,
			seriesStartPeriod: "2026-05",
			seriesEndPeriod: "2026-08",
		}),
		["2026-05", "2026-06", "2026-07", "2026-08"],
	);
	assert.deepEqual(
		buildSeriesPeriodsToGenerate({
			currentPeriod: "2026-07",
			generateRetroactive: false,
			horizonMonths: 12,
			seriesGeneratedThrough: null,
			seriesStartPeriod: "2026-05",
			seriesEndPeriod: "2026-08",
		}),
		["2026-07", "2026-08"],
	);
});

test("getRecurringSeriesIndex calcula a posição da ocorrência dentro da série", () => {
	assert.equal(
		getRecurringSeriesIndex({
			seriesStartPeriod: "2026-05",
			targetPeriod: "2026-05",
		}),
		1,
	);
	assert.equal(
		getRecurringSeriesIndex({
			seriesStartPeriod: "2026-05",
			targetPeriod: "2026-08",
		}),
		4,
	);
});

test("normalizeRecurringDueDateForPeriod mantém a edição dentro do mês da ocorrência", () => {
	assert.equal(
		normalizeRecurringDueDateForPeriod({
			competencePeriod: "2026-02",
			selectedDate: "2026-03-31",
		}),
		"2026-02-28",
	);
	assert.equal(
		normalizeRecurringDueDateForPeriod({
			competencePeriod: "2026-11",
			selectedDate: "2026-11-15",
		}),
		"2026-11-15",
	);
});
