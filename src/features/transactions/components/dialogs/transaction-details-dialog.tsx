"use client";

import Image from "next/image";
import {
	type ComponentType,
	type CSSProperties,
	useEffect,
	useState,
} from "react";
import {
	currencyFormatter,
	formatCondition,
	formatPeriod,
} from "@/features/transactions/lib/formatting-helpers";
import {
	ClientAvatarLabel,
	EstablishmentLogo,
} from "@/shared/components/entity-avatar";
import { TransactionTypeBadge } from "@/shared/components/transaction-type-badge";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { Separator } from "@/shared/components/ui/separator";
import { resolveLogoSrc } from "@/shared/lib/logo";
import { getAvatarSrc } from "@/shared/lib/payers/utils";
import { getCategoryColorFromName } from "@/shared/utils/category-colors";
import { formatDate, parseLocalDateString } from "@/shared/utils/date";
import { getIconComponent, getPaymentMethodIcon } from "@/shared/utils/icons";
import { AttachmentSection } from "../attachments/attachment-section";
import { InstallmentTimeline } from "../shared/installment-timeline";
import type { TransactionItem } from "../types";

interface TransactionDetailsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	transaction: TransactionItem | null;
	onEdit?: (transaction: TransactionItem) => void;
}

export function TransactionDetailsDialog({
	open,
	onOpenChange,
	transaction,
	onEdit,
}: TransactionDetailsDialogProps) {
	const [attachmentCount, setAttachmentCount] = useState<number | null>(null);

	useEffect(() => {
		setAttachmentCount(null);
	}, []);

	if (!transaction) return null;

	const isInstallment =
		transaction.condition?.toLowerCase() === "parcelado" &&
		transaction.currentInstallment &&
		transaction.installmentCount;

	const valorParcela = Math.abs(transaction.amount);
	const totalParcelas = transaction.installmentCount ?? 1;
	const parcelaAtual = transaction.currentInstallment ?? 1;
	const valorTotal = isInstallment
		? valorParcela * totalParcelas
		: valorParcela;
	const valorRestante = isInstallment
		? valorParcela * (totalParcelas - parcelaAtual)
		: 0;

	const isBoleto = transaction.paymentMethod === "Boleto";

	const handleEdit = () => {
		onOpenChange(false);
		onEdit?.(transaction);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="min-w-0 overflow-x-hidden sm:max-w-xl">
				<DialogHeader className="text-left">
					<div className="flex min-w-0 items-start gap-2">
						<EstablishmentLogo size={40} name={transaction.name} />
						<div className="min-w-0">
							<DialogTitle className="truncate">{transaction.name}</DialogTitle>
							<DialogDescription className="mt-1">
								{formatDate(transaction.purchaseDate)}
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<div className="min-w-0 max-h-[60vh] overflow-x-hidden overflow-y-auto text-sm">
					<div className="min-w-0 space-y-4">
						<section className="rounded-lg border p-3">
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<p className="text-xs uppercase tracking-wide text-muted-foreground">
										Total
									</p>
									<p className="mt-1 text-2xl font-semibold">
										{currencyFormatter.format(valorTotal)}
									</p>
								</div>
								<Badge
									variant={transaction.isSettled ? "secondary" : "info"}
									className={
										transaction.isSettled
											? "text-success bg-success/10"
											: undefined
									}
								>
									{transaction.isSettled ? "Pago" : "Em aberto"}
								</Badge>
							</div>
							<div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
								<TransactionTypeBadge
									kind={
										transaction.categoriaName === "Saldo inicial"
											? "Saldo inicial"
											: transaction.transactionType
									}
								/>
								<span>{formatCondition(transaction.condition)}</span>
							</div>
						</section>

						<section className="space-y-2">
							<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								Detalhes
							</h3>
							<ul className="min-w-0 grid gap-2 rounded-lg border p-3">
								<DetailRow
									label="ID"
									value={transaction.id}
									valueClassName="font-mono"
								/>

								<DetailRow
									label="Período"
									value={formatPeriod(transaction.period)}
								/>

								<li className="flex items-center justify-between">
									<span className="text-muted-foreground">
										Forma de Pagamento
									</span>
									<span className="flex items-center gap-1.5">
										{getPaymentMethodIcon(transaction.paymentMethod)}
										<span>{transaction.paymentMethod}</span>
									</span>
								</li>

								<li className="min-w-0 flex items-center justify-between gap-3">
									<span className="text-muted-foreground">
										{transaction.cartaoName ? "Cartão" : "Conta"}
									</span>
									{(() => {
										const accountLabel =
											transaction.cartaoName ?? transaction.contaName;
										if (!accountLabel) {
											return <span className="min-w-0 truncate">—</span>;
										}
										const logoSrc = resolveLogoSrc(
											transaction.cartaoLogo ?? transaction.contaLogo,
										);
										return (
											<span className="inline-flex min-w-0 items-center gap-2">
												{logoSrc && (
													<Image
														src={logoSrc}
														alt={`Logo de ${accountLabel}`}
														width={20}
														height={20}
														className="shrink-0 rounded-full"
													/>
												)}
												<span className="min-w-0 truncate">{accountLabel}</span>
											</span>
										);
									})()}
								</li>

								<li className="min-w-0 flex items-center justify-between gap-3">
									<span className="text-muted-foreground">Categoria</span>
									{(() => {
										if (!transaction.categoriaName) {
											return <span className="min-w-0 truncate">—</span>;
										}
										const IconComponent = transaction.categoriaIcon
											? (getIconComponent(
													transaction.categoriaIcon,
												) as ComponentType<{
													className?: string;
													style?: CSSProperties;
												}> | null)
											: null;
										const color = getCategoryColorFromName(
											transaction.categoriaName,
										);
										return (
											<span className="inline-flex min-w-0 items-center gap-1.5">
												{IconComponent ? (
													<IconComponent
														className="size-3.5 shrink-0"
														style={{ color }}
													/>
												) : null}
												<span className="min-w-0 truncate">
													{transaction.categoriaName}
												</span>
											</span>
										);
									})()}
								</li>

								<li className="min-w-0 flex items-center justify-between gap-3">
									<span className="text-muted-foreground">Responsável</span>
									{(() => {
										const label = transaction.pagadorName?.trim() || "—";
										if (label === "—") {
											return <span className="min-w-0 truncate">—</span>;
										}
										const displayName = label.split(/\s+/)[0] ?? label;
										const avatarSrc = getAvatarSrc(transaction.pagadorAvatar);
										const initial = displayName.charAt(0).toUpperCase() || "?";
										return (
											<span className="inline-flex min-w-0 items-center gap-2">
												<Avatar className="size-5">
													<AvatarImage
														src={avatarSrc}
														alt={`Avatar de ${label}`}
													/>
													<AvatarFallback className="text-[10px] font-medium uppercase">
														{initial}
													</AvatarFallback>
												</Avatar>
												<span className="min-w-0 truncate">{label}</span>
											</span>
										);
									})()}
								</li>

								<li className="min-w-0 flex items-center justify-between gap-3">
									<span className="text-muted-foreground">
										Cliente/Fornecedor
									</span>
									{transaction.partyName?.trim() ? (
										<ClientAvatarLabel
											name={transaction.partyName.trim()}
											size="xs"
										/>
									) : (
										<span className="min-w-0 truncate">—</span>
									)}
								</li>

								{isBoleto && transaction.dueDate && (
									<DetailRow
										label="Vencimento"
										value={formatDate(transaction.dueDate)}
									/>
								)}

								{transaction.isDivided && (
									<li className="flex items-center justify-between">
										<span className="text-muted-foreground">Divisão</span>
										<Badge variant="outline">Dividido</Badge>
									</li>
								)}
							</ul>
						</section>

						<section className="space-y-2">
							<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								Valores
							</h3>
							<ul className="min-w-0 grid gap-2 rounded-lg border p-3">
								{isInstallment && (
									<li className="mb-1">
										<InstallmentTimeline
											purchaseDate={parseLocalDateString(
												transaction.purchaseDate,
											)}
											currentInstallment={parcelaAtual}
											totalInstallments={totalParcelas}
											period={transaction.period}
										/>
									</li>
								)}

								<DetailRow
									label={isInstallment ? "Valor da Parcela" : "Valor"}
									value={currencyFormatter.format(valorParcela)}
								/>

								{isInstallment && (
									<DetailRow
										label="Valor Restante"
										value={currencyFormatter.format(valorRestante)}
									/>
								)}

								{transaction.recurrenceCount && (
									<DetailRow
										label="Quantidade de Recorrências"
										value={`${transaction.recurrenceCount} meses`}
									/>
								)}
							</ul>
						</section>

						{transaction.note ? (
							<section className="space-y-2">
								<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									Notas
								</h3>
								<div className="rounded-lg border p-3 text-foreground">
									{transaction.note}
								</div>
							</section>
						) : null}

						{attachmentCount !== 0 && (
							<section className="space-y-2">
								<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									Anexos
								</h3>
								<div className="min-w-0">
									<AttachmentSection
										transactionId={transaction.id}
										readonly
										onLoaded={setAttachmentCount}
									/>
								</div>
							</section>
						)}
					</div>
				</div>

				<Separator />

				<DialogFooter>
					<DialogClose asChild>
						<Button type="button" variant="outline">
							Fechar
						</Button>
					</DialogClose>
					{onEdit && !transaction.readonly && (
						<Button onClick={handleEdit}>Alterar</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

interface DetailRowProps {
	label: string;
	value: string;
	valueClassName?: string;
}

function DetailRow({ label, value, valueClassName }: DetailRowProps) {
	return (
		<li className="min-w-0 flex items-center justify-between gap-3">
			<span className="text-muted-foreground">{label}</span>
			<span className={`min-w-0 truncate ${valueClassName ?? ""}`}>
				{value}
			</span>
		</li>
	);
}
