"use client";

import type { FinancialTitleSummary } from "@/features/receivables-payables/types";
import MoneyValues from "@/shared/components/money-values";
import { Card, CardContent } from "@/shared/components/ui/card";

const cards = (summary: FinancialTitleSummary) => [
	{
		label: "A receber pendente",
		value: summary.totalReceivablePending,
		className: "text-success",
	},
	{
		label: "A pagar pendente",
		value: summary.totalPayablePending,
		className: "text-foreground",
	},
	{
		label: "Saldo previsto",
		value: summary.projectedBalance,
		className:
			summary.projectedBalance >= 0 ? "text-success" : "text-destructive",
	},
	{
		label: "Atrasados",
		value: summary.overdueCount,
		className: "text-destructive",
		isCurrency: false,
	},
	{
		label: "Baixados no período",
		value: summary.settledInPeriod,
		className: "text-primary",
		isCurrency: false,
	},
];

export function TitleSummaryCards({
	summary,
}: {
	summary: FinancialTitleSummary;
}) {
	return (
		<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
			{cards(summary).map((card) => (
				<Card key={card.label} className="shadow-none">
					<CardContent className="flex flex-col gap-1 px-4 py-3">
						<span className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
							{card.label}
						</span>
						{card.isCurrency === false ? (
							<span
								className={`text-xl font-semibold tabular-nums ${card.className}`}
							>
								{card.value}
							</span>
						) : (
							<MoneyValues
								amount={card.value}
								className={`text-xl font-semibold ${card.className}`}
							/>
						)}
					</CardContent>
				</Card>
			))}
		</div>
	);
}
