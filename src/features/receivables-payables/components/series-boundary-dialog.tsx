"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
	endFinancialTitleSeriesAction,
	extendFinancialTitleSeriesAction,
} from "@/features/receivables-payables/actions";
import type {
	FinancialTitleListItem,
	FinancialTitleSeriesBoundaryFormValues,
} from "@/features/receivables-payables/types";
import { Button } from "@/shared/components/ui/button";
import { DatePicker } from "@/shared/components/ui/date-picker";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { useControlledState } from "@/shared/hooks/use-controlled-state";
import { useFormState } from "@/shared/hooks/use-form-state";

type SeriesBoundaryDialogProps = {
	mode: "end" | "extend";
	title?: FinancialTitleListItem | null;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	onSuccess?: () => void;
};

const buildInitialValues = (
	mode: "end" | "extend",
	title?: FinancialTitleListItem | null,
): FinancialTitleSeriesBoundaryFormValues => ({
	endDate:
		title?.seriesEndDate ??
		(mode === "end" ? (title?.dueDate ?? "") : (title?.dueDate ?? "")),
});

export function SeriesBoundaryDialog({
	mode,
	title,
	open,
	onOpenChange,
	onSuccess,
}: SeriesBoundaryDialogProps) {
	const [dialogOpen, setDialogOpen] = useControlledState(
		open,
		false,
		onOpenChange,
	);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const initialState = useMemo(
		() => buildInitialValues(mode, title),
		[mode, title],
	);
	const { formState, resetForm, updateField } =
		useFormState<FinancialTitleSeriesBoundaryFormValues>(initialState);

	useEffect(() => {
		if (dialogOpen) {
			resetForm(initialState);
			setErrorMessage(null);
		}
	}, [dialogOpen, initialState, resetForm]);

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setErrorMessage(null);

		if (!title?.id) {
			setErrorMessage("Título inválido.");
			return;
		}

		startTransition(async () => {
			const payload = {
				id: title.id,
				endDate: formState.endDate,
			};

			const result =
				mode === "end"
					? await endFinancialTitleSeriesAction(payload)
					: await extendFinancialTitleSeriesAction(payload);

			if (result.success) {
				toast.success(result.message);
				setDialogOpen(false);
				onSuccess?.();
				return;
			}

			setErrorMessage(result.error);
			toast.error(result.error);
		});
	};

	return (
		<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>
						{mode === "end" ? "Encerrar recorrência" : "Estender recorrência"}
					</DialogTitle>
					<DialogDescription>
						{mode === "end"
							? "Defina o último mês válido da série. Os títulos pendentes posteriores serão removidos."
							: "Atualize a data final da série para gerar os próximos meses faltantes."}
					</DialogDescription>
				</DialogHeader>

				<form className="flex flex-col gap-5" onSubmit={handleSubmit}>
					<div className="space-y-2">
						<Label htmlFor="financial-title-series-end-date">
							Data final da recorrência
						</Label>
						<DatePicker
							id="financial-title-series-end-date"
							value={formState.endDate}
							onChange={(value) => updateField("endDate", value)}
							required
						/>
					</div>

					{errorMessage ? (
						<p className="text-sm text-destructive">{errorMessage}</p>
					) : null}

					<DialogFooter>
						<Button type="submit" disabled={isPending}>
							{isPending
								? mode === "end"
									? "Encerrando..."
									: "Estendendo..."
								: mode === "end"
									? "Encerrar recorrência"
									: "Salvar nova data"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
