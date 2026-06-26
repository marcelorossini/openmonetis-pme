"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
	createClientAction,
	updateClientAction,
} from "@/features/clients/actions";
import {
	CLIENT_STATUS_OPTIONS,
	type Client,
	type ClientFormValues,
} from "@/features/clients/types";
import { Button } from "@/shared/components/ui/button";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { useControlledState } from "@/shared/hooks/use-controlled-state";
import { useFormState } from "@/shared/hooks/use-form-state";

interface ClientDialogProps {
	mode: "create" | "update";
	trigger?: React.ReactNode;
	client?: Client;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

const buildInitialValues = (client?: Client): ClientFormValues => ({
	name: client?.name ?? "",
	status: client?.status ?? CLIENT_STATUS_OPTIONS[0],
	note: client?.note ?? "",
});

export function ClientDialog({
	mode,
	trigger,
	client,
	open,
	onOpenChange,
}: ClientDialogProps) {
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const [dialogOpen, setDialogOpen] = useControlledState(
		open,
		false,
		onOpenChange,
	);

	const initialState = useMemo(() => buildInitialValues(client), [client]);
	const { formState, resetForm, updateField } =
		useFormState<ClientFormValues>(initialState);

	useEffect(() => {
		if (dialogOpen) {
			resetForm(initialState);
			setErrorMessage(null);
		}
	}, [dialogOpen, initialState, resetForm]);

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setErrorMessage(null);

		if (mode === "update" && !client?.id) {
			const message = "Cliente inválido.";
			setErrorMessage(message);
			toast.error(message);
			return;
		}

		const payload = {
			name: formState.name.trim(),
			status: formState.status,
			note: formState.note.trim() || null,
		};

		startTransition(async () => {
			const result =
				mode === "create"
					? await createClientAction(payload)
					: await updateClientAction({ id: client?.id ?? "", ...payload });

			if (result.success) {
				toast.success(result.message);
				setDialogOpen(false);
				resetForm(initialState);
				return;
			}

			setErrorMessage(result.error);
			toast.error(result.error);
		});
	};

	const title = mode === "create" ? "Novo cliente" : "Atualizar cliente";
	const description =
		mode === "create"
			? "Cadastre um cliente para vincular receitas de serviços prestados."
			: "Atualize os detalhes do cliente selecionado.";
	const submitLabel = mode === "create" ? "Salvar" : "Atualizar";

	return (
		<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
			{trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>

				<form className="flex flex-col gap-5" onSubmit={handleSubmit}>
					<div className="space-y-2">
						<Label htmlFor="client-name">Nome</Label>
						<Input
							id="client-name"
							value={formState.name}
							onChange={(event) => updateField("name", event.target.value)}
							placeholder="Ex.: Ana Souza"
							required
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="client-status">Status</Label>
						<Select
							value={formState.status}
							onValueChange={(value) =>
								updateField("status", value as ClientFormValues["status"])
							}
						>
							<SelectTrigger id="client-status" className="w-full">
								<SelectValue placeholder="Selecione" />
							</SelectTrigger>
							<SelectContent>
								{CLIENT_STATUS_OPTIONS.map((status) => (
									<SelectItem key={status} value={status}>
										{status}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="client-note">Anotação</Label>
						<Textarea
							id="client-note"
							value={formState.note}
							onChange={(event) => updateField("note", event.target.value)}
							placeholder="Observações rápidas sobre as receitas deste cliente"
							rows={3}
						/>
					</div>

					{errorMessage ? (
						<p className="text-sm text-destructive">{errorMessage}</p>
					) : null}

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setDialogOpen(false)}
							disabled={isPending}
						>
							Cancelar
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? "Salvando..." : submitLabel}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
