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
import {
	getPartyFieldLabel,
	normalizeCategoryPartyKind,
} from "@/shared/lib/categories/party-kind";
import type { PartySectionProps } from "./transaction-dialog-types";

const EMPTY_PARTY_VALUE = "__none";

export function PartySection({
	formState,
	onFieldChange,
	partyOptions,
	partyKind,
}: PartySectionProps) {
	const normalizedPartyKind = normalizeCategoryPartyKind(partyKind);

	if (!normalizedPartyKind) {
		return null;
	}

	const filteredOptions = partyOptions.filter(
		(option) => option.group === normalizedPartyKind,
	);
	const selectedParty = filteredOptions.find(
		(option) => option.value === formState.partyId,
	);
	const label = getPartyFieldLabel(normalizedPartyKind);

	return (
		<div className="space-y-1">
			<Label htmlFor="party">{label}</Label>
			<Select
				value={formState.partyId ?? EMPTY_PARTY_VALUE}
				onValueChange={(value) =>
					onFieldChange(
						"partyId",
						value === EMPTY_PARTY_VALUE ? undefined : value,
					)
				}
			>
				<SelectTrigger id="party" className="w-full">
					<SelectValue placeholder={`Sem ${label.toLowerCase()}`}>
						{selectedParty ? (
							<ClientAvatarLabel name={selectedParty.label} size="sm" />
						) : (
							`Sem ${label.toLowerCase()}`
						)}
					</SelectValue>
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={EMPTY_PARTY_VALUE}>
						Sem {label.toLowerCase()}
					</SelectItem>
					{filteredOptions.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							<ClientAvatarLabel name={option.label} size="sm" />
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
