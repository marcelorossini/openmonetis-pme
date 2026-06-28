"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
	createFinancialTitleAction,
	updateFinancialTitleAction,
} from "@/features/receivables-payables/actions";
import type {
	FinancialTitleEditScope,
	FinancialTitleFormValues,
	FinancialTitleListItem,
	FinancialTitleType,
} from "@/features/receivables-payables/types";
import {
	AccountCardSelectContent,
	CategorySelectContent,
	PayerSelectContent,
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
	DialogTrigger,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { Textarea } from "@/shared/components/ui/textarea";
import { useControlledState } from "@/shared/hooks/use-controlled-state";
import { useFormState } from "@/shared/hooks/use-form-state";
import { formatDate, getTodayDateString } from "@/shared/utils/date";

type TitleDialogProps = {
	mode: "create" | "update";
	trigger?: React.ReactNode;
	title?: FinancialTitleListItem;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	onSuccess?: () => void;
	defaultPayerId?: string | null;
	partyOptions: SelectOption[];
	categoryOptions: SelectOption[];
	accountOptions: SelectOption[];
	payerOptions: SelectOption[];
};

const TYPE_OPTIONS: Array<{ value: FinancialTitleType; label: string }> = [
	{ value: "receivable", label: "A receber" },
	{ value: "payable", label: "A pagar" },
];

const EDIT_SCOPE_OPTIONS: Array<{
	value: FinancialTitleEditScope;
	label: string;
	description: string;
}> = [
	{
		value: "single",
		label: "Só este título",
		description: "Aplica a alteração somente nesta ocorrência.",
	},
	{
		value: "this_and_next",
		label: "Este e próximos",
		description: "Atualiza esta ocorrência e os próximos títulos em aberto.",
	},
];

const resolvePaymentMethod = (value: string | null | undefined) =>
	PAYMENT_METHODS.find((method) => method === value) ?? "Pix";

const buildInitialValues = (
	title: FinancialTitleListItem | undefined,
	defaultPayerId: string | null | undefined,
): FinancialTitleFormValues => ({
	type: title?.type ?? "receivable",
	name: title?.name ?? "",
	description: title?.description ?? "",
	amount: title ? String(title.amount) : "",
	dueDate: title?.dueDate ?? getTodayDateString(),
	paymentMethod: resolvePaymentMethod(title?.paymentMethod),
	partyId: title?.partyId ?? "",
	categoryId: title?.categoryId ?? "",
	accountId: title?.accountId ?? "",
	payerId: title?.payerId ?? defaultPayerId ?? "",
	isRecurring: title?.isRecurring ?? false,
	generateRetroactive: false,
	recurrenceEndDate: title?.seriesEndDate ?? "",
	editScope: "single",
});

export function TitleDialog({
	mode,
	trigger,
	title,
	open,
	onOpenChange,
	onSuccess,
	defaultPayerId,
	partyOptions,
	categoryOptions,
	accountOptions,
	payerOptions,
}: TitleDialogProps) {
	const [dialogOpen, setDialogOpen] = useControlledState(
		open,
		false,
		onOpenChange,
	);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const initialState = useMemo(
		() => buildInitialValues(title, defaultPayerId),
		[defaultPayerId, title],
	);
	const { formState, resetForm, updateField } =
		useFormState<FinancialTitleFormValues>(initialState);

	useEffect(() => {
		if (dialogOpen) {
			resetForm(initialState);
			setErrorMessage(null);
		}
	}, [dialogOpen, initialState, resetForm]);

	const selectedCategory = categoryOptions.find(
		(option) => option.value === formState.categoryId,
	);
	const filteredPartyOptions = selectedCategory?.partyKind
		? partyOptions.filter(
				(option) => option.group === selectedCategory.partyKind,
			)
		: partyOptions;
	const isRecurringUpdate = mode === "update" && Boolean(title?.isRecurring);

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setErrorMessage(null);

		if (mode === "update" && !title?.id) {
			setErrorMessage("Título inválido.");
			return;
		}

		startTransition(async () => {
			const payload = {
				type: formState.type,
				name: formState.name.trim(),
				description: formState.description.trim() || null,
				amount: Number(formState.amount || 0),
				dueDate: formState.dueDate,
				paymentMethod: formState.paymentMethod,
				partyId: formState.partyId || null,
				categoryId: formState.categoryId || null,
				accountId: formState.accountId || null,
				payerId: formState.payerId || null,
			};

			const result =
				mode === "create"
					? await createFinancialTitleAction({
							...payload,
							recurrence: formState.isRecurring
								? {
										frequency: "monthly",
										generateRetroactive: formState.generateRetroactive,
										endDate: formState.recurrenceEndDate || null,
									}
								: null,
						})
					: await updateFinancialTitleAction({
							id: title?.id ?? "",
							...payload,
							editScope: formState.editScope,
						});

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
			{trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>
						{mode === "create" ? "Novo título financeiro" : "Atualizar título"}
					</DialogTitle>
					<DialogDescription>
						Registre compromissos financeiros antes da movimentação real do
						caixa.
					</DialogDescription>
				</DialogHeader>

				<form className="flex flex-col gap-5" onSubmit={handleSubmit}>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="financial-title-type">Tipo</Label>
							<Select
								value={formState.type}
								onValueChange={(value) =>
									updateField("type", value as FinancialTitleType)
								}
							>
								<SelectTrigger id="financial-title-type" className="w-full">
									<SelectValue placeholder="Selecione" />
								</SelectTrigger>
								<SelectContent>
									{TYPE_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label htmlFor="financial-title-due-date">Vencimento</Label>
							<DatePicker
								id="financial-title-due-date"
								value={formState.dueDate}
								onChange={(value) => updateField("dueDate", value)}
								required
							/>
						</div>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.6fr_1fr]">
						<div className="space-y-2">
							<Label htmlFor="financial-title-name">Nome</Label>
							<Input
								id="financial-title-name"
								value={formState.name}
								onChange={(event) => updateField("name", event.target.value)}
								placeholder="Ex: Mensalidade cliente XPTO"
								required
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="financial-title-amount">Valor</Label>
							<CurrencyInput
								id="financial-title-amount"
								value={formState.amount}
								onValueChange={(value) => updateField("amount", value)}
								placeholder="R$ 0,00"
								required
							/>
						</div>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="financial-title-payment-method">
								Forma de pagamento
							</Label>
							<Select
								value={formState.paymentMethod}
								onValueChange={(value) =>
									updateField("paymentMethod", resolvePaymentMethod(value))
								}
							>
								<SelectTrigger
									id="financial-title-payment-method"
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
							<Label htmlFor="financial-title-account">Conta prevista</Label>
							<Select
								value={formState.accountId}
								onValueChange={(value) => updateField("accountId", value)}
							>
								<SelectTrigger id="financial-title-account" className="w-full">
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
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="financial-title-category">Categoria</Label>
							<Select
								value={formState.categoryId}
								onValueChange={(value) => updateField("categoryId", value)}
							>
								<SelectTrigger id="financial-title-category" className="w-full">
									<SelectValue placeholder="Selecione" />
								</SelectTrigger>
								<SelectContent>
									{categoryOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											<CategorySelectContent
												label={option.label}
												icon={option.icon}
											/>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label htmlFor="financial-title-party">Cliente/fornecedor</Label>
							<Select
								value={formState.partyId || "__none"}
								onValueChange={(value) =>
									updateField("partyId", value === "__none" ? "" : value)
								}
							>
								<SelectTrigger id="financial-title-party" className="w-full">
									<SelectValue placeholder="Selecione" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__none">Sem vínculo</SelectItem>
									{filteredPartyOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					{mode === "create" ? (
						<div className="space-y-4 rounded-lg border p-4">
							<div className="flex items-center justify-between gap-4">
								<div className="space-y-1">
									<p className="text-sm font-medium">Recorrência mensal</p>
									<p className="text-xs text-muted-foreground">
										Mantém a série ativa com 12 meses futuros gerados
										automaticamente.
									</p>
								</div>
								<Switch
									checked={formState.isRecurring}
									onCheckedChange={(checked) =>
										updateField("isRecurring", Boolean(checked))
									}
									aria-label="Ativar recorrência mensal"
								/>
							</div>

							{formState.isRecurring ? (
								<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="financial-title-recurrence-end-date">
											Data final da série
										</Label>
										<DatePicker
											id="financial-title-recurrence-end-date"
											value={formState.recurrenceEndDate}
											onChange={(value) =>
												updateField("recurrenceEndDate", value)
											}
											placeholder="Sem data final"
										/>
									</div>

									<div className="flex items-center justify-between rounded-lg border px-3 py-3">
										<div className="space-y-1">
											<p className="text-sm font-medium">Gerar retroativo</p>
											<p className="text-xs text-muted-foreground">
												Materializa meses anteriores a partir do início do
												contrato.
											</p>
										</div>
										<Switch
											checked={formState.generateRetroactive}
											onCheckedChange={(checked) =>
												updateField("generateRetroactive", Boolean(checked))
											}
											aria-label="Gerar meses retroativos"
										/>
									</div>
								</div>
							) : null}
						</div>
					) : null}

					{isRecurringUpdate && title ? (
						<div className="space-y-4 rounded-lg border p-4">
							<div className="space-y-1">
								<p className="text-sm font-medium">Série recorrente mensal</p>
								<p className="text-xs text-muted-foreground">
									Início{" "}
									{title.seriesStartDate
										? formatDate(title.seriesStartDate)
										: formatDate(title.dueDate)}
									{title.seriesEndDate
										? ` · até ${formatDate(title.seriesEndDate)}`
										: " · sem data final"}
								</p>
							</div>

							<div className="space-y-3">
								<Label>Aplicar em</Label>
								<RadioGroup
									value={formState.editScope}
									onValueChange={(value) =>
										updateField("editScope", value as FinancialTitleEditScope)
									}
								>
									<div className="space-y-3">
										{EDIT_SCOPE_OPTIONS.map((option) => (
											<div
												key={option.value}
												className="flex items-start space-x-3"
											>
												<RadioGroupItem
													value={option.value}
													id={`edit-scope-${option.value}`}
													className="mt-0.5"
												/>
												<div className="flex-1">
													<Label
														htmlFor={`edit-scope-${option.value}`}
														className="cursor-pointer text-sm font-medium"
													>
														{option.label}
													</Label>
													<p className="text-xs text-muted-foreground">
														{option.description}
													</p>
												</div>
											</div>
										))}
									</div>
								</RadioGroup>
							</div>
						</div>
					) : null}

					<div className="space-y-2">
						<Label htmlFor="financial-title-payer">Pessoa responsável</Label>
						<Select
							value={formState.payerId}
							onValueChange={(value) => updateField("payerId", value)}
						>
							<SelectTrigger id="financial-title-payer" className="w-full">
								<SelectValue placeholder="Selecione" />
							</SelectTrigger>
							<SelectContent>
								{payerOptions.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										<PayerSelectContent
											label={option.label}
											avatarUrl={option.avatarUrl}
										/>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="financial-title-description">Observação</Label>
						<Textarea
							id="financial-title-description"
							value={formState.description}
							onChange={(event) =>
								updateField("description", event.target.value)
							}
							rows={4}
						/>
					</div>

					{errorMessage ? (
						<p className="text-sm text-destructive">{errorMessage}</p>
					) : null}

					<DialogFooter>
						<Button type="submit" disabled={isPending}>
							{isPending
								? mode === "create"
									? "Salvando..."
									: "Atualizando..."
								: mode === "create"
									? "Salvar"
									: "Atualizar"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
