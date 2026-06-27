"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import MoneyValues from "@/shared/components/money-values";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { Separator } from "@/shared/components/ui/separator";
import type { InboxItem } from "./types";

const STATUS_LABELS: Record<string, string> = {
	pending: "Pendente",
	processed: "Processado",
	discarded: "Descartado",
};

interface InboxDetailsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	item: InboxItem | null;
	onProcess?: (item: InboxItem) => void;
}

export function InboxDetailsDialog({
	open,
	onOpenChange,
	item,
	onProcess,
}: InboxDetailsDialogProps) {
	if (!item) return null;

	const amount = item.parsedAmount ? parseFloat(item.parsedAmount) : null;
	const isPending = item.status === "pending";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Detalhes da Notificação</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div>
						<div className="grid gap-2 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">App</span>
								<div className="flex flex-col items-end gap-0.5">
									<span>{item.sourceAppName || item.sourceApp}</span>
									{item.sourceAppName && (
										<span className="font-mono text-xs text-muted-foreground">
											{item.sourceApp}
										</span>
									)}
									{item.profileKey && (
										<span className="font-mono text-xs text-muted-foreground">
											Perfil: {item.profileKey}
										</span>
									)}
								</div>
							</div>
						</div>
					</div>

					<Separator />

					<div>
						<h4 className="mb-1 text-sm font-semibold text-muted-foreground">
							Notificação Original
						</h4>
						{item.originalTitle && (
							<p className="mb-1 font-medium">{item.originalTitle}</p>
						)}
						<p className="text-sm">{item.originalText}</p>
					</div>

					<Separator />

					<div>
						<div className="grid gap-2 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Estabelecimento</span>
								<span>{item.parsedName || "Não extraído"}</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">Valor</span>
								{amount !== null ? (
									<MoneyValues amount={amount} className="text-sm" />
								) : (
									<span className="text-muted-foreground">Não extraído</span>
								)}
							</div>
							{item.purchaseDate && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">Data da compra</span>
									<span>
										{format(new Date(item.purchaseDate), "dd/MM/yyyy", {
											locale: ptBR,
										})}
									</span>
								</div>
							)}
							{item.transactionType && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">Tipo</span>
									<span>{item.transactionType}</span>
								</div>
							)}
							{item.paymentMethod && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">
										Forma de pagamento
									</span>
									<span>{item.paymentMethod}</span>
								</div>
							)}
							{item.accountExternalKey && (
								<div className="flex justify-between gap-4">
									<span className="text-muted-foreground">
										Valor externo conta
									</span>
									<span className="break-all text-right">
										{item.accountExternalKey}
									</span>
								</div>
							)}
							{item.partyExternalKey && (
								<div className="flex justify-between gap-4">
									<span className="text-muted-foreground">
										Valor externo cliente/fornecedor
									</span>
									<span className="break-all text-right">
										{item.partyExternalKey}
									</span>
								</div>
							)}
							{item.categoryExternalKey && (
								<div className="flex justify-between gap-4">
									<span className="text-muted-foreground">
										Valor externo categoria
									</span>
									<span className="break-all text-right">
										{item.categoryExternalKey}
									</span>
								</div>
							)}
							{item.autoImportRequested && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">Autoimportação</span>
									<span>
										{item.status === "processed" ? "Concluída" : "Pendente"}
									</span>
								</div>
							)}
							{item.autoImportError && (
								<div className="rounded-md border border-warning/30 bg-warning/10 p-2 text-sm">
									<span className="font-medium">Motivo: </span>
									{item.autoImportError}
								</div>
							)}
						</div>
					</div>

					<Separator />

					<div>
						<div className="grid gap-2 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Status</span>
								<Badge variant="outline">
									{STATUS_LABELS[item.status] ?? item.status}
								</Badge>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Criado em</span>
								<span>
									{format(new Date(item.createdAt), "PPpp", { locale: ptBR })}
								</span>
							</div>
						</div>
					</div>
				</div>

				<DialogFooter>
					<DialogClose asChild>
						<Button type="button" variant="outline">
							Fechar
						</Button>
					</DialogClose>
					{isPending && onProcess && (
						<Button
							type="button"
							onClick={() => {
								onOpenChange(false);
								onProcess(item);
							}}
						>
							Lançar
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
