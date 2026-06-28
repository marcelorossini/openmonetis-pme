"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { settleFinancialTitleAction } from "@/features/receivables-payables/actions";
import type {
	FinancialTitleListItem,
	FinancialTitleSettlementFormValues,
} from "@/features/receivables-payables/types";
import {
	AccountCardSelectContent,
	PaymentMethodSelectContent,
} from "@/features/transactions/components/select-items";
import type { SelectOption } from "@/features/transactions/components/types";
import { PAYMENT_METHODS } from "@/features/transactions/lib/constants";
import { Button } from "@/shared/components/ui/button";
import { CurrencyInput } from "@/shared/components/ui/currency-input";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { useControlledState } from "@/shared/hooks/use-controlled-state";
import { useFormState } from "@/shared/hooks/use-form-state";
import { getTodayDateString } from "@/shared/utils/date";

type SettlementDialogProps = {
	title: FinancialTitleListItem | null;
	accountOptions: SelectOption[];
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	onSuccess?: () => void;
};

const buildInitialValues = (
	title: FinancialTitleListItem | null,
): FinancialTitleSettlementFormValues => ({
	accountId: title?.accountId ?? "",
	paymentMethod:
		PAYMENT_METHODS.find((method) => method === title?.paymentMethod) ?? "Pix",
	settledAt: getTodayDateString(),
	settledAmount: title ? String(title.amount) : "",
});

export function SettlementDialog({
	title,
	accountOptions,
	open,
	onOpenChange,
	onSuccess,
}: SettlementDialogProps) {
	const [dialogOpen, setDialogOpen] = useControlledState(
		open,
		false,
		onOpenChange,
	);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [createdTransactionId, setCreatedTransactionId] = useState<
		string | null
	>(null);
	const [isPending, startTransition] = useTransition();
	const initialState = useMemo(() => buildInitialValues(title), [title]);
	const { formState, resetForm, updateField } =
		useFormState<FinancialTitleSettlementFormValues>(initialState);

	useEffect(() => {
		if (dialogOpen) {
			resetForm(initialState);
			setErrorMessage(null);
			setCreatedTransactionId(null);
		}
	}, [dialogOpen, initialState, resetForm]);

	const verb = title?.type === "payable" ? "Pagar" : "Receber";

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!title) {
			return;
		}

		setErrorMessage(null);
		startTransition(async () => {
			const result = await settleFinancialTitleAction({
				id: title.id,
				accountId: formState.accountId,
				paymentMethod: formState.paymentMethod,
				settledAt: formState.settledAt,
				settledAmount: Number(formState.settledAmount || 0),
			});

			if (result.success) {
				toast.success(result.message);
				setCreatedTransactionId(result.data?.transactionId ?? null);
				onSuccess?.();
				return;
			}

			setErrorMessage(result.error);
			toast.error(result.error);
		});
	};

	return (
		<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{verb} título</DialogTitle>
					<DialogDescription>
						Confirme os dados da baixa e crie o lançamento realizado.
					</DialogDescription>
				</DialogHeader>

				<form className="flex flex-col gap-5" onSubmit={handleSubmit}>
					<div className="rounded-lg border bg-muted/20 p-3 text-sm">
						<p className="font-medium">{title?.name}</p>
						<p className="text-muted-foreground">
							Vencimento: {title?.dueDate ?? "Sem data"}
						</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="settlement-account">Conta</Label>
						<Select
							value={formState.accountId}
							onValueChange={(value) => updateField("accountId", value)}
						>
							<SelectTrigger id="settlement-account" className="w-full">
								<SelectValue placeholder="Selecione" />
							</SelectTrigger>
							<SelectContent>
								{accountOptions.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										<AccountCardSelectContent
											label={option.label}
											logo={option.logo}
										/>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="settlement-payment-method">
								Forma de pagamento
							</Label>
							<Select
								value={formState.paymentMethod}
								onValueChange={(value) =>
									updateField(
										"paymentMethod",
										PAYMENT_METHODS.find((method) => method === value) ?? "Pix",
									)
								}
							>
								<SelectTrigger
									id="settlement-payment-method"
									className="w-full"
								>
									<SelectValue placeholder="Selecione" />
								</SelectTrigger>
								<SelectContent>
									{PAYMENT_METHODS.filter(
										(method) => method !== "Cartão de crédito",
									).map((method) => (
										<SelectItem key={method} value={method}>
											<PaymentMethodSelectContent label={method} />
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label htmlFor="settlement-date">Data da baixa</Label>
							<DatePicker
								id="settlement-date"
								value={formState.settledAt}
								onChange={(value) => updateField("settledAt", value)}
								required
							/>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="settlement-amount">Valor real</Label>
						<CurrencyInput
							id="settlement-amount"
							value={formState.settledAmount}
							onValueChange={(value) => updateField("settledAmount", value)}
							required
						/>
					</div>

					{errorMessage ? (
						<p className="text-sm text-destructive">{errorMessage}</p>
					) : null}

					{createdTransactionId ? (
						<p className="text-sm text-muted-foreground">
							Lançamento criado.{" "}
							<Link
								href={`/transactions`}
								className="font-medium text-primary underline-offset-4 hover:underline"
							>
								Ver em lançamentos
							</Link>
						</p>
					) : null}

					<DialogFooter>
						<Button type="submit" disabled={isPending}>
							{isPending ? `${verb}...` : verb}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
