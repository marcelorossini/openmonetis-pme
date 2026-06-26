"use client";

import { ClientAvatarLabel } from "@/shared/components/entity-avatar";
import { Label } from "@/shared/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import type { ClientSectionProps } from "./transaction-dialog-types";

const EMPTY_CLIENT_VALUE = "__none";

export function ClientSection({
	formState,
	onFieldChange,
	clientOptions,
}: ClientSectionProps) {
	if (formState.transactionType !== "Receita") {
		return null;
	}

	const selectedClient = clientOptions.find(
		(option) => option.value === formState.clientId,
	);

	return (
		<div className="space-y-1">
			<Label htmlFor="client">Cliente</Label>
			<Select
				value={formState.clientId ?? EMPTY_CLIENT_VALUE}
				onValueChange={(value) =>
					onFieldChange(
						"clientId",
						value === EMPTY_CLIENT_VALUE ? undefined : value,
					)
				}
			>
				<SelectTrigger id="client" className="w-full">
					<SelectValue placeholder="Sem cliente">
						{selectedClient ? (
							<ClientAvatarLabel name={selectedClient.label} size="sm" />
						) : (
							"Sem cliente"
						)}
					</SelectValue>
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={EMPTY_CLIENT_VALUE}>Sem cliente</SelectItem>
					{clientOptions.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							<ClientAvatarLabel name={option.label} size="sm" />
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
