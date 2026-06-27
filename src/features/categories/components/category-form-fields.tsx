"use client";

import { RiMoreLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import {
	CATEGORY_TYPE_LABEL,
	CATEGORY_TYPES,
} from "@/shared/lib/categories/constants";
import { getCategoryIconOptions } from "@/shared/lib/categories/icons";
import {
	CATEGORY_PARTY_KIND_LABEL,
	CATEGORY_PARTY_KINDS,
	type CategoryPartyKind,
} from "@/shared/lib/categories/party-kind";
import { cn } from "@/shared/utils/ui";

import { CategoryIcon } from "./category-icon";
import { CategoryPickerDialog } from "./category-picker-dialog";
import { TypeSelectContent } from "./category-select-items";
import type { CategoryFormValues } from "./types";

interface CategoryFormFieldsProps {
	values: CategoryFormValues;
	onChange: <Key extends keyof CategoryFormValues>(
		field: Key,
		value: CategoryFormValues[Key],
	) => void;
}

const NO_PARTY_KIND_VALUE = "__none";
const iconOptions = getCategoryIconOptions();

export function CategoryFormFields({
	values,
	onChange,
}: CategoryFormFieldsProps) {
	const [pickerOpen, setPickerOpen] = useState(false);

	const selectedIconLabel = useMemo(() => {
		return iconOptions.find((o) => o.value === values.icon)?.label ?? null;
	}, [values.icon]);

	return (
		<div className="grid grid-cols-1 gap-4">
			<div className="flex flex-col gap-2">
				<Label htmlFor="category-name">Nome</Label>
				<Input
					id="category-name"
					value={values.name}
					onChange={(event) => onChange("name", event.target.value)}
					placeholder="Ex.: Alimentação"
					required
				/>
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="category-party-kind">Vínculo no lançamento</Label>
				<Select
					value={values.partyKind ?? NO_PARTY_KIND_VALUE}
					onValueChange={(value) =>
						onChange(
							"partyKind",
							value === NO_PARTY_KIND_VALUE
								? null
								: (value as CategoryPartyKind),
						)
					}
				>
					<SelectTrigger id="category-party-kind" className="w-full">
						<SelectValue placeholder="Selecione o vínculo" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={NO_PARTY_KIND_VALUE}>Nenhum</SelectItem>
						{CATEGORY_PARTY_KINDS.map((kind) => (
							<SelectItem key={kind} value={kind}>
								{CATEGORY_PARTY_KIND_LABEL[kind]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="category-type">Tipo da categoria</Label>
				<Select
					value={values.type}
					onValueChange={(value) =>
						onChange("type", value as CategoryFormValues["type"])
					}
				>
					<SelectTrigger id="category-type" className="w-full">
						<SelectValue placeholder="Selecione o tipo">
							{values.type && (
								<TypeSelectContent label={CATEGORY_TYPE_LABEL[values.type]} />
							)}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{CATEGORY_TYPES.map((type) => (
							<SelectItem key={type} value={type}>
								<TypeSelectContent label={CATEGORY_TYPE_LABEL[type]} />
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="flex flex-col gap-2">
				<Label>Ícone</Label>
				<button
					type="button"
					onClick={() => setPickerOpen(true)}
					className={cn(
						"flex w-full items-center gap-2 rounded-md border p-2 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
					)}
				>
					<span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/40 bg-muted/30 text-primary">
						{values.icon ? (
							<CategoryIcon name={values.icon} className="size-5" />
						) : (
							<RiMoreLine className="size-4 text-muted-foreground" />
						)}
					</span>
					<span className="flex min-w-0 flex-1 flex-col">
						<span className="truncate text-sm font-medium text-foreground">
							{selectedIconLabel ?? "Selecionar ícone"}
						</span>
						<span className="text-xs text-muted-foreground">
							Clique para trocar o ícone
						</span>
					</span>
				</button>

				<CategoryPickerDialog
					open={pickerOpen}
					value={values.icon}
					onOpenChange={setPickerOpen}
					onSelect={(icon) => onChange("icon", icon)}
				/>
			</div>
		</div>
	);
}
