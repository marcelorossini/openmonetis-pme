"use client";

import {
	RiAddLine,
	RiArrowRightLine,
	RiBankLine,
	RiDeleteBinLine,
	RiLinkM,
	RiPriceTag3Line,
	RiUserStarLine,
} from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
	deleteIntegrationMappingAction,
	saveIntegrationMappingAction,
} from "@/features/settings/actions";
import type {
	IntegrationPendingMappingItem,
	IntegrationSavedMappingItem,
	IntegrationTargetOption,
} from "@/features/settings/queries";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
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
import type {
	IntegrationEntityType,
	IntegrationFocusContext,
} from "@/shared/lib/inbox-integrations/types";
import { formatDateTime } from "@/shared/utils/date";

type MappingFormState = {
	entityType: IntegrationEntityType;
	sourceApp: string;
	profileKey: string;
	externalKey: string;
	targetId: string;
};

const EMPTY_FILTER = "__all";
const EMPTY_PROFILE_FILTER = "__all_profiles";
const NO_PROFILE_FILTER = "__no_profile";

function getEntityLabel(entityType: IntegrationEntityType) {
	if (entityType === "account") return "Conta";
	return entityType === "party" ? "Cliente/Fornecedor" : "Categoria";
}

function getEntityIcon(entityType: IntegrationEntityType) {
	if (entityType === "account") return RiBankLine;
	return entityType === "party" ? RiUserStarLine : RiPriceTag3Line;
}

function buildInitialFormState(): MappingFormState {
	return {
		entityType: "party",
		sourceApp: "",
		profileKey: "",
		externalKey: "",
		targetId: "",
	};
}

interface IntegrationsTabProps {
	pendingMappings: IntegrationPendingMappingItem[];
	savedMappings: IntegrationSavedMappingItem[];
	accountOptions: IntegrationTargetOption[];
	partyOptions: IntegrationTargetOption[];
	categoryOptions: IntegrationTargetOption[];
	focusEntity?: IntegrationFocusContext | null;
}

export function IntegrationsTab({
	pendingMappings,
	savedMappings,
	accountOptions,
	partyOptions,
	categoryOptions,
	focusEntity,
}: IntegrationsTabProps) {
	const router = useRouter();
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [isPending, startTransition] = useTransition();
	const [formState, setFormState] = useState<MappingFormState>(
		buildInitialFormState(),
	);
	const [entityFilter, setEntityFilter] = useState<string>(
		focusEntity?.entityType ?? EMPTY_FILTER,
	);
	const [sourceFilter, setSourceFilter] = useState<string>(EMPTY_FILTER);
	const [profileFilter, setProfileFilter] =
		useState<string>(EMPTY_PROFILE_FILTER);
	const [searchFilter, setSearchFilter] = useState("");
	const [deleteTarget, setDeleteTarget] =
		useState<IntegrationSavedMappingItem | null>(null);

	const sourceOptions = useMemo(() => {
		return [...new Set(savedMappings.map((item) => item.sourceApp))].sort();
	}, [savedMappings]);

	const profileOptions = useMemo(() => {
		return [
			...new Set(savedMappings.map((item) => item.profileKey ?? "")),
		].sort();
	}, [savedMappings]);

	const filteredSavedMappings = useMemo(() => {
		return savedMappings.filter((item) => {
			if (
				focusEntity &&
				(item.entityType !== focusEntity.entityType ||
					item.targetId !== focusEntity.entityId)
			) {
				return false;
			}

			if (entityFilter !== EMPTY_FILTER && item.entityType !== entityFilter) {
				return false;
			}

			if (sourceFilter !== EMPTY_FILTER && item.sourceApp !== sourceFilter) {
				return false;
			}

			if (
				profileFilter !== EMPTY_PROFILE_FILTER &&
				(profileFilter === NO_PROFILE_FILTER
					? (item.profileKey ?? "") !== ""
					: (item.profileKey ?? "") !== profileFilter)
			) {
				return false;
			}

			if (!searchFilter.trim()) return true;

			const needle = searchFilter.trim().toLowerCase();
			return (
				item.externalKey.toLowerCase().includes(needle) ||
				item.targetLabel.toLowerCase().includes(needle) ||
				item.sourceApp.toLowerCase().includes(needle)
			);
		});
	}, [
		savedMappings,
		focusEntity,
		entityFilter,
		sourceFilter,
		profileFilter,
		searchFilter,
	]);

	const filteredPendingMappings = useMemo(() => {
		return pendingMappings.filter((item) => {
			if (focusEntity && item.entityType !== focusEntity.entityType) {
				return false;
			}
			return true;
		});
	}, [pendingMappings, focusEntity]);

	const focusEntityLabel = useMemo(() => {
		if (!focusEntity) return null;
		const optionList =
			focusEntity.entityType === "account"
				? accountOptions
				: focusEntity.entityType === "party"
					? partyOptions
					: categoryOptions;
		return (
			focusEntity.entityLabel ??
			optionList.find((item) => item.value === focusEntity.entityId)?.label ??
			null
		);
	}, [focusEntity, accountOptions, partyOptions, categoryOptions]);

	const targetOptions =
		formState.entityType === "account"
			? accountOptions
			: formState.entityType === "party"
				? partyOptions
				: categoryOptions;

	const openCreateDialog = () => {
		setFormState(
			focusEntity
				? {
						...buildInitialFormState(),
						entityType: focusEntity.entityType,
						targetId: focusEntity.entityId,
					}
				: buildInitialFormState(),
		);
		setIsDialogOpen(true);
	};

	const openEditDialog = (item: IntegrationSavedMappingItem) => {
		setFormState({
			entityType: item.entityType,
			sourceApp: item.sourceApp,
			profileKey: item.profileKey ?? "",
			externalKey: item.externalKey,
			targetId: item.targetId,
		});
		setIsDialogOpen(true);
	};

	const openPendingDialog = (item: IntegrationPendingMappingItem) => {
		setFormState({
			entityType: focusEntity?.entityType ?? item.entityType,
			sourceApp: item.sourceApp,
			profileKey: item.profileKey ?? "",
			externalKey: item.externalKey,
			targetId:
				focusEntity?.entityType === item.entityType ? focusEntity.entityId : "",
		});
		setIsDialogOpen(true);
	};

	const handleSave = () => {
		startTransition(async () => {
			const result = await saveIntegrationMappingAction(formState);

			if (!result.success) {
				toast.error(result.error || "Não foi possível salvar o mapeamento.");
				return;
			}

			toast.success(result.message || "Mapeamento salvo.");
			setIsDialogOpen(false);
			router.refresh();
		});
	};

	const handleDelete = () => {
		if (!deleteTarget) return;

		startTransition(async () => {
			const result = await deleteIntegrationMappingAction({
				entityType: deleteTarget.entityType,
				sourceApp: deleteTarget.sourceApp,
				profileKey: deleteTarget.profileKey ?? undefined,
				externalKey: deleteTarget.externalKey,
			});

			if (!result.success) {
				toast.error(result.error || "Não foi possível remover o mapeamento.");
				return;
			}

			toast.success(result.message || "Mapeamento removido.");
			setDeleteTarget(null);
			router.refresh();
		});
	};

	return (
		<div className="space-y-8">
			{focusEntity ? (
				<section className="rounded-md border bg-muted/20 px-4 py-4">
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="outline">
							{getEntityLabel(focusEntity.entityType)}
						</Badge>
						{focusEntityLabel ? (
							<span className="font-medium">{focusEntityLabel}</span>
						) : null}
					</div>
					<p className="mt-2 text-sm text-muted-foreground">
						Gerencie os vínculos desta entidade sem sair do contexto do
						cadastro.
					</p>
				</section>
			) : null}

			<section className="space-y-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<h3 className="text-base font-semibold">Pendentes de mapeamento</h3>
						<p className="text-sm text-muted-foreground">
							Valores recebidos da integração que ainda não foram vinculados a
							uma entidade local.
						</p>
					</div>
					<Button type="button" variant="outline" onClick={openCreateDialog}>
						<RiAddLine className="mr-1 h-4 w-4" />
						Novo mapeamento
					</Button>
				</div>

				<div className="space-y-3">
					{filteredPendingMappings.length === 0 ? (
						<div className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
							Nenhum valor pendente de mapeamento.
						</div>
					) : (
						filteredPendingMappings.map((item) => {
							const EntityIcon = getEntityIcon(item.entityType);

							return (
								<div
									key={[
										item.entityType,
										item.sourceApp,
										item.profileKey ?? "",
										item.externalKey,
									].join("::")}
									className="flex flex-col gap-4 rounded-md border px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
								>
									<div className="min-w-0 space-y-2">
										<div className="flex flex-wrap items-center gap-2">
											<Badge variant="outline">
												<EntityIcon className="mr-1 h-3.5 w-3.5" />
												{getEntityLabel(item.entityType)}
											</Badge>
											<Badge variant="secondary">{item.sourceApp}</Badge>
											<Badge variant="secondary">
												{item.profileKey || "Sem perfil"}
											</Badge>
											<Badge variant="outline">
												{item.pendingCount} pendente(s)
											</Badge>
										</div>
										<div className="space-y-1">
											<p className="break-all font-medium">
												{item.externalKey}
											</p>
											<p className="text-sm text-muted-foreground">
												{item.sourceAppName || item.sourceApp} • último
												recebimento em {formatDateTime(item.lastReceivedAt)}
											</p>
										</div>
									</div>
									<Button type="button" onClick={() => openPendingDialog(item)}>
										Mapear
										<RiArrowRightLine className="ml-1 h-4 w-4" />
									</Button>
								</div>
							);
						})
					)}
				</div>
			</section>

			<section className="space-y-4">
				<div>
					<h3 className="text-base font-semibold">Mapeamentos salvos</h3>
					<p className="text-sm text-muted-foreground">
						Regras ativas para resolver automaticamente valores externos da
						inbox.
					</p>
				</div>

				<div className="grid gap-3 md:grid-cols-[180px_180px_180px_minmax(0,1fr)]">
					<div className="space-y-2">
						<Label>Entidade</Label>
						<Select
							value={entityFilter}
							onValueChange={setEntityFilter}
							disabled={Boolean(focusEntity)}
						>
							<SelectTrigger>
								<SelectValue placeholder="Todas" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={EMPTY_FILTER}>Todas</SelectItem>
								<SelectItem value="account">Conta</SelectItem>
								<SelectItem value="party">Cliente/Fornecedor</SelectItem>
								<SelectItem value="category">Categoria</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label>Origem</Label>
						<Select value={sourceFilter} onValueChange={setSourceFilter}>
							<SelectTrigger>
								<SelectValue placeholder="Todas" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={EMPTY_FILTER}>Todas</SelectItem>
								{sourceOptions.map((item) => (
									<SelectItem key={item} value={item}>
										{item}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label>Perfil</Label>
						<Select value={profileFilter} onValueChange={setProfileFilter}>
							<SelectTrigger>
								<SelectValue placeholder="Todos" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={EMPTY_PROFILE_FILTER}>Todos</SelectItem>
								{profileOptions.map((item) => (
									<SelectItem
										key={item || "__empty"}
										value={item || NO_PROFILE_FILTER}
									>
										{item || "Sem perfil"}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label>Buscar</Label>
						<Input
							value={searchFilter}
							onChange={(event) => setSearchFilter(event.target.value)}
							placeholder="Valor recebido ou destino"
						/>
					</div>
				</div>

				<div className="space-y-3">
					{filteredSavedMappings.length === 0 ? (
						<div className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
							Nenhum mapeamento encontrado para os filtros atuais.
						</div>
					) : (
						filteredSavedMappings.map((item) => {
							const EntityIcon = getEntityIcon(item.entityType);

							return (
								<div
									key={[
										item.entityType,
										item.sourceApp,
										item.profileKey ?? "",
										item.externalKey,
									].join("::")}
									className="flex flex-col gap-4 rounded-md border px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
								>
									<div className="min-w-0 flex-1 space-y-2">
										<div className="flex flex-wrap items-center gap-2">
											<Badge variant="outline">
												<EntityIcon className="mr-1 h-3.5 w-3.5" />
												{getEntityLabel(item.entityType)}
											</Badge>
											<Badge variant="secondary">{item.sourceApp}</Badge>
											<Badge variant="secondary">
												{item.profileKey || "Sem perfil"}
											</Badge>
										</div>

										<div className="grid gap-3 text-sm md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
											<div className="min-w-0">
												<p className="text-xs uppercase text-muted-foreground">
													Valor recebido
												</p>
												<p className="break-all font-medium">
													{item.externalKey}
												</p>
											</div>
											<div className="hidden justify-center md:flex">
												<RiLinkM className="h-4 w-4 text-muted-foreground" />
											</div>
											<div className="min-w-0">
												<p className="text-xs uppercase text-muted-foreground">
													Destino
												</p>
												<p className="font-medium">{item.targetLabel}</p>
												{item.targetMeta ? (
													<p className="text-muted-foreground">
														{item.targetMeta}
													</p>
												) : null}
											</div>
										</div>

										<p className="text-xs text-muted-foreground">
											Atualizado em {formatDateTime(item.updatedAt)}
										</p>
									</div>

									<div className="flex items-center gap-2">
										<Button
											type="button"
											variant="outline"
											onClick={() => openEditDialog(item)}
										>
											Editar
										</Button>
										<Button
											type="button"
											variant="outline"
											size="icon"
											onClick={() => setDeleteTarget(item)}
											aria-label="Remover mapeamento"
										>
											<RiDeleteBinLine className="h-4 w-4" />
										</Button>
									</div>
								</div>
							);
						})
					)}
				</div>
			</section>

			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent className="sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle>Mapeamento de integração</DialogTitle>
						<DialogDescription>
							Associe o valor recebido pela integração a uma entidade local do
							OpenMonetis.
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 py-2 md:grid-cols-2">
						<div className="space-y-2">
							<Label>Entidade</Label>
							<Select
								value={formState.entityType}
								onValueChange={(value) =>
									setFormState((current) => ({
										...current,
										entityType: value as IntegrationEntityType,
										targetId: "",
									}))
								}
								disabled={Boolean(focusEntity)}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="account">Conta</SelectItem>
									<SelectItem value="party">Cliente/Fornecedor</SelectItem>
									<SelectItem value="category">Categoria</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label>Origem</Label>
							<Input
								value={formState.sourceApp}
								onChange={(event) =>
									setFormState((current) => ({
										...current,
										sourceApp: event.target.value,
									}))
								}
								placeholder="bank-api"
							/>
						</div>

						<div className="space-y-2">
							<Label>Perfil da integração (opcional)</Label>
							<Input
								value={formState.profileKey}
								onChange={(event) =>
									setFormState((current) => ({
										...current,
										profileKey: event.target.value,
									}))
								}
								placeholder="inter-webhook"
							/>
						</div>

						<div className="space-y-2">
							<Label>Valor recebido</Label>
							<Input
								value={formState.externalKey}
								onChange={(event) =>
									setFormState((current) => ({
										...current,
										externalKey: event.target.value,
									}))
								}
								placeholder="pix:cnpj:12345678000199"
							/>
						</div>

						<div className="space-y-2 md:col-span-2">
							<Label>{getEntityLabel(formState.entityType)}</Label>
							<Select
								value={formState.targetId}
								onValueChange={(value) =>
									setFormState((current) => ({
										...current,
										targetId: value,
									}))
								}
								disabled={Boolean(focusEntity)}
							>
								<SelectTrigger>
									<SelectValue placeholder="Selecione o destino" />
								</SelectTrigger>
								<SelectContent>
									{targetOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
											{option.meta ? ` • ${option.meta}` : ""}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setIsDialogOpen(false)}
						>
							Cancelar
						</Button>
						<Button
							type="button"
							onClick={handleSave}
							disabled={
								isPending ||
								!formState.sourceApp.trim() ||
								!formState.externalKey.trim() ||
								!formState.targetId
							}
						>
							Salvar mapeamento
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open) setDeleteTarget(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remover mapeamento?</AlertDialogTitle>
						<AlertDialogDescription>
							As próximas notificações voltarão a depender de mapeamento manual
							para esse valor externo.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
						<AlertDialogAction onClick={handleDelete} disabled={isPending}>
							Remover
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
