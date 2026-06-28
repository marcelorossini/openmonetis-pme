"use client";

import {
	RiExternalLinkLine,
	RiMoreFill,
	RiPencilLine,
	RiRestartLine,
	RiStopLine,
} from "@remixicon/react";
import { useRouter } from "next/navigation";
import type { FinancialTitleListItem } from "@/features/receivables-payables/types";
import { Button } from "@/shared/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

type TitleActionsMenuProps = {
	title: FinancialTitleListItem;
	onEdit: (title: FinancialTitleListItem) => void;
	onCancel: (title: FinancialTitleListItem) => void;
	onRestore: (title: FinancialTitleListItem) => void;
	onEndSeries: (title: FinancialTitleListItem) => void;
	onExtendSeries: (title: FinancialTitleListItem) => void;
	onResumeSeries: (title: FinancialTitleListItem) => void;
};

export function TitleActionsMenu({
	title,
	onEdit,
	onCancel,
	onRestore,
	onEndSeries,
	onExtendSeries,
	onResumeSeries,
}: TitleActionsMenuProps) {
	const router = useRouter();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon-sm">
					<RiMoreFill className="size-4" aria-hidden />
					<span className="sr-only">Abrir ações do título</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-52">
				<DropdownMenuItem onSelect={() => onEdit(title)}>
					<RiPencilLine className="size-4" aria-hidden />
					Editar
				</DropdownMenuItem>

				{title.status === "pending" ? (
					<DropdownMenuItem onSelect={() => onCancel(title)}>
						<RiStopLine className="size-4" aria-hidden />
						Cancelar
					</DropdownMenuItem>
				) : null}

				{title.status === "cancelled" ? (
					<DropdownMenuItem onSelect={() => onRestore(title)}>
						<RiRestartLine className="size-4" aria-hidden />
						Restaurar
					</DropdownMenuItem>
				) : null}

				{title.isRecurring ? <DropdownMenuSeparator /> : null}

				{title.isRecurring && !title.seriesEndDate ? (
					<DropdownMenuItem onSelect={() => onEndSeries(title)}>
						<RiStopLine className="size-4" aria-hidden />
						Encerrar recorrência
					</DropdownMenuItem>
				) : null}

				{title.isRecurring && title.seriesEndDate ? (
					<DropdownMenuItem onSelect={() => onExtendSeries(title)}>
						<RiRestartLine className="size-4" aria-hidden />
						Estender recorrência
					</DropdownMenuItem>
				) : null}

				{title.isRecurring && title.seriesEndDate ? (
					<DropdownMenuItem onSelect={() => onResumeSeries(title)}>
						<RiRestartLine className="size-4" aria-hidden />
						Reativar recorrência
					</DropdownMenuItem>
				) : null}

				{title.settlementTransactionId ? <DropdownMenuSeparator /> : null}

				{title.settlementTransactionId ? (
					<DropdownMenuItem onSelect={() => router.push("/transactions")}>
						<RiExternalLinkLine className="size-4" aria-hidden />
						Abrir lançamentos
					</DropdownMenuItem>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
