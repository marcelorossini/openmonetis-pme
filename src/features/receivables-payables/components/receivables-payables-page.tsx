"use client";

import { RiAddFill } from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
	cancelFinancialTitleAction,
	restoreFinancialTitleAction,
	resumeFinancialTitleSeriesAction,
} from "@/features/receivables-payables/actions";
import type { FinancialTitlesPageData } from "@/features/receivables-payables/queries";
import type { FinancialTitleListItem } from "@/features/receivables-payables/types";
import { ConfirmActionDialog } from "@/shared/components/confirm-action-dialog";
import { Button } from "@/shared/components/ui/button";
import { SeriesBoundaryDialog } from "./series-boundary-dialog";
import { SettlementDialog } from "./settlement-dialog";
import { TitleDialog } from "./title-dialog";
import { TitleFilters } from "./title-filters";
import { TitleSummaryCards } from "./title-summary-cards";
import { TitleTable } from "./title-table";

type ReceivablesPayablesPageProps = FinancialTitlesPageData;

export function ReceivablesPayablesPage({
	titles,
	summary,
	filters,
	options,
	pagination,
}: ReceivablesPayablesPageProps) {
	const router = useRouter();
	const [editingTitle, setEditingTitle] =
		useState<FinancialTitleListItem | null>(null);
	const [settlingTitle, setSettlingTitle] =
		useState<FinancialTitleListItem | null>(null);
	const [titleToCancel, setTitleToCancel] =
		useState<FinancialTitleListItem | null>(null);
	const [titleToRestore, setTitleToRestore] =
		useState<FinancialTitleListItem | null>(null);
	const [titleToEndSeries, setTitleToEndSeries] =
		useState<FinancialTitleListItem | null>(null);
	const [titleToExtendSeries, setTitleToExtendSeries] =
		useState<FinancialTitleListItem | null>(null);
	const [titleToResumeSeries, setTitleToResumeSeries] =
		useState<FinancialTitleListItem | null>(null);

	const refresh = () => router.refresh();

	const handleCancelConfirm = async () => {
		if (!titleToCancel) {
			return;
		}
		const result = await cancelFinancialTitleAction({ id: titleToCancel.id });
		if (result.success) {
			toast.success(result.message);
			refresh();
			return;
		}
		toast.error(result.error);
		throw new Error(result.error);
	};

	const handleRestoreConfirm = async () => {
		if (!titleToRestore) {
			return;
		}
		const result = await restoreFinancialTitleAction({ id: titleToRestore.id });
		if (result.success) {
			toast.success(result.message);
			refresh();
			return;
		}
		toast.error(result.error);
		throw new Error(result.error);
	};

	const handleResumeSeriesConfirm = async () => {
		if (!titleToResumeSeries) {
			return;
		}
		const result = await resumeFinancialTitleSeriesAction({
			id: titleToResumeSeries.id,
		});
		if (result.success) {
			toast.success(result.message);
			refresh();
			return;
		}
		toast.error(result.error);
		throw new Error(result.error);
	};

	return (
		<>
			<div className="flex flex-col gap-6">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">
							A pagar/receber
						</h1>
						<p className="text-sm text-muted-foreground">
							Controle compromissos antes da movimentação real do caixa.
						</p>
					</div>
				</div>

				<TitleSummaryCards summary={summary} />

				<TitleFilters
					filters={filters}
					partyOptions={options.partyOptions}
					categoryOptions={options.categoryOptions}
					actionSlot={
						<TitleDialog
							mode="create"
							defaultPayerId={options.defaultPayerId}
							partyOptions={options.partyOptions}
							categoryOptions={options.categoryOptions}
							accountOptions={options.accountOptions}
							payerOptions={options.payerOptions}
							onSuccess={refresh}
							trigger={
								<Button className="w-full xl:w-auto">
									<RiAddFill className="size-4" />
									Novo título
								</Button>
							}
						/>
					}
				/>

				<TitleTable
					titles={titles}
					pagination={pagination}
					onEdit={setEditingTitle}
					onSettle={setSettlingTitle}
					onCancel={setTitleToCancel}
					onRestore={setTitleToRestore}
					onEndSeries={setTitleToEndSeries}
					onExtendSeries={setTitleToExtendSeries}
					onResumeSeries={setTitleToResumeSeries}
				/>
			</div>

			<TitleDialog
				mode="update"
				title={editingTitle ?? undefined}
				open={Boolean(editingTitle)}
				onOpenChange={(value) => {
					if (!value) setEditingTitle(null);
				}}
				onSuccess={refresh}
				defaultPayerId={options.defaultPayerId}
				partyOptions={options.partyOptions}
				categoryOptions={options.categoryOptions}
				accountOptions={options.accountOptions}
				payerOptions={options.payerOptions}
			/>

			<SettlementDialog
				title={settlingTitle}
				open={Boolean(settlingTitle)}
				onOpenChange={(value) => {
					if (!value) setSettlingTitle(null);
				}}
				accountOptions={options.accountOptions}
				onSuccess={refresh}
			/>

			<SeriesBoundaryDialog
				mode="end"
				title={titleToEndSeries}
				open={Boolean(titleToEndSeries)}
				onOpenChange={(value) => {
					if (!value) setTitleToEndSeries(null);
				}}
				onSuccess={refresh}
			/>

			<SeriesBoundaryDialog
				mode="extend"
				title={titleToExtendSeries}
				open={Boolean(titleToExtendSeries)}
				onOpenChange={(value) => {
					if (!value) setTitleToExtendSeries(null);
				}}
				onSuccess={refresh}
			/>

			<ConfirmActionDialog
				open={Boolean(titleToCancel)}
				onOpenChange={(value) => {
					if (!value) setTitleToCancel(null);
				}}
				title={
					titleToCancel
						? `Cancelar "${titleToCancel.name}"?`
						: "Cancelar título?"
				}
				description="O título permanecerá salvo, mas deixará de aparecer como pendência."
				confirmLabel="Cancelar título"
				pendingLabel="Cancelando..."
				confirmVariant="destructive"
				onConfirm={handleCancelConfirm}
			/>

			<ConfirmActionDialog
				open={Boolean(titleToRestore)}
				onOpenChange={(value) => {
					if (!value) setTitleToRestore(null);
				}}
				title={
					titleToRestore
						? `Restaurar "${titleToRestore.name}"?`
						: "Restaurar título?"
				}
				description="O título voltará para a lista de pendências."
				confirmLabel="Restaurar"
				pendingLabel="Restaurando..."
				onConfirm={handleRestoreConfirm}
			/>

			<ConfirmActionDialog
				open={Boolean(titleToResumeSeries)}
				onOpenChange={(value) => {
					if (!value) setTitleToResumeSeries(null);
				}}
				title={
					titleToResumeSeries
						? `Reativar a recorrência de "${titleToResumeSeries.name}"?`
						: "Reativar recorrência?"
				}
				description="A série volta a ficar sem data final e o job diário recompõe os próximos meses."
				confirmLabel="Reativar recorrência"
				pendingLabel="Reativando..."
				onConfirm={handleResumeSeriesConfirm}
			/>
		</>
	);
}
