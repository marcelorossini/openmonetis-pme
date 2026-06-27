"use client";

import { RiLinkM } from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
	createPartyAction,
	updatePartyAction,
} from "@/features/parties/actions";
import {
	PARTY_KIND_OPTIONS,
	PARTY_STATUS_OPTIONS,
	type Party,
	type PartyFormValues,
} from "@/features/parties/types";
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
import {
	CATEGORY_PARTY_KIND_LABEL,
	type CategoryPartyKind,
} from "@/shared/lib/categories/party-kind";
import { buildIntegrationsSettingsHref } from "@/shared/lib/inbox-integrations/types";

interface PartyDialogProps {
	mode: "create" | "update";
	trigger?: React.ReactNode;
	party?: Party;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

const buildInitialValues = (party?: Party): PartyFormValues => ({
	kind: party?.kind ?? "cliente",
	name: party?.name ?? "",
	document: party?.document ?? "",
	email: party?.email ?? "",
	phone: party?.phone ?? "",
	status: party?.status ?? PARTY_STATUS_OPTIONS[0],
	note: party?.note ?? "",
});

export function PartyDialog({
	mode,
	trigger,
	party,
	open,
	onOpenChange,
}: PartyDialogProps) {
	const router = useRouter();
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const [dialogOpen, setDialogOpen] = useControlledState(
		open,
		false,
		onOpenChange,
	);

	const initialState = useMemo(() => buildInitialValues(party), [party]);
	const { formState, resetForm, updateField } =
		useFormState<PartyFormValues>(initialState);

	useEffect(() => {
		if (dialogOpen) {
			resetForm(initialState);
			setErrorMessage(null);
		}
	}, [dialogOpen, initialState, resetForm]);

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setErrorMessage(null);

		if (mode === "update" && !party?.id) {
			const message = "Cadastro inválido.";
			setErrorMessage(message);
			toast.error(message);
			return;
		}

		const payload = {
			kind: formState.kind,
			name: formState.name.trim(),
			document: formState.document.trim() || null,
			email: formState.email.trim() || null,
			phone: formState.phone.trim() || null,
			status: formState.status,
			note: formState.note.trim() || null,
		};

		startTransition(async () => {
			const result =
				mode === "create"
					? await createPartyAction(payload)
					: await updatePartyAction({ id: party?.id ?? "", ...payload });

			if (result.success) {
				const createdId = result.data?.id;
				toast.success(result.message, {
					action:
						mode === "create" && createdId
							? {
									label: "Integrações",
									onClick: () =>
										router.push(
											buildIntegrationsSettingsHref({
												entityType: "party",
												entityId: createdId,
												entityLabel: payload.name,
											}),
										),
								}
							: undefined,
				});
				setDialogOpen(false);
				resetForm(initialState);
				return;
			}

			setErrorMessage(result.error);
			toast.error(result.error);
		});
	};

	const title =
		mode === "create"
			? "Novo cliente/fornecedor"
			: "Atualizar cliente/fornecedor";
	const description =
		mode === "create"
			? "Cadastre clientes e fornecedores para vincular aos lançamentos conforme a categoria."
			: "Atualize os detalhes do cadastro selecionado.";
	const submitLabel = mode === "create" ? "Salvar" : "Atualizar";
	const integrationsHref = party
		? buildIntegrationsSettingsHref({
				entityType: "party",
				entityId: party.id,
				entityLabel: party.name,
			})
		: null;

	return (
		<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
			{trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>

				<form className="flex flex-col gap-5" onSubmit={handleSubmit}>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="party-kind">Tipo</Label>
							<Select
								value={formState.kind}
								onValueChange={(value) =>
									updateField("kind", value as CategoryPartyKind)
								}
							>
								<SelectTrigger id="party-kind" className="w-full">
									<SelectValue placeholder="Selecione" />
								</SelectTrigger>
								<SelectContent>
									{PARTY_KIND_OPTIONS.map((kind) => (
										<SelectItem key={kind} value={kind}>
											{CATEGORY_PARTY_KIND_LABEL[kind]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label htmlFor="party-status">Status</Label>
							<Select
								value={formState.status}
								onValueChange={(value) =>
									updateField("status", value as PartyFormValues["status"])
								}
							>
								<SelectTrigger id="party-status" className="w-full">
									<SelectValue placeholder="Selecione" />
								</SelectTrigger>
								<SelectContent>
									{PARTY_STATUS_OPTIONS.map((status) => (
										<SelectItem key={status} value={status}>
											{status}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="party-name">Nome</Label>
						<Input
							id="party-name"
							value={formState.name}
							onChange={(event) => updateField("name", event.target.value)}
							placeholder="Ex.: Ana Souza ou ACME Ltda."
							required
						/>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<div className="space-y-2">
							<Label htmlFor="party-document">Documento</Label>
							<Input
								id="party-document"
								value={formState.document}
								onChange={(event) =>
									updateField("document", event.target.value)
								}
								placeholder="CPF ou CNPJ"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="party-email">Email</Label>
							<Input
								id="party-email"
								type="email"
								value={formState.email}
								onChange={(event) => updateField("email", event.target.value)}
								placeholder="nome@email.com"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="party-phone">Telefone</Label>
							<Input
								id="party-phone"
								value={formState.phone}
								onChange={(event) => updateField("phone", event.target.value)}
								placeholder="(00) 00000-0000"
							/>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="party-note">Anotação</Label>
						<Textarea
							id="party-note"
							value={formState.note}
							onChange={(event) => updateField("note", event.target.value)}
							placeholder="Observações rápidas sobre este cadastro"
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
						{mode === "update" && integrationsHref ? (
							<Button
								type="button"
								variant="outline"
								onClick={() => router.push(integrationsHref)}
								disabled={isPending}
							>
								<RiLinkM className="size-4" />
								Integrações
							</Button>
						) : null}
						<Button type="submit" disabled={isPending}>
							{isPending ? "Salvando..." : submitLabel}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
