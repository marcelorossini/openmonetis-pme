"use client";

import { RiCloseLine, RiFilterLine } from "@remixicon/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	type ReactNode,
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useState,
	useTransition,
} from "react";
import {
	buildFinancialTitleFilterSearchParams,
	type FinancialTitleSearchFilters,
} from "@/features/receivables-payables/lib/title-filters";
import type { SelectOption } from "@/features/transactions/components/types";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { cn } from "@/shared/utils/ui";

type TitleFiltersProps = {
	filters: FinancialTitleSearchFilters;
	partyOptions: SelectOption[];
	categoryOptions: SelectOption[];
	actionSlot?: ReactNode;
};

type ActiveTitleFilterChip = {
	key: string;
	label: string;
	onRemove: () => void;
};

type ToolbarSelectProps = {
	value: string;
	placeholder: string;
	options: Array<{ value: string; label: string }>;
	onValueChange: (value: string) => void;
};

function ToolbarSelect({
	value,
	placeholder,
	options,
	onValueChange,
}: ToolbarSelectProps) {
	const isActive = value !== "all";

	return (
		<Select value={value} onValueChange={onValueChange}>
			<SelectTrigger className="w-full border-dashed text-sm md:w-[148px]">
				<SelectValue
					placeholder={placeholder}
					className={cn(!isActive && "text-muted-foreground")}
				/>
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="all">{placeholder}</SelectItem>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

type ActiveFilterChipProps = {
	label: string;
	onRemove: () => void;
	disabled?: boolean;
};

function ActiveFilterChip({
	label,
	onRemove,
	disabled,
}: ActiveFilterChipProps) {
	return (
		<Badge
			variant="secondary"
			className="gap-1 border border-border/70 bg-secondary/70 py-1 pr-1 pl-2.5 font-normal text-secondary-foreground"
		>
			<span>{label}</span>
			<button
				type="button"
				onClick={onRemove}
				disabled={disabled}
				className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
				aria-label={`Remover filtro ${label}`}
			>
				<RiCloseLine className="size-3" aria-hidden />
			</button>
		</Badge>
	);
}

export function TitleFilters({
	filters,
	partyOptions,
	categoryOptions,
	actionSlot,
}: TitleFiltersProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [isPending, startTransition] = useTransition();
	const [searchValue, setSearchValue] = useState(filters.searchFilter);
	const deferredSearchValue = useDeferredValue(searchValue);

	const replaceWithParams = useCallback(
		(nextParams: URLSearchParams) => {
			startTransition(() => {
				const target = nextParams.toString()
					? `${pathname}?${nextParams.toString()}`
					: pathname;
				router.replace(target, { scroll: false });
			});
		},
		[pathname, router],
	);

	const applyFilterUpdate = useCallback(
		(
			updates: Partial<
				Record<"type" | "status" | "party" | "category" | "q", string | null>
			>,
		) => {
			replaceWithParams(
				buildFinancialTitleFilterSearchParams(searchParams.toString(), updates),
			);
		},
		[replaceWithParams, searchParams],
	);

	useEffect(() => {
		setSearchValue(filters.searchFilter);
	}, [filters.searchFilter]);

	useEffect(() => {
		if (deferredSearchValue === filters.searchFilter) {
			return;
		}
		const timeout = window.setTimeout(() => {
			applyFilterUpdate({ q: deferredSearchValue });
		}, 300);
		return () => window.clearTimeout(timeout);
	}, [applyFilterUpdate, deferredSearchValue, filters.searchFilter]);

	const partyLabel = useMemo(
		() =>
			partyOptions.find((option) => option.value === filters.partyFilter)
				?.label ?? null,
		[filters.partyFilter, partyOptions],
	);
	const categoryLabel = useMemo(
		() =>
			categoryOptions.find((option) => option.value === filters.categoryFilter)
				?.label ?? null,
		[categoryOptions, filters.categoryFilter],
	);

	const activeFilterChips = [
		filters.typeFilter !== "all"
			? {
					key: "type",
					label:
						filters.typeFilter === "payable"
							? "Tipo: A pagar"
							: "Tipo: A receber",
					onRemove: () => applyFilterUpdate({ type: null }),
				}
			: null,
		filters.statusFilter !== "all"
			? {
					key: "status",
					label: `Status: ${
						filters.statusFilter === "pending"
							? "Pendentes"
							: filters.statusFilter === "overdue"
								? "Atrasados"
								: filters.statusFilter === "settled"
									? "Baixados"
									: "Cancelados"
					}`,
					onRemove: () => applyFilterUpdate({ status: null }),
				}
			: null,
		partyLabel
			? {
					key: "party",
					label: `Vínculo: ${partyLabel}`,
					onRemove: () => applyFilterUpdate({ party: null }),
				}
			: null,
		categoryLabel
			? {
					key: "category",
					label: `Categoria: ${categoryLabel}`,
					onRemove: () => applyFilterUpdate({ category: null }),
				}
			: null,
		filters.searchFilter
			? {
					key: "q",
					label: `Busca: ${filters.searchFilter}`,
					onRemove: () => {
						setSearchValue("");
						applyFilterUpdate({ q: null });
					},
				}
			: null,
	].filter((chip): chip is ActiveTitleFilterChip => chip !== null);

	const hasActiveFilters = activeFilterChips.length > 0;

	return (
		<div aria-busy={isPending} className="flex flex-col gap-2">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				{actionSlot ? (
					<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
						{actionSlot}
					</div>
				) : (
					<span className="hidden sm:block" />
				)}

				<div className="flex w-full flex-col gap-2 md:flex-row md:flex-wrap md:items-center lg:flex-1 lg:justify-end">
					<div className="relative w-full md:w-[250px]">
						<Input
							value={searchValue}
							onChange={(event) => setSearchValue(event.target.value)}
							placeholder="Buscar por título, vínculo ou categoria"
							aria-label="Buscar títulos"
							className={cn(
								"w-full border-dashed text-sm",
								searchValue.length > 0 && "pr-8",
							)}
							disabled={isPending}
						/>
						{searchValue.length > 0 ? (
							<button
								type="button"
								onClick={() => {
									setSearchValue("");
									applyFilterUpdate({ q: null });
								}}
								aria-label="Limpar busca"
								className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<RiCloseLine className="size-4" aria-hidden />
							</button>
						) : null}
					</div>

					<div className="grid w-full gap-2 sm:grid-cols-2 xl:flex xl:w-auto xl:flex-wrap xl:justify-end">
						<ToolbarSelect
							value={filters.typeFilter}
							placeholder="Todos os tipos"
							options={[
								{ value: "receivable", label: "A receber" },
								{ value: "payable", label: "A pagar" },
							]}
							onValueChange={(value) => applyFilterUpdate({ type: value })}
						/>
						<ToolbarSelect
							value={filters.statusFilter}
							placeholder="Todos os status"
							options={[
								{ value: "pending", label: "Pendentes" },
								{ value: "overdue", label: "Atrasados" },
								{ value: "settled", label: "Baixados" },
								{ value: "cancelled", label: "Cancelados" },
							]}
							onValueChange={(value) => applyFilterUpdate({ status: value })}
						/>
						<ToolbarSelect
							value={filters.partyFilter}
							placeholder="Todos os vínculos"
							options={partyOptions.map((option) => ({
								value: option.value,
								label: option.label,
							}))}
							onValueChange={(value) => applyFilterUpdate({ party: value })}
						/>
						<ToolbarSelect
							value={filters.categoryFilter}
							placeholder="Todas as categorias"
							options={categoryOptions.map((option) => ({
								value: option.value,
								label: option.label,
							}))}
							onValueChange={(value) => applyFilterUpdate({ category: value })}
						/>
						<Button
							type="button"
							variant="outline"
							className="border-dashed text-sm"
							onClick={() => {
								setSearchValue("");
								applyFilterUpdate({
									type: null,
									status: null,
									party: null,
									category: null,
									q: null,
								});
							}}
							disabled={!hasActiveFilters || isPending}
						>
							<RiFilterLine className="size-4" aria-hidden />
							Limpar filtros
						</Button>
					</div>
				</div>
			</div>

			{hasActiveFilters ? (
				<div className="flex flex-wrap gap-1.5">
					{activeFilterChips.map((chip) => (
						<ActiveFilterChip
							key={chip.key}
							label={chip.label}
							onRemove={chip.onRemove}
							disabled={isPending}
						/>
					))}
				</div>
			) : null}
		</div>
	);
}
