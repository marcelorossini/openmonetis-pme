"use client";

import { RiCheckLine, RiRepeatLine } from "@remixicon/react";
import type { FinancialTitleListItem } from "@/features/receivables-payables/types";
import MoneyValues from "@/shared/components/money-values";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { formatDate } from "@/shared/utils/date";
import { cn } from "@/shared/utils/ui";
import { TitleActionsMenu } from "./title-actions-menu";
import { TitleStatusBadge } from "./title-status-badge";

type TitleMobileListProps = {
	titles: FinancialTitleListItem[];
	onEdit: (title: FinancialTitleListItem) => void;
	onSettle: (title: FinancialTitleListItem) => void;
	onCancel: (title: FinancialTitleListItem) => void;
	onRestore: (title: FinancialTitleListItem) => void;
	onEndSeries: (title: FinancialTitleListItem) => void;
	onExtendSeries: (title: FinancialTitleListItem) => void;
	onResumeSeries: (title: FinancialTitleListItem) => void;
};

export function TitleMobileList({
	titles,
	onEdit,
	onSettle,
	onCancel,
	onRestore,
	onEndSeries,
	onExtendSeries,
	onResumeSeries,
}: TitleMobileListProps) {
	return (
		<div className="space-y-3 md:hidden">
			{titles.map((title) => (
				<article
					key={title.id}
					className={cn(
						"rounded-md border bg-card px-3 py-2.5 shadow-xs",
						title.computedStatus === "overdue" &&
							"border-destructive/20 bg-destructive/3",
					)}
				>
					<div className="flex items-start gap-3">
						<div className="min-w-0 flex-1">
							<div className="flex items-start justify-between gap-2">
								<div className="min-w-0">
									<h3 className="truncate text-sm font-semibold leading-tight">
										{title.name}
									</h3>
									<div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
										<span>Venc. {formatDate(title.dueDate)}</span>
										<span>{title.partyName ?? "Sem vínculo"}</span>
										{title.accountName ? (
											<span>{title.accountName}</span>
										) : null}
									</div>
								</div>
								<TitleActionsMenu
									title={title}
									onEdit={onEdit}
									onCancel={onCancel}
									onRestore={onRestore}
									onEndSeries={onEndSeries}
									onExtendSeries={onExtendSeries}
									onResumeSeries={onResumeSeries}
								/>
							</div>

							<div className="mt-2 flex items-center justify-between gap-2">
								<div className="flex min-w-0 flex-wrap items-center gap-1.5">
									<Badge variant="outline" className="px-1.5 text-xs">
										{title.type === "payable" ? "A pagar" : "A receber"}
									</Badge>
									{title.categoryName ? (
										<Badge variant="secondary" className="px-1.5 text-xs">
											{title.categoryName}
										</Badge>
									) : null}
									{title.isRecurring ? (
										<Badge variant="secondary" className="gap-1 px-1.5 text-xs">
											<RiRepeatLine className="size-3" aria-hidden />
											<span>
												Mensal
												{title.seriesIndex ? ` #${title.seriesIndex}` : ""}
											</span>
										</Badge>
									) : null}
								</div>
								<TitleStatusBadge status={title.computedStatus} />
							</div>
						</div>
					</div>

					<div className="mt-3 flex items-center justify-between gap-3">
						<MoneyValues
							amount={title.amount}
							className="text-sm font-semibold"
						/>
						{title.status === "pending" ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => onSettle(title)}
							>
								<RiCheckLine className="size-4" />
								{title.type === "payable" ? "Pagar" : "Receber"}
							</Button>
						) : null}
					</div>
				</article>
			))}
		</div>
	);
}
