"use client";

import Link from "next/link";
import { dashboardWidgetListStyles as styles } from "@/features/dashboard/components/dashboard-widget-list-styles";
import { TitleStatusBadge } from "@/features/receivables-payables/components/title-status-badge";
import type { DashboardFinancialTitlesSnapshot } from "@/features/receivables-payables/queries";
import MoneyValues from "@/shared/components/money-values";
import { WidgetEmptyState } from "@/shared/components/widgets/widget-empty-state";
import { formatDate } from "@/shared/utils/date";

type FinancialTitlesWidgetProps = {
	snapshot: DashboardFinancialTitlesSnapshot;
	period: string;
};

export function FinancialTitlesWidget({
	snapshot,
	period,
}: FinancialTitlesWidgetProps) {
	if (snapshot.items.length === 0) {
		return (
			<WidgetEmptyState
				title="Nenhuma pendência"
				description="Sem títulos atrasados ou vencendo no período."
			/>
		);
	}

	return (
		<div className="flex flex-col">
			{snapshot.items.map((item) => (
				<div key={item.id} className={styles.row}>
					<div className={styles.main}>
						<div className={styles.textStack}>
							<p className={styles.title}>{item.name}</p>
							<div className={styles.meta}>
								<span>{item.partyName ?? "Sem vínculo"}</span>
								<span>{formatDate(item.dueDate)}</span>
							</div>
						</div>
					</div>

					<div className={styles.trailing}>
						<MoneyValues
							amount={item.amount}
							className={styles.trailingValue}
						/>
						<TitleStatusBadge status={item.computedStatus} />
					</div>
				</div>
			))}

			<div className="pt-2">
				<Link
					href={`/receivables-payables?periodo=${period}`}
					className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
				>
					Ver todos
				</Link>
			</div>
		</div>
	);
}
