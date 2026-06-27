"use client";

import { RiAddFill, RiDeleteBin5Line, RiPencilLine } from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { deletePartyAction } from "@/features/parties/actions";
import {
	PARTY_STATUS_OPTIONS,
	type Party,
	type PartyStatus,
} from "@/features/parties/types";
import { ConfirmActionDialog } from "@/shared/components/confirm-action-dialog";
import { ClientAvatarLabel } from "@/shared/components/entity-avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/components/ui/table";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/shared/components/ui/tabs";
import { CATEGORY_PARTY_KIND_LABEL } from "@/shared/lib/categories/party-kind";
import { PartyDialog } from "./party-dialog";

interface PartiesPageProps {
	parties: Party[];
	selectedPartyId?: string | null;
}

export function PartiesPage({ parties, selectedPartyId }: PartiesPageProps) {
	const router = useRouter();
	const [activeStatus, setActiveStatus] = useState<PartyStatus>(
		PARTY_STATUS_OPTIONS[0],
	);
	const [editOpen, setEditOpen] = useState(false);
	const [selectedParty, setSelectedParty] = useState<Party | null>(null);
	const [removeOpen, setRemoveOpen] = useState(false);
	const [partyToRemove, setPartyToRemove] = useState<Party | null>(null);

	const partiesByStatus = useMemo(() => {
		const base = Object.fromEntries(
			PARTY_STATUS_OPTIONS.map((status) => [status, [] as Party[]]),
		) as Record<PartyStatus, Party[]>;

		parties.forEach((party) => {
			base[party.status]?.push(party);
		});

		PARTY_STATUS_OPTIONS.forEach((status) => {
			base[status].sort((a, b) =>
				a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
			);
		});

		return base;
	}, [parties]);

	useEffect(() => {
		if (!selectedPartyId) {
			return;
		}

		const party = parties.find((item) => item.id === selectedPartyId);
		if (!party) {
			return;
		}

		setSelectedParty(party);
		setActiveStatus(party.status);
		setEditOpen(true);
	}, [parties, selectedPartyId]);

	const handleEdit = (party: Party) => {
		setSelectedParty(party);
		setEditOpen(true);
	};

	const handleEditOpenChange = (open: boolean) => {
		setEditOpen(open);
		if (!open) {
			setSelectedParty(null);
			if (selectedPartyId) {
				router.replace("/parties", { scroll: false });
			}
		}
	};

	const handleRemoveRequest = (party: Party) => {
		setPartyToRemove(party);
		setRemoveOpen(true);
	};

	const handleRemoveOpenChange = (open: boolean) => {
		setRemoveOpen(open);
		if (!open) {
			setPartyToRemove(null);
		}
	};

	const handleRemoveConfirm = async () => {
		if (!partyToRemove) {
			return;
		}

		const result = await deletePartyAction({ id: partyToRemove.id });

		if (result.success) {
			toast.success(result.message);
			return;
		}

		toast.error(result.error);
		throw new Error(result.error);
	};

	const removeTitle = partyToRemove
		? `Remover "${partyToRemove.name}"?`
		: "Remover cadastro?";

	return (
		<>
			<div className="flex w-full flex-col gap-6">
				<div className="flex">
					<PartyDialog
						mode="create"
						trigger={
							<Button className="w-full sm:w-auto">
								<RiAddFill className="size-4" />
								Novo cliente/fornecedor
							</Button>
						}
					/>
				</div>

				<Tabs
					value={activeStatus}
					onValueChange={(value) => setActiveStatus(value as PartyStatus)}
					className="w-full"
				>
					<TabsList>
						{PARTY_STATUS_OPTIONS.map((status) => (
							<TabsTrigger key={status} value={status}>
								{status}s
							</TabsTrigger>
						))}
					</TabsList>

					{PARTY_STATUS_OPTIONS.map((status) => (
						<TabsContent key={status} value={status} className="mt-4">
							{partiesByStatus[status].length === 0 ? (
								<div className="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed bg-muted/10 p-10 text-center text-sm text-muted-foreground">
									Ainda não há clientes ou fornecedores {status.toLowerCase()}s.
								</div>
							) : (
								<Card className="py-2">
									<CardContent className="px-2 py-4 sm:px-4">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Nome</TableHead>
													<TableHead>Tipo</TableHead>
													<TableHead>Contato</TableHead>
													<TableHead>Anotação</TableHead>
													<TableHead className="text-right">Ações</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{partiesByStatus[status].map((party) => (
													<TableRow key={party.id}>
														<TableCell className="font-medium">
															<ClientAvatarLabel
																name={party.name}
																size="md"
																labelClassName="font-medium"
															/>
															{party.document ? (
																<div className="mt-1 text-xs text-muted-foreground">
																	{party.document}
																</div>
															) : null}
														</TableCell>
														<TableCell>
															<Badge variant="secondary">
																{CATEGORY_PARTY_KIND_LABEL[party.kind]}
															</Badge>
														</TableCell>
														<TableCell className="max-w-[260px] text-muted-foreground">
															<span className="line-clamp-2">
																{[party.email, party.phone]
																	.filter(Boolean)
																	.join(" · ") || "—"}
															</span>
														</TableCell>
														<TableCell className="max-w-[320px] text-muted-foreground">
															<span className="line-clamp-2">
																{party.note?.trim() || "—"}
															</span>
														</TableCell>
														<TableCell>
															<div className="flex items-center justify-end gap-3 text-sm">
																<button
																	type="button"
																	onClick={() => handleEdit(party)}
																	className="flex items-center gap-1 font-medium text-primary transition-opacity hover:opacity-80"
																>
																	<RiPencilLine
																		className="size-4"
																		aria-hidden
																	/>
																	editar
																</button>
																<button
																	type="button"
																	onClick={() => handleRemoveRequest(party)}
																	className="flex items-center gap-1 font-medium text-destructive transition-opacity hover:opacity-80"
																>
																	<RiDeleteBin5Line
																		className="size-4"
																		aria-hidden
																	/>
																	remover
																</button>
															</div>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</CardContent>
								</Card>
							)}
						</TabsContent>
					))}
				</Tabs>
			</div>

			<PartyDialog
				mode="update"
				party={selectedParty ?? undefined}
				open={editOpen && !!selectedParty}
				onOpenChange={handleEditOpenChange}
			/>

			<ConfirmActionDialog
				open={removeOpen && !!partyToRemove}
				onOpenChange={handleRemoveOpenChange}
				title={removeTitle}
				description="Ao remover este cadastro, os lançamentos vinculados ficarão sem cliente/fornecedor."
				confirmLabel="Remover"
				pendingLabel="Removendo..."
				confirmVariant="destructive"
				onConfirm={handleRemoveConfirm}
			/>
		</>
	);
}
