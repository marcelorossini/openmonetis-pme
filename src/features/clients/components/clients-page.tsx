"use client";

import { RiAddFill, RiDeleteBin5Line, RiPencilLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { deleteClientAction } from "@/features/clients/actions";
import type { Client, ClientStatus } from "@/features/clients/types";
import { CLIENT_STATUS_OPTIONS } from "@/features/clients/types";
import { ConfirmActionDialog } from "@/shared/components/confirm-action-dialog";
import { ClientAvatarLabel } from "@/shared/components/entity-avatar";
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
import { ClientDialog } from "./client-dialog";

interface ClientsPageProps {
	clients: Client[];
}

export function ClientsPage({ clients }: ClientsPageProps) {
	const [activeStatus, setActiveStatus] = useState<ClientStatus>(
		CLIENT_STATUS_OPTIONS[0],
	);
	const [editOpen, setEditOpen] = useState(false);
	const [selectedClient, setSelectedClient] = useState<Client | null>(null);
	const [removeOpen, setRemoveOpen] = useState(false);
	const [clientToRemove, setClientToRemove] = useState<Client | null>(null);

	const clientsByStatus = useMemo(() => {
		const base = Object.fromEntries(
			CLIENT_STATUS_OPTIONS.map((status) => [status, [] as Client[]]),
		) as Record<ClientStatus, Client[]>;

		clients.forEach((client) => {
			base[client.status]?.push(client);
		});

		CLIENT_STATUS_OPTIONS.forEach((status) => {
			base[status].sort((a, b) =>
				a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
			);
		});

		return base;
	}, [clients]);

	const handleEdit = (client: Client) => {
		setSelectedClient(client);
		setEditOpen(true);
	};

	const handleEditOpenChange = (open: boolean) => {
		setEditOpen(open);
		if (!open) {
			setSelectedClient(null);
		}
	};

	const handleRemoveRequest = (client: Client) => {
		setClientToRemove(client);
		setRemoveOpen(true);
	};

	const handleRemoveOpenChange = (open: boolean) => {
		setRemoveOpen(open);
		if (!open) {
			setClientToRemove(null);
		}
	};

	const handleRemoveConfirm = async () => {
		if (!clientToRemove) {
			return;
		}

		const result = await deleteClientAction({ id: clientToRemove.id });

		if (result.success) {
			toast.success(result.message);
			return;
		}

		toast.error(result.error);
		throw new Error(result.error);
	};

	const removeTitle = clientToRemove
		? `Remover cliente "${clientToRemove.name}"?`
		: "Remover cliente?";

	return (
		<>
			<div className="flex w-full flex-col gap-6">
				<div className="flex">
					<ClientDialog
						mode="create"
						trigger={
							<Button className="w-full sm:w-auto">
								<RiAddFill className="size-4" />
								Novo cliente
							</Button>
						}
					/>
				</div>

				<Tabs
					value={activeStatus}
					onValueChange={(value) => setActiveStatus(value as ClientStatus)}
					className="w-full"
				>
					<TabsList>
						{CLIENT_STATUS_OPTIONS.map((status) => (
							<TabsTrigger key={status} value={status}>
								{status}s
							</TabsTrigger>
						))}
					</TabsList>

					{CLIENT_STATUS_OPTIONS.map((status) => (
						<TabsContent key={status} value={status} className="mt-4">
							{clientsByStatus[status].length === 0 ? (
								<div className="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed bg-muted/10 p-10 text-center text-sm text-muted-foreground">
									Ainda não há clientes {status.toLowerCase()}s.
								</div>
							) : (
								<Card className="py-2">
									<CardContent className="px-2 py-4 sm:px-4">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Nome</TableHead>
													<TableHead>Anotação</TableHead>
													<TableHead className="text-right">Ações</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{clientsByStatus[status].map((client) => (
													<TableRow key={client.id}>
														<TableCell className="font-medium">
															<ClientAvatarLabel
																name={client.name}
																size="md"
																labelClassName="font-medium"
															/>
														</TableCell>
														<TableCell className="max-w-[360px] text-muted-foreground">
															<span className="line-clamp-2">
																{client.note?.trim() || "—"}
															</span>
														</TableCell>
														<TableCell>
															<div className="flex items-center justify-end gap-3 text-sm">
																<button
																	type="button"
																	onClick={() => handleEdit(client)}
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
																	onClick={() => handleRemoveRequest(client)}
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

			<ClientDialog
				mode="update"
				client={selectedClient ?? undefined}
				open={editOpen && !!selectedClient}
				onOpenChange={handleEditOpenChange}
			/>

			<ConfirmActionDialog
				open={removeOpen && !!clientToRemove}
				onOpenChange={handleRemoveOpenChange}
				title={removeTitle}
				description="Ao remover este cliente, as receitas vinculadas ficarão sem cliente."
				confirmLabel="Remover"
				pendingLabel="Removendo..."
				confirmVariant="destructive"
				onConfirm={handleRemoveConfirm}
			/>
		</>
	);
}
