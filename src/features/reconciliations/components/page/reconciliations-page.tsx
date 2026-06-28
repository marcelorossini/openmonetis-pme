import Link from "next/link";
import {
	dismissInboxItemReconciliationAction,
	reconcileInboxItemAction,
} from "@/features/reconciliations/actions";
import type {
	ReconciliationFilterStatus,
	ReconciliationQueueItem,
	ReconciliationsPageData,
} from "@/features/reconciliations/types";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { formatCurrency } from "@/shared/utils/currency";
import { formatDateOnly } from "@/shared/utils/date";

const FILTER_LABELS: Record<ReconciliationFilterStatus, string> = {
	all: "Todas",
	unmatched: "Sem candidato",
	ambiguous: "Ambíguas",
};

const STATUS_LABELS = {
	unmatched: "Sem candidato",
	ambiguous: "Ambígua",
} as const;

const buildFilterHref = ({
	status,
	page,
}: {
	status: ReconciliationFilterStatus;
	page?: number;
}) => {
	const params = new URLSearchParams();
	if (status !== "all") {
		params.set("status", status);
	}
	if (page && page > 1) {
		params.set("page", String(page));
	}

	const query = params.toString();
	return query ? `/reconciliations?${query}` : "/reconciliations";
};

function FilterLink({
	status,
	activeStatus,
	count,
}: {
	status: ReconciliationFilterStatus;
	activeStatus: ReconciliationFilterStatus;
	count: number;
}) {
	return (
		<Link href={buildFilterHref({ status })}>
			<Badge variant={status === activeStatus ? "default" : "outline"}>
				{FILTER_LABELS[status]} ({count})
			</Badge>
		</Link>
	);
}

function CandidateSection({
	title,
	candidates,
	inboxItemId,
	emptyLabel,
}: {
	title: string;
	candidates: ReconciliationQueueItem["exactCandidates"];
	inboxItemId: string;
	emptyLabel: string;
}) {
	return (
		<div className="space-y-3">
			<div>
				<h3 className="text-sm font-semibold">{title}</h3>
				<p className="text-xs text-muted-foreground">{emptyLabel}</p>
			</div>

			{candidates.length === 0 ? (
				<div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
					Nenhum título listado nesta seção.
				</div>
			) : (
				<div className="space-y-3">
					{candidates.map((candidate) => (
						<div
							key={candidate.id}
							className="flex flex-col gap-3 rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
						>
							<div className="space-y-1">
								<div className="font-medium">{candidate.name}</div>
								<div className="text-sm text-muted-foreground">
									{formatCurrency(candidate.amount)} • vence em{" "}
									{formatDateOnly(candidate.dueDate)}
								</div>
								<div className="text-sm text-muted-foreground">
									{candidate.paymentMethod}
									{candidate.partyName ? ` • ${candidate.partyName}` : ""}
									{candidate.categoryName ? ` • ${candidate.categoryName}` : ""}
									{candidate.accountName ? ` • ${candidate.accountName}` : ""}
								</div>
								{candidate.description ? (
									<div className="text-sm text-muted-foreground">
										{candidate.description}
									</div>
								) : null}
							</div>

							<form action={reconcileInboxItemAction}>
								<input type="hidden" name="inboxItemId" value={inboxItemId} />
								<input type="hidden" name="titleId" value={candidate.id} />
								<Button type="submit" variant="outline">
									Conciliar
								</Button>
							</form>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function ReconciliationCard({ item }: { item: ReconciliationQueueItem }) {
	return (
		<Card>
			<CardHeader className="gap-3">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div className="space-y-1">
						<CardTitle className="text-lg">
							{item.parsedName || item.transactionName}
						</CardTitle>
						<CardDescription>
							{formatCurrency(Math.abs(item.transactionAmount))} •{" "}
							{item.transactionPaymentMethod} •{" "}
							{item.transactionPurchaseDate
								? formatDateOnly(item.transactionPurchaseDate)
								: "sem data de compra"}
						</CardDescription>
					</div>

					<Badge
						variant={
							item.reconciliationStatus === "ambiguous" ? "info" : "outline"
						}
					>
						{STATUS_LABELS[item.reconciliationStatus]}
					</Badge>
				</div>

				{item.reconciliationSummary ? (
					<p className="text-sm text-muted-foreground">
						{item.reconciliationSummary}
					</p>
				) : null}
			</CardHeader>

			<CardContent className="space-y-6">
				<div className="grid gap-4 lg:grid-cols-2">
					<div className="rounded-lg border bg-muted/30 p-4">
						<div className="mb-2 text-sm font-semibold">
							Lançamento importado
						</div>
						<div className="space-y-1 text-sm text-muted-foreground">
							<div>{item.transactionName}</div>
							<div>
								{item.transactionType} • {item.transactionPaymentMethod}
							</div>
							<div>{formatCurrency(Math.abs(item.transactionAmount))}</div>
							<div>
								{item.transactionCategoryName || "Sem categoria"}
								{item.transactionPartyName
									? ` • ${item.transactionPartyName}`
									: ""}
								{item.transactionAccountName
									? ` • ${item.transactionAccountName}`
									: ""}
							</div>
						</div>
					</div>

					<div className="rounded-lg border bg-muted/30 p-4">
						<div className="mb-2 text-sm font-semibold">Item de inbox</div>
						<div className="space-y-1 text-sm text-muted-foreground">
							<div>
								{item.originalTitle || item.sourceAppName || item.sourceApp}
							</div>
							<div>{item.originalText}</div>
							<div>
								Recebido em {formatDateOnly(item.notificationTimestamp)}
							</div>
							{item.parsedAmount !== null ? (
								<div>Valor parseado: {formatCurrency(item.parsedAmount)}</div>
							) : null}
						</div>
					</div>
				</div>

				<div className="grid gap-6 xl:grid-cols-2">
					<CandidateSection
						title="Candidatos sugeridos"
						candidates={item.exactCandidates}
						inboxItemId={item.id}
						emptyLabel="Aplicam exatamente a regra automática atual."
					/>

					<CandidateSection
						title="Busca ampliada"
						candidates={item.expandedCandidates}
						inboxItemId={item.id}
						emptyLabel="Mostra outros títulos pendentes com sinais de compatibilidade."
					/>
				</div>

				<div className="flex justify-end">
					<form action={dismissInboxItemReconciliationAction}>
						<input type="hidden" name="inboxItemId" value={item.id} />
						<Button type="submit" variant="secondary">
							Dispensar
						</Button>
					</form>
				</div>
			</CardContent>
		</Card>
	);
}

export function ReconciliationsPage({
	items,
	counts,
	pagination,
	activeStatus,
}: ReconciliationsPageData) {
	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<h1 className="text-2xl font-semibold tracking-tight">Conciliações</h1>
				<p className="text-sm text-muted-foreground">
					Revise pré-lançamentos importados automaticamente que não puderam
					baixar um título com segurança.
				</p>
			</div>

			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Fila total</CardDescription>
						<CardTitle>{counts.total}</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Sem candidato</CardDescription>
						<CardTitle>{counts.unmatched}</CardTitle>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Ambíguas</CardDescription>
						<CardTitle>{counts.ambiguous}</CardTitle>
					</CardHeader>
				</Card>
			</div>

			<div className="flex flex-wrap gap-2">
				<FilterLink
					status="all"
					activeStatus={activeStatus}
					count={counts.total}
				/>
				<FilterLink
					status="unmatched"
					activeStatus={activeStatus}
					count={counts.unmatched}
				/>
				<FilterLink
					status="ambiguous"
					activeStatus={activeStatus}
					count={counts.ambiguous}
				/>
			</div>

			{items.length === 0 ? (
				<Card>
					<CardContent className="py-10 text-center text-sm text-muted-foreground">
						Nenhuma conciliação pendente neste filtro.
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					{items.map((item) => (
						<ReconciliationCard key={item.id} item={item} />
					))}
				</div>
			)}

			{pagination.totalPages > 1 ? (
				<div className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm">
					<span className="text-muted-foreground">
						Página {pagination.page} de {pagination.totalPages}
					</span>
					<div className="flex gap-2">
						{pagination.page <= 1 ? (
							<Button variant="outline" disabled>
								Anterior
							</Button>
						) : (
							<Button asChild variant="outline">
								<Link
									href={buildFilterHref({
										status: activeStatus,
										page: pagination.page - 1,
									})}
								>
									Anterior
								</Link>
							</Button>
						)}
						{pagination.page >= pagination.totalPages ? (
							<Button variant="outline" disabled>
								Próxima
							</Button>
						) : (
							<Button asChild variant="outline">
								<Link
									href={buildFilterHref({
										status: activeStatus,
										page: pagination.page + 1,
									})}
								>
									Próxima
								</Link>
							</Button>
						)}
					</div>
				</div>
			) : null}
		</div>
	);
}
