"use client";

import {
	RiArrowLeftRightLine,
	RiCheckLine,
	RiRepeatLine,
} from "@remixicon/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildFinancialTitlePaginationSearchParams } from "@/features/receivables-payables/lib/title-filters";
import type {
	FinancialTitleListItem,
	FinancialTitlesPaginationState,
} from "@/features/receivables-payables/types";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import MoneyValues from "@/shared/components/money-values";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/components/ui/table";
import { formatDate } from "@/shared/utils/date";
import { cn } from "@/shared/utils/ui";
import { TitleActionsMenu } from "./title-actions-menu";
import { TitleMobileList } from "./title-mobile-list";
import { TitlePagination } from "./title-pagination";
import { TitleStatusBadge } from "./title-status-badge";

type TitleTableProps = {
	titles: FinancialTitleListItem[];
	pagination: FinancialTitlesPaginationState;
	onEdit: (title: FinancialTitleListItem) => void;
	onSettle: (title: FinancialTitleListItem) => void;
	onCancel: (title: FinancialTitleListItem) => void;
	onRestore: (title: FinancialTitleListItem) => void;
	onEndSeries: (title: FinancialTitleListItem) => void;
	onExtendSeries: (title: FinancialTitleListItem) => void;
	onResumeSeries: (title: FinancialTitleListItem) => void;
};

export function TitleTable({
	titles,
	pagination,
	onEdit,
	onSettle,
	onCancel,
	onRestore,
	onEndSeries,
	onExtendSeries,
	onResumeSeries,
}: TitleTableProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const hasRows = titles.length > 0;

	const navigateToPage = (page: number, pageSize = pagination.pageSize) => {
		const nextParams = buildFinancialTitlePaginationSearchParams(
			searchParams.toString(),
			{ page, pageSize },
		);
		const target = nextParams.toString()
			? `${pathname}?${nextParams.toString()}`
			: pathname;
		router.replace(target, { scroll: false });
	};

	return (
		<Card className="py-2">
			<CardContent className="px-2 py-4 sm:px-4">
				{hasRows ? (
					<>
						<TitleMobileList
							titles={titles}
							onEdit={onEdit}
							onSettle={onSettle}
							onCancel={onCancel}
							onRestore={onRestore}
							onEndSeries={onEndSeries}
							onExtendSeries={onExtendSeries}
							onResumeSeries={onResumeSeries}
						/>

						<div className="hidden overflow-x-auto md:block">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="whitespace-nowrap">Título</TableHead>
										<TableHead className="whitespace-nowrap">Vínculo</TableHead>
										<TableHead className="whitespace-nowrap">
											Categoria
										</TableHead>
										<TableHead className="whitespace-nowrap">
											Vencimento
										</TableHead>
										<TableHead className="whitespace-nowrap">Status</TableHead>
										<TableHead className="whitespace-nowrap text-right">
											Valor
										</TableHead>
										<TableHead className="w-[1%] whitespace-nowrap text-right">
											Ações
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{titles.map((title) => (
										<TableRow
											key={title.id}
											className={cn(
												title.computedStatus === "overdue" &&
													"bg-destructive/3 hover:bg-destructive/5",
											)}
										>
											<TableCell>
												<div className="flex min-w-[240px] flex-col gap-1">
													<span className="font-medium">{title.name}</span>
													<div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
														<Badge
															variant="outline"
															className="px-1.5 py-0 text-[11px]"
														>
															{title.type === "payable"
																? "A pagar"
																: "A receber"}
														</Badge>
														{title.isRecurring ? (
															<Badge
																variant="secondary"
																className="gap-1 px-1.5 py-0 text-[11px]"
															>
																<RiRepeatLine className="size-3" aria-hidden />
																<span>
																	Mensal
																	{title.seriesIndex
																		? ` #${title.seriesIndex}`
																		: ""}
																</span>
															</Badge>
														) : null}
														{title.description ? (
															<span className="truncate">
																{title.description}
															</span>
														) : null}
													</div>
												</div>
											</TableCell>
											<TableCell>
												<div className="flex min-w-[180px] flex-col gap-1">
													<span>{title.partyName ?? "Sem vínculo"}</span>
													<span className="text-xs text-muted-foreground">
														{title.accountName ??
															title.payerName ??
															"Sem conta informada"}
													</span>
												</div>
											</TableCell>
											<TableCell>
												<div className="flex min-w-[180px] flex-col gap-1">
													<span>{title.categoryName ?? "Sem categoria"}</span>
													{title.seriesEndDate ? (
														<span className="text-xs text-muted-foreground">
															Até {formatDate(title.seriesEndDate)}
														</span>
													) : null}
												</div>
											</TableCell>
											<TableCell className="whitespace-nowrap">
												<div className="flex flex-col gap-1">
													<span>{formatDate(title.dueDate)}</span>
													{title.settledAt ? (
														<span className="text-xs text-muted-foreground">
															Baixado em {formatDate(title.settledAt)}
														</span>
													) : null}
												</div>
											</TableCell>
											<TableCell>
												<TitleStatusBadge status={title.computedStatus} />
											</TableCell>
											<TableCell className="text-right">
												<MoneyValues
													amount={title.amount}
													className="font-medium"
												/>
											</TableCell>
											<TableCell className="text-right">
												<div className="flex items-center justify-end gap-1">
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
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>

						<TitlePagination
							totalRows={pagination.totalItems}
							currentPage={pagination.page}
							currentPageSize={pagination.pageSize}
							totalPages={pagination.totalPages}
							canPreviousPage={pagination.page > 1}
							canNextPage={pagination.page < pagination.totalPages}
							onPageChange={(page) => navigateToPage(page)}
							onPageSizeChange={(pageSize) => navigateToPage(1, pageSize)}
						/>
					</>
				) : (
					<div className="flex w-full items-center justify-center py-12">
						<EmptyState
							media={<RiArrowLeftRightLine className="size-6 text-primary" />}
							title="Nenhum título encontrado"
							description="Ajuste os filtros ou cadastre um novo compromisso para visualizar aqui."
						/>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
