"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	useCallback,
	useEffect,
	useMemo,
	useState,
	useTransition,
} from "react";
import { toast } from "sonner";
import {
	bulkDeleteInboxItemsAction,
	bulkDeleteSelectedInboxItemsAction,
	bulkDiscardInboxItemsAction,
	deleteInboxItemAction,
	discardInboxItemAction,
	markInboxAsProcessedAction,
	restoreDiscardedInboxItemAction,
} from "@/features/inbox/actions";
import { INBOX_DEFAULT_PAGE_SIZE } from "@/features/inbox/page-helpers";
import { TransactionDialog } from "@/features/transactions/components/dialogs/transaction-dialog/transaction-dialog";
import { ConfirmActionDialog } from "@/shared/components/confirm-action-dialog";
import { Tabs, TabsContent } from "@/shared/components/ui/tabs";
import { InboxBulkActions } from "./inbox-bulk-actions";
import { InboxDetailsDialog } from "./inbox-details-dialog";
import { InboxItemsList } from "./inbox-items-list";
import { InboxPagination } from "./inbox-pagination";
import { InboxTabs } from "./inbox-tabs";
import type {
	InboxItem,
	InboxPaginationState,
	InboxStatus,
	InboxStatusCounts,
	SelectOption,
} from "./types";

interface InboxPageProps {
	activeStatus: InboxStatus;
	activeApp: string | null;
	sourceApps: string[];
	items: InboxItem[];
	counts: InboxStatusCounts;
	pagination: InboxPaginationState;
	payerOptions: SelectOption[];
	splitPayerOptions: SelectOption[];
	defaultPayerId: string | null;
	partyOptions: SelectOption[];
	accountOptions: SelectOption[];
	cardOptions: SelectOption[];
	categoryOptions: SelectOption[];
	estabelecimentos: string[];
	appLogoMap: Record<string, string>;
}

export function InboxPage({
	activeStatus,
	activeApp,
	sourceApps = [],
	items,
	counts,
	pagination,
	payerOptions,
	splitPayerOptions,
	defaultPayerId,
	partyOptions,
	accountOptions,
	cardOptions,
	categoryOptions,
	estabelecimentos,
	appLogoMap,
}: InboxPageProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [isPending, startTransition] = useTransition();
	const [processOpen, setProcessOpen] = useState(false);
	const [itemToProcess, setItemToProcess] = useState<InboxItem | null>(null);

	const [detailsOpen, setDetailsOpen] = useState(false);
	const [itemDetails, setItemDetails] = useState<InboxItem | null>(null);

	const [discardOpen, setDiscardOpen] = useState(false);
	const [itemToDiscard, setItemToDiscard] = useState<InboxItem | null>(null);

	const [deleteOpen, setDeleteOpen] = useState(false);
	const [itemToDelete, setItemToDelete] = useState<InboxItem | null>(null);

	const [restoreOpen, setRestoreOpen] = useState(false);
	const [itemToRestore, setItemToRestore] = useState<InboxItem | null>(null);

	const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
	const [bulkDeleteStatus, setBulkDeleteStatus] = useState<
		"processed" | "discarded"
	>("processed");

	const [selectedIds, setSelectedIds] = useState<string[]>([]);

	const [selectionBulkOpen, setSelectionBulkOpen] = useState(false);
	const [selectionBulkStatus, setSelectionBulkStatus] =
		useState<InboxStatus>("pending");

	const normalizedSourceApps = useMemo(() => {
		if (!Array.isArray(sourceApps)) return [];
		const uniqueApps = new Set<string>();
		for (const app of sourceApps) {
			if (typeof app !== "string") continue;
			const trimmedApp = app.trim();
			if (!trimmedApp) continue;
			uniqueApps.add(trimmedApp);
		}
		return [...uniqueApps].sort((left, right) =>
			left.localeCompare(right, "pt-BR"),
		);
	}, [sourceApps]);

	const appFilterOptions =
		activeApp && !normalizedSourceApps.includes(activeApp)
			? [activeApp, ...normalizedSourceApps]
			: normalizedSourceApps;

	const handleProcessOpenChange = (open: boolean) => {
		setProcessOpen(open);
		if (!open) setItemToProcess(null);
	};

	const handleDetailsOpenChange = (open: boolean) => {
		setDetailsOpen(open);
		if (!open) setItemDetails(null);
	};

	const handleDiscardOpenChange = (open: boolean) => {
		setDiscardOpen(open);
		if (!open) setItemToDiscard(null);
	};

	const handleProcessRequest = useCallback((item: InboxItem) => {
		setItemToProcess(item);
		setProcessOpen(true);
	}, []);

	const handleDetailsRequest = useCallback((item: InboxItem) => {
		setItemDetails(item);
		setDetailsOpen(true);
	}, []);

	const handleDiscardRequest = useCallback((item: InboxItem) => {
		setItemToDiscard(item);
		setDiscardOpen(true);
	}, []);

	const handleDiscardConfirm = async () => {
		if (!itemToDiscard) return;
		const result = await discardInboxItemAction({
			inboxItemId: itemToDiscard.id,
		});
		if (result.success) {
			toast.success(result.message);
			return;
		}
		toast.error(result.error);
		throw new Error(result.error);
	};

	const handleDeleteOpenChange = (open: boolean) => {
		setDeleteOpen(open);
		if (!open) setItemToDelete(null);
	};

	const handleDeleteRequest = useCallback((item: InboxItem) => {
		setItemToDelete(item);
		setDeleteOpen(true);
	}, []);

	const handleDeleteConfirm = async () => {
		if (!itemToDelete) return;
		const result = await deleteInboxItemAction({
			inboxItemId: itemToDelete.id,
		});
		if (result.success) {
			toast.success(result.message);
			return;
		}
		toast.error(result.error);
		throw new Error(result.error);
	};

	const handleRestoreOpenChange = (open: boolean) => {
		setRestoreOpen(open);
		if (!open) setItemToRestore(null);
	};

	const handleRestoreRequest = useCallback((item: InboxItem) => {
		setItemToRestore(item);
		setRestoreOpen(true);
	}, []);

	const handleRestoreToPendingConfirm = async () => {
		if (!itemToRestore) return;
		const result = await restoreDiscardedInboxItemAction({
			inboxItemId: itemToRestore.id,
		});
		if (result.success) {
			toast.success(result.message);
			return;
		}
		toast.error(result.error);
		throw new Error(result.error);
	};

	useEffect(() => {
		const visibleIds = new Set(items.map((item) => item.id));
		setSelectedIds((current) => current.filter((id) => visibleIds.has(id)));
	}, [items]);

	const toggleSelection = useCallback((id: string) => {
		setSelectedIds((current) =>
			current.includes(id)
				? current.filter((value) => value !== id)
				: [...current, id],
		);
	}, []);

	const allSelected = items.length > 0 && selectedIds.length === items.length;

	const toggleSelectAll = () => {
		if (allSelected) {
			setSelectedIds([]);
			return;
		}
		setSelectedIds(items.map((item) => item.id));
	};

	const updateUrl = (
		nextStatus: InboxStatus,
		nextPage: number,
		nextPageSize: number,
	) => {
		const nextParams = new URLSearchParams(searchParams.toString());
		if (nextStatus === "pending") {
			nextParams.delete("status");
		} else {
			nextParams.set("status", nextStatus);
		}
		if (nextPage <= 1) {
			nextParams.delete("page");
		} else {
			nextParams.set("page", nextPage.toString());
		}
		if (nextPageSize === INBOX_DEFAULT_PAGE_SIZE) {
			nextParams.delete("pageSize");
		} else {
			nextParams.set("pageSize", nextPageSize.toString());
		}
		startTransition(() => {
			const target = nextParams.toString()
				? `${pathname}?${nextParams.toString()}`
				: pathname;
			router.replace(target, { scroll: false });
		});
	};

	const handleAppChange = (nextApp: string) => {
		const nextParams = new URLSearchParams(searchParams.toString());
		if (nextApp === "all") {
			nextParams.delete("app");
		} else {
			nextParams.set("app", nextApp);
		}
		nextParams.delete("page");
		startTransition(() => {
			const target = nextParams.toString()
				? `${pathname}?${nextParams.toString()}`
				: pathname;
			router.replace(target, { scroll: false });
		});
	};

	const handleTabChange = (nextStatus: string) => {
		const nextParams = new URLSearchParams(searchParams.toString());
		nextParams.delete("app");
		if (nextStatus === "pending") {
			nextParams.delete("status");
		} else {
			nextParams.set("status", nextStatus);
		}
		nextParams.delete("page");
		if (pagination.pageSize === INBOX_DEFAULT_PAGE_SIZE) {
			nextParams.delete("pageSize");
		} else {
			nextParams.set("pageSize", pagination.pageSize.toString());
		}
		startTransition(() => {
			const target = nextParams.toString()
				? `${pathname}?${nextParams.toString()}`
				: pathname;
			router.replace(target, { scroll: false });
		});
	};

	const handleSelectionBulkRequest = (status: InboxStatus) => {
		if (selectedIds.length === 0) return;
		setSelectionBulkStatus(status);
		setSelectionBulkOpen(true);
	};

	const handleSelectionBulkConfirm = async () => {
		if (selectionBulkStatus === "pending") {
			const result = await bulkDiscardInboxItemsAction({
				inboxItemIds: selectedIds,
			});
			if (result.success) {
				toast.success(result.message);
				setSelectedIds([]);
				return;
			}
			toast.error(result.error);
			throw new Error(result.error);
		} else {
			const result = await bulkDeleteSelectedInboxItemsAction({
				inboxItemIds: selectedIds,
			});
			if (result.success) {
				toast.success(result.message);
				setSelectedIds([]);
				return;
			}
			toast.error(result.error);
			throw new Error(result.error);
		}
	};

	const handleBulkDeleteRequest = (status: "processed" | "discarded") => {
		setBulkDeleteStatus(status);
		setBulkDeleteOpen(true);
	};

	const handleBulkDeleteConfirm = async () => {
		const result = await bulkDeleteInboxItemsAction({
			status: bulkDeleteStatus,
		});
		if (result.success) {
			toast.success(result.message);
			return;
		}
		toast.error(result.error);
		throw new Error(result.error);
	};

	const handleLancamentoSuccess = async () => {
		if (!itemToProcess) return;
		const result = await markInboxAsProcessedAction({
			inboxItemId: itemToProcess.id,
		});
		if (result.success) {
			toast.success("Notificação processada!");
		} else {
			toast.error(result.error);
		}
	};

	const getDateString = (
		date: Date | string | null | undefined,
	): string | null => {
		if (!date) return null;
		if (typeof date === "string") return date.slice(0, 10);
		return date.toISOString().slice(0, 10);
	};

	const defaultPurchaseDate =
		getDateString(itemToProcess?.purchaseDate) ??
		getDateString(itemToProcess?.notificationTimestamp) ??
		null;
	const defaultName = itemToProcess?.parsedName
		? itemToProcess.parsedName
				.toLowerCase()
				.replace(/\b\w/g, (char) => char.toUpperCase())
		: null;
	const defaultAmount = itemToProcess?.parsedAmount
		? String(Math.abs(Number(itemToProcess.parsedAmount)))
		: null;

	const matchedCartaoId = useMemo(() => {
		const appName = itemToProcess?.sourceAppName?.toLowerCase();
		if (!appName) return null;
		for (const option of cardOptions) {
			const label = option.label.toLowerCase();
			if (label.includes(appName) || appName.includes(label))
				return option.value;
		}
		return null;
	}, [itemToProcess?.sourceAppName, cardOptions]);
	const defaultCardId = itemToProcess?.cardId ?? matchedCartaoId;
	const defaultPaymentMethod =
		itemToProcess?.paymentMethod ??
		(defaultCardId ? "Cartão de crédito" : null);
	const defaultDialogPayerId = itemToProcess?.payerId ?? defaultPayerId;
	const defaultTransactionType =
		itemToProcess?.transactionType === "Receita" ? "Receita" : "Despesa";

	const showTabActions = (status: InboxStatus) =>
		activeStatus === status &&
		(appFilterOptions.length > 0 || items.length > 0);

	return (
		<>
			<Tabs
				value={activeStatus}
				onValueChange={handleTabChange}
				className="w-full"
			>
				<InboxTabs counts={counts} isPending={isPending} />

				<TabsContent value="pending" className="mt-4">
					{showTabActions("pending") && (
						<InboxBulkActions
							status="pending"
							items={items}
							activeApp={activeApp}
							appFilterOptions={appFilterOptions}
							selectedIds={selectedIds}
							allSelected={allSelected}
							appLogoMap={appLogoMap}
							onAppChange={handleAppChange}
							onToggleSelectAll={toggleSelectAll}
							onSelectionBulkRequest={handleSelectionBulkRequest}
							onBulkDeleteRequest={handleBulkDeleteRequest}
						/>
					)}
					{activeStatus === "pending" && (
						<InboxItemsList
							items={items}
							readonly={false}
							activeApp={activeApp}
							appLogoMap={appLogoMap}
							selectedIds={selectedIds}
							onProcess={handleProcessRequest}
							onDiscard={handleDiscardRequest}
							onViewDetails={handleDetailsRequest}
							onSelectToggle={toggleSelection}
						/>
					)}
				</TabsContent>

				<TabsContent value="processed" className="mt-4">
					{showTabActions("processed") && (
						<InboxBulkActions
							status="processed"
							items={items}
							activeApp={activeApp}
							appFilterOptions={appFilterOptions}
							selectedIds={selectedIds}
							allSelected={allSelected}
							appLogoMap={appLogoMap}
							onAppChange={handleAppChange}
							onToggleSelectAll={toggleSelectAll}
							onSelectionBulkRequest={handleSelectionBulkRequest}
							onBulkDeleteRequest={handleBulkDeleteRequest}
						/>
					)}
					{activeStatus === "processed" && (
						<InboxItemsList
							items={items}
							readonly
							activeApp={activeApp}
							appLogoMap={appLogoMap}
							selectedIds={selectedIds}
							onDelete={handleDeleteRequest}
							onRestoreToPending={handleRestoreRequest}
							onSelectToggle={toggleSelection}
						/>
					)}
				</TabsContent>

				<TabsContent value="discarded" className="mt-4">
					{showTabActions("discarded") && (
						<InboxBulkActions
							status="discarded"
							items={items}
							activeApp={activeApp}
							appFilterOptions={appFilterOptions}
							selectedIds={selectedIds}
							allSelected={allSelected}
							appLogoMap={appLogoMap}
							onAppChange={handleAppChange}
							onToggleSelectAll={toggleSelectAll}
							onSelectionBulkRequest={handleSelectionBulkRequest}
							onBulkDeleteRequest={handleBulkDeleteRequest}
						/>
					)}
					{activeStatus === "discarded" && (
						<InboxItemsList
							items={items}
							readonly
							activeApp={activeApp}
							appLogoMap={appLogoMap}
							selectedIds={selectedIds}
							onDelete={handleDeleteRequest}
							onRestoreToPending={handleRestoreRequest}
							onSelectToggle={toggleSelection}
						/>
					)}
				</TabsContent>
			</Tabs>

			<InboxPagination
				pagination={pagination}
				activeStatus={activeStatus}
				isPending={isPending}
				onNavigate={updateUrl}
			/>

			<TransactionDialog
				mode="create"
				open={processOpen}
				onOpenChange={handleProcessOpenChange}
				payerOptions={payerOptions}
				splitPayerOptions={splitPayerOptions}
				partyOptions={partyOptions}
				accountOptions={accountOptions}
				cardOptions={cardOptions}
				categoryOptions={categoryOptions}
				estabelecimentos={estabelecimentos}
				defaultPurchaseDate={defaultPurchaseDate}
				defaultName={defaultName}
				defaultAmount={defaultAmount}
				defaultAccountId={itemToProcess?.accountId ?? null}
				defaultCardId={defaultCardId}
				defaultCategoryId={itemToProcess?.categoryId ?? null}
				defaultPartyId={itemToProcess?.partyId ?? null}
				defaultPaymentMethod={defaultPaymentMethod}
				defaultTransactionType={defaultTransactionType}
				defaultPayerId={defaultDialogPayerId}
				forceShowTransactionType
				onSuccess={handleLancamentoSuccess}
			/>

			<InboxDetailsDialog
				open={detailsOpen}
				onOpenChange={handleDetailsOpenChange}
				item={itemDetails}
				onProcess={handleProcessRequest}
			/>

			<ConfirmActionDialog
				open={discardOpen}
				onOpenChange={handleDiscardOpenChange}
				title="Descartar notificação?"
				description="A notificação será marcada como descartada e não aparecerá mais na lista de pendentes."
				confirmLabel="Descartar"
				confirmVariant="destructive"
				pendingLabel="Descartando..."
				onConfirm={handleDiscardConfirm}
			/>

			<ConfirmActionDialog
				open={deleteOpen}
				onOpenChange={handleDeleteOpenChange}
				title="Excluir notificação?"
				description="A notificação será excluída permanentemente."
				confirmLabel="Excluir"
				confirmVariant="destructive"
				pendingLabel="Excluindo..."
				onConfirm={handleDeleteConfirm}
			/>

			<ConfirmActionDialog
				open={restoreOpen}
				onOpenChange={handleRestoreOpenChange}
				title="Retornar para pendentes?"
				description="A notificação voltará para a lista de pendentes e poderá ser processada depois."
				confirmLabel="Retornar"
				pendingLabel="Retornando..."
				onConfirm={handleRestoreToPendingConfirm}
			/>

			<ConfirmActionDialog
				open={bulkDeleteOpen}
				onOpenChange={setBulkDeleteOpen}
				title={`Limpar ${bulkDeleteStatus === "processed" ? "processados" : "descartados"}?`}
				description={`Todos os itens ${bulkDeleteStatus === "processed" ? "processados" : "descartados"} serão excluídos permanentemente.`}
				confirmLabel="Limpar tudo"
				confirmVariant="destructive"
				pendingLabel="Excluindo..."
				onConfirm={handleBulkDeleteConfirm}
			/>

			<ConfirmActionDialog
				open={selectionBulkOpen}
				onOpenChange={setSelectionBulkOpen}
				title={
					selectionBulkStatus === "pending"
						? "Descartar selecionados?"
						: "Excluir selecionados?"
				}
				description={
					selectionBulkStatus === "pending"
						? `${selectedIds.length} item(s) serão descartados.`
						: `${selectedIds.length} item(s) serão excluídos permanentemente.`
				}
				confirmLabel={
					selectionBulkStatus === "pending" ? "Descartar" : "Excluir"
				}
				confirmVariant="destructive"
				pendingLabel={
					selectionBulkStatus === "pending" ? "Descartando..." : "Excluindo..."
				}
				onConfirm={handleSelectionBulkConfirm}
			/>
		</>
	);
}
