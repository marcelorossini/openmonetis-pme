"use client";

import {
	RiCheckLine,
	RiCloseLine,
	RiExpandUpDownLine,
	RiFilterLine,
} from "@remixicon/react";
import {
	type ReadonlyURLSearchParams,
	usePathname,
	useRouter,
	useSearchParams,
} from "next/navigation";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
	useTransition,
} from "react";
import {
	AMOUNT_MAX_PARAM,
	AMOUNT_MIN_PARAM,
	DATE_END_PARAM,
	DATE_START_PARAM,
	PAYMENT_METHODS,
	SETTLED_FILTER_VALUES,
	TRANSACTION_CONDITIONS,
	TRANSACTION_TYPES,
} from "@/features/transactions/lib/constants";
import {
	parseDateFilterParam,
	parsePositiveAmount,
} from "@/features/transactions/lib/page-helpers";
import { ClientAvatarLabel } from "@/shared/components/entity-avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/shared/components/ui/command";
import { DatePicker } from "@/shared/components/ui/date-picker";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/shared/components/ui/drawer";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/shared/components/ui/hover-card";
import { Input } from "@/shared/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
} from "@/shared/components/ui/select";
import { Separator } from "@/shared/components/ui/separator";
import { Spinner } from "@/shared/components/ui/spinner";
import { Switch } from "@/shared/components/ui/switch";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@/shared/components/ui/toggle-group";
import { formatCurrency } from "@/shared/utils/currency";
import { formatDateOnly } from "@/shared/utils/date";
import { slugify } from "@/shared/utils/string";
import { cn } from "@/shared/utils/ui";
import {
	AccountCardSelectContent,
	CategorySelectContent,
	ConditionSelectContent,
	PayerSelectContent,
	PaymentMethodSelectContent,
	TransactionTypeSelectContent,
} from "../select-items";
import type {
	AccountCardFilterOption,
	TransactionFilterOption,
} from "../types";

const FILTER_EMPTY_VALUE = "__all";

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

const normalizeAmountParam = (raw: string): string | null => {
	const parsed = parsePositiveAmount(raw.trim());
	return parsed === null ? null : parsed.toString();
};

const normalizeDateParam = (raw: string): string | null =>
	parseDateFilterParam(raw.trim());

function useDebouncedAmountFilter(
	param: string,
	searchParams: URLSearchParams | ReadonlyURLSearchParams,
	onChange: (key: string, value: string | null) => void,
): [string, (value: string) => void] {
	const current = searchParams.get(param) ?? "";
	const [value, setValue] = useState(current);

	useEffect(() => {
		setValue(current);
	}, [current]);

	useEffect(() => {
		if (value === current) return;
		const timeout = setTimeout(() => {
			const normalized = normalizeAmountParam(value);
			if ((normalized ?? "") === current) return;
			onChange(param, normalized);
		}, 400);
		return () => clearTimeout(timeout);
	}, [value, current, param, onChange]);

	return [value, setValue];
}

interface FilterSelectProps {
	param: string;
	placeholder: string;
	options: { value: string; label: string }[];
	widthClass?: string;
	disabled?: boolean;
	getParamValue: (key: string) => string;
	onChange: (key: string, value: string | null) => void;
	renderContent?: (label: string) => ReactNode;
}

function FilterSelect({
	param,
	placeholder,
	options,
	widthClass = "w-[130px]",
	disabled,
	getParamValue,
	onChange,
	renderContent,
}: FilterSelectProps) {
	const value = getParamValue(param);
	const current = options.find((option) => option.value === value);
	const displayLabel =
		value === FILTER_EMPTY_VALUE
			? placeholder
			: (current?.label ?? placeholder);
	const hasSelection = value !== FILTER_EMPTY_VALUE && Boolean(current);

	return (
		<Select
			value={value}
			onValueChange={(nextValue) =>
				onChange(param, nextValue === FILTER_EMPTY_VALUE ? null : nextValue)
			}
			disabled={disabled}
		>
			<SelectTrigger
				className={cn("text-sm border-dashed", widthClass)}
				disabled={disabled}
			>
				<span
					className={cn(
						"truncate",
						hasSelection ? "text-foreground" : "text-muted-foreground",
					)}
				>
					{current && renderContent
						? renderContent(current.label)
						: displayLabel}
				</span>
			</SelectTrigger>
			<SelectContent>
				<SelectItem value={FILTER_EMPTY_VALUE}>Todos</SelectItem>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{renderContent ? renderContent(option.label) : option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

type MultiOption = {
	value: string;
	label: string;
	group?: string;
	render?: ReactNode;
};

const getCategoryFilterGroup = (type?: string | null) => {
	if (type === "receita") {
		return "Receitas";
	}
	if (type === "despesa") {
		return "Despesas";
	}
	return "Outras";
};

interface MultiSelectFilterProps {
	placeholder: string;
	options: MultiOption[];
	selected: string[];
	onChange: (values: string[]) => void;
	widthClass?: string;
	disabled?: boolean;
	searchable?: boolean;
	searchPlaceholder?: string;
	groupOrder?: string[];
}

function MultiSelectFilter({
	placeholder,
	options,
	selected,
	onChange,
	widthClass = "w-full",
	disabled,
	searchable = false,
	searchPlaceholder = "Buscar...",
	groupOrder,
}: MultiSelectFilterProps) {
	const [open, setOpen] = useState(false);

	const groupedOptions = useMemo(() => {
		const map = new Map<string, MultiOption[]>();
		for (const option of options) {
			const key = option.group ?? "";
			const list = map.get(key) ?? [];
			list.push(option);
			map.set(key, list);
		}
		const orderedKeys = groupOrder
			? [
					...groupOrder,
					...Array.from(map.keys()).filter((k) => !groupOrder.includes(k)),
				]
			: Array.from(map.keys());
		return orderedKeys
			.filter((key) => map.has(key))
			.map((key) => ({ name: key, items: map.get(key) ?? [] }));
	}, [options, groupOrder]);

	const selectedSet = new Set(selected);
	const selectedOptions = options.filter((option) =>
		selectedSet.has(option.value),
	);

	const toggle = (value: string) => {
		if (selectedSet.has(value)) {
			onChange(selected.filter((v) => v !== value));
		} else {
			onChange([...selected, value]);
		}
	};

	const clear = () => {
		onChange([]);
	};

	const triggerLabel: ReactNode =
		selectedOptions.length === 0 ? (
			placeholder
		) : selectedOptions.length === 1 ? (
			(selectedOptions[0]?.render ?? selectedOptions[0]?.label)
		) : (
			<span className="flex items-center gap-1.5">
				<span className="text-foreground">
					{selectedOptions.length} selecionados
				</span>
			</span>
		);

	return (
		<Popover open={open} onOpenChange={setOpen} modal>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className={cn(
						"justify-between text-sm border-dashed font-normal shadow-none",
						widthClass,
					)}
					disabled={disabled}
				>
					<span
						className={cn(
							"truncate flex items-center gap-2",
							selectedOptions.length > 0
								? "text-foreground"
								: "text-muted-foreground",
						)}
					>
						{triggerLabel}
					</span>
					<RiExpandUpDownLine
						className="ml-2 size-4 shrink-0 opacity-50"
						aria-hidden
					/>
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-[260px] p-0">
				<Command>
					{searchable ? <CommandInput placeholder={searchPlaceholder} /> : null}
					<CommandList>
						<CommandEmpty>Nada encontrado.</CommandEmpty>
						<CommandGroup>
							<CommandItem
								value="__clear"
								onSelect={() => clear()}
								disabled={selectedOptions.length === 0}
								className="text-muted-foreground data-[disabled=true]:opacity-50 data-[disabled=true]:pointer-events-none"
							>
								Limpar seleção
							</CommandItem>
						</CommandGroup>
						{groupedOptions.map((group) => (
							<CommandGroup
								key={group.name || "default"}
								heading={group.name || undefined}
							>
								{group.items.map((option) => {
									const isSelected = selectedSet.has(option.value);
									return (
										<CommandItem
											key={option.value}
											value={`${option.value} ${option.label}`}
											onSelect={() => toggle(option.value)}
											className="gap-2"
										>
											<Checkbox
												checked={isSelected}
												className="pointer-events-none"
												aria-hidden
											/>
											<span className="flex items-center gap-2 flex-1 min-w-0 truncate">
												{option.render ?? option.label}
											</span>
											{isSelected ? (
												<RiCheckLine
													className="ml-auto size-4 shrink-0"
													aria-hidden
												/>
											) : null}
										</CommandItem>
									);
								})}
							</CommandGroup>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

interface TransactionsFiltersProps {
	payerOptions: TransactionFilterOption[];
	partyOptions: TransactionFilterOption[];
	categoryOptions: TransactionFilterOption[];
	accountCardOptions: AccountCardFilterOption[];
	className?: string;
	exportButton?: ReactNode;
	hideAdvancedFilters?: boolean;
}

export function TransactionsFilters({
	payerOptions,
	partyOptions,
	categoryOptions,
	accountCardOptions,
	className,
	exportButton,
	hideAdvancedFilters = false,
}: TransactionsFiltersProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [isPending, startTransition] = useTransition();

	const getParamValue = (key: string) =>
		searchParams.get(key) ?? FILTER_EMPTY_VALUE;

	const getParamValues = useCallback(
		(key: string) => searchParams.getAll(key),
		[searchParams],
	);

	const handleFilterChange = useCallback(
		(key: string, value: string | null) => {
			const nextParams = new URLSearchParams(searchParams.toString());

			if (value && value !== FILTER_EMPTY_VALUE) {
				nextParams.set(key, value);
			} else {
				nextParams.delete(key);
			}

			nextParams.delete("page");

			startTransition(() => {
				const target = nextParams.toString()
					? `${pathname}?${nextParams.toString()}`
					: pathname;
				router.replace(target, { scroll: false });
			});
		},
		[searchParams, pathname, router],
	);

	const handleMultiFilterChange = useCallback(
		(key: string, values: string[]) => {
			const nextParams = new URLSearchParams(searchParams.toString());
			nextParams.delete(key);
			for (const value of values) {
				if (value) {
					nextParams.append(key, value);
				}
			}
			nextParams.delete("page");

			startTransition(() => {
				const target = nextParams.toString()
					? `${pathname}?${nextParams.toString()}`
					: pathname;
				router.replace(target, { scroll: false });
				router.refresh();
			});
		},
		[searchParams, pathname, router],
	);

	const handleDateFilterChange = useCallback(
		(key: string, value: string) => {
			handleFilterChange(key, normalizeDateParam(value));
		},
		[handleFilterChange],
	);

	const [searchValue, setSearchValue] = useState(searchParams.get("q") ?? "");
	const currentSearchParam = searchParams.get("q") ?? "";

	useEffect(() => {
		setSearchValue(currentSearchParam);
	}, [currentSearchParam]);

	useEffect(() => {
		if (searchValue === currentSearchParam) {
			return;
		}

		const timeout = setTimeout(() => {
			const normalized = searchValue.trim();
			handleFilterChange("q", normalized.length > 0 ? normalized : null);
		}, 350);

		return () => clearTimeout(timeout);
	}, [searchValue, currentSearchParam, handleFilterChange]);

	const [valorMinValue, setValorMinValue] = useDebouncedAmountFilter(
		AMOUNT_MIN_PARAM,
		searchParams,
		handleFilterChange,
	);
	const [valorMaxValue, setValorMaxValue] = useDebouncedAmountFilter(
		AMOUNT_MAX_PARAM,
		searchParams,
		handleFilterChange,
	);

	const handleReset = () => {
		const periodValue = searchParams.get("periodo");
		const pageSizeValue = searchParams.get("pageSize");
		const nextParams = new URLSearchParams();
		if (periodValue) {
			nextParams.set("periodo", periodValue);
		}
		if (pageSizeValue) {
			nextParams.set("pageSize", pageSizeValue);
		}
		setSearchValue("");
		setValorMinValue("");
		setValorMaxValue("");
		startTransition(() => {
			const target = nextParams.toString()
				? `${pathname}?${nextParams.toString()}`
				: pathname;
			router.replace(target, { scroll: false });
		});
	};

	const conditionOptions = useMemo<MultiOption[]>(
		() =>
			TRANSACTION_CONDITIONS.map((value) => ({
				value: slugify(value),
				label: value,
				render: <ConditionSelectContent label={value} />,
			})),
		[],
	);

	const paymentOptions = useMemo<MultiOption[]>(
		() =>
			PAYMENT_METHODS.map((value) => ({
				value: slugify(value),
				label: value,
				render: <PaymentMethodSelectContent label={value} />,
			})),
		[],
	);

	const payerMultiOptions = useMemo<MultiOption[]>(
		() =>
			payerOptions.map((option) => ({
				value: option.slug,
				label: option.label,
				render: (
					<PayerSelectContent
						label={option.label}
						avatarUrl={option.avatarUrl}
					/>
				),
			})),
		[payerOptions],
	);

	const partyMultiOptions = useMemo<MultiOption[]>(
		() =>
			partyOptions.map((option) => ({
				value: option.slug,
				label: option.label,
				render: <ClientAvatarLabel name={option.label} size="sm" />,
			})),
		[partyOptions],
	);

	const categoryMultiOptions = useMemo<MultiOption[]>(
		() =>
			categoryOptions.map((option) => ({
				value: option.slug,
				label: option.label,
				group: getCategoryFilterGroup(option.type),
				render: (
					<CategorySelectContent label={option.label} icon={option.icon} />
				),
			})),
		[categoryOptions],
	);

	const accountCardMultiOptions = useMemo<MultiOption[]>(
		() =>
			accountCardOptions.map((option) => ({
				value: option.slug,
				label: option.label,
				group: option.kind === "cartao" ? "Cartões" : "Contas",
				render: (
					<AccountCardSelectContent
						label={option.label}
						logo={option.logo}
						isCartao={option.kind === "cartao"}
					/>
				),
			})),
		[accountCardOptions],
	);

	const [drawerOpen, setDrawerOpen] = useState(false);
	const hasDateRangeFilter =
		Boolean(searchParams.get(DATE_START_PARAM)) ||
		Boolean(searchParams.get(DATE_END_PARAM));
	const hasAmountFilter =
		Boolean(searchParams.get(AMOUNT_MIN_PARAM)) ||
		Boolean(searchParams.get(AMOUNT_MAX_PARAM));
	const activeFilterCount = [
		Boolean(searchParams.get("type")),
		searchParams.getAll("condition").length > 0,
		searchParams.getAll("payment").length > 0,
		searchParams.getAll("payer").length > 0,
		searchParams.getAll("party").length > 0,
		searchParams.getAll("category").length > 0,
		searchParams.getAll("accountCard").length > 0,
		Boolean(searchParams.get("settled")),
		Boolean(searchParams.get("hasAttachment")),
		Boolean(searchParams.get("isDivided")),
		hasAmountFilter,
		hasDateRangeFilter,
	].filter(Boolean).length;
	const hasActiveFilters = activeFilterCount > 0;
	const settledFilterValue = searchParams.get("settled") ?? FILTER_EMPTY_VALUE;

	const handleResetFilters = () => {
		handleReset();
		setDrawerOpen(false);
	};

	const handleResetDateRange = () => {
		const nextParams = new URLSearchParams(searchParams.toString());
		nextParams.delete(DATE_START_PARAM);
		nextParams.delete(DATE_END_PARAM);
		nextParams.delete("page");
		startTransition(() => {
			const target = nextParams.toString()
				? `${pathname}?${nextParams.toString()}`
				: pathname;
			router.replace(target, { scroll: false });
		});
	};

	const handleRemoveParams = (keys: string[]) => {
		const nextParams = new URLSearchParams(searchParams.toString());
		for (const key of keys) {
			nextParams.delete(key);
		}
		nextParams.delete("page");

		if (keys.includes(AMOUNT_MIN_PARAM)) {
			setValorMinValue("");
		}
		if (keys.includes(AMOUNT_MAX_PARAM)) {
			setValorMaxValue("");
		}

		startTransition(() => {
			const target = nextParams.toString()
				? `${pathname}?${nextParams.toString()}`
				: pathname;
			router.replace(target, { scroll: false });
		});
	};

	const handleRemoveMultiValue = (key: string, value: string) => {
		handleMultiFilterChange(
			key,
			getParamValues(key).filter((currentValue) => currentValue !== value),
		);
	};

	const activeFilterChips: Array<{
		key: string;
		label: string;
		onRemove: () => void;
	}> = [];

	const typeValue = searchParams.get("type");
	if (typeValue) {
		const label =
			TRANSACTION_TYPES.find((value) => slugify(value) === typeValue) ??
			typeValue;
		activeFilterChips.push({
			key: `type-${typeValue}`,
			label: `Tipo: ${label}`,
			onRemove: () => handleRemoveParams(["type"]),
		});
	}

	const addMultiValueChips = (
		param: string,
		prefix: string,
		options: MultiOption[],
	) => {
		const labels = new Map(
			options.map((option) => [option.value, option.label]),
		);
		for (const value of getParamValues(param)) {
			activeFilterChips.push({
				key: `${param}-${value}`,
				label: `${prefix}: ${labels.get(value) ?? value}`,
				onRemove: () => handleRemoveMultiValue(param, value),
			});
		}
	};

	addMultiValueChips("condition", "Condição", conditionOptions);
	addMultiValueChips("payment", "Pagamento", paymentOptions);
	addMultiValueChips("payer", "Pessoa", payerMultiOptions);
	addMultiValueChips("party", "Cliente/Fornecedor", partyMultiOptions);
	addMultiValueChips("category", "Categoria", categoryMultiOptions);
	addMultiValueChips("accountCard", "Conta/cartão", accountCardMultiOptions);

	const settledValue = searchParams.get("settled");
	if (settledValue) {
		activeFilterChips.push({
			key: `settled-${settledValue}`,
			label:
				settledValue === SETTLED_FILTER_VALUES.PAID
					? "Status: Pago"
					: "Status: Não pago",
			onRemove: () => handleRemoveParams(["settled"]),
		});
	}

	if (searchParams.get("hasAttachment") === "true") {
		activeFilterChips.push({
			key: "has-attachment",
			label: "Com anexo",
			onRemove: () => handleRemoveParams(["hasAttachment"]),
		});
	}

	if (searchParams.get("isDivided") === "true") {
		activeFilterChips.push({
			key: "is-divided",
			label: "Somente divididos",
			onRemove: () => handleRemoveParams(["isDivided"]),
		});
	}

	if (hasAmountFilter) {
		const minValue = parsePositiveAmount(
			searchParams.get(AMOUNT_MIN_PARAM) ?? "",
		);
		const maxValue = parsePositiveAmount(
			searchParams.get(AMOUNT_MAX_PARAM) ?? "",
		);
		const label =
			minValue !== null && maxValue !== null
				? `Valor: ${formatCurrency(minValue)} até ${formatCurrency(maxValue)}`
				: minValue !== null
					? `Valor: a partir de ${formatCurrency(minValue)}`
					: `Valor: até ${formatCurrency(maxValue ?? 0)}`;
		activeFilterChips.push({
			key: "amount-range",
			label,
			onRemove: () => handleRemoveParams([AMOUNT_MIN_PARAM, AMOUNT_MAX_PARAM]),
		});
	}

	if (hasDateRangeFilter) {
		const startValue = formatDateOnly(searchParams.get(DATE_START_PARAM));
		const endValue = formatDateOnly(searchParams.get(DATE_END_PARAM));
		const label =
			startValue && endValue
				? `Datas: ${startValue} até ${endValue}`
				: startValue
					? `Datas: a partir de ${startValue}`
					: `Datas: até ${endValue}`;
		activeFilterChips.push({
			key: "date-range",
			label,
			onRemove: () => handleRemoveParams([DATE_START_PARAM, DATE_END_PARAM]),
		});
	}

	return (
		<div
			aria-busy={isPending}
			className={cn(
				"flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center",
				className,
			)}
		>
			<div className="relative w-full md:w-[250px]">
				<Input
					value={searchValue}
					onChange={(event) => setSearchValue(event.target.value)}
					placeholder="Buscar"
					aria-label="Buscar lançamentos"
					className={cn(
						"w-full text-sm border-dashed",
						searchValue.length > 0 && "pr-8",
					)}
				/>
				{searchValue.length > 0 ? (
					<button
						type="button"
						onClick={() => setSearchValue("")}
						aria-label="Limpar busca"
						className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<RiCloseLine className="size-4" aria-hidden />
					</button>
				) : null}
			</div>

			<div className="flex w-full gap-2 md:w-auto">
				{exportButton && (
					<div className="flex-1 md:flex-none *:w-full *:md:w-auto">
						{exportButton}
					</div>
				)}

				{!hideAdvancedFilters && (
					<HoverCard openDelay={200} closeDelay={200}>
						<Drawer
							direction="right"
							open={drawerOpen}
							onOpenChange={setDrawerOpen}
						>
							<HoverCardTrigger asChild>
								<DrawerTrigger asChild>
									<Button
										variant="outline"
										className="flex-1 md:flex-none text-sm border-dashed relative bg-transparent"
										aria-label={
											isPending ? "Aplicando filtros" : "Abrir filtros"
										}
									>
										{isPending ? (
											<Spinner
												className="size-4"
												role="presentation"
												aria-hidden
											/>
										) : (
											<RiFilterLine className="size-4" aria-hidden />
										)}
										{isPending ? "Aplicando..." : "Filtros"}
										{hasActiveFilters && (
											<span
												className="absolute -top-1 -right-1 size-3 rounded-full bg-primary"
												aria-hidden
											/>
										)}
									</Button>
								</DrawerTrigger>
							</HoverCardTrigger>
							{activeFilterChips.length > 0 ? (
								<HoverCardContent
									align="end"
									className="w-80 space-y-3"
									aria-label="Filtros ativos"
								>
									<div className="space-y-0.5">
										<p className="text-sm font-medium">Filtros ativos</p>
										<p className="text-xs text-muted-foreground">
											Remova rapidamente o que não precisa mais.
										</p>
									</div>
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
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={handleReset}
										disabled={isPending}
										className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
									>
										Limpar filtros
									</Button>
								</HoverCardContent>
							) : null}
							<DrawerContent>
								<DrawerHeader>
									<DrawerTitle>Filtros</DrawerTitle>
									<DrawerDescription>
										Selecione os filtros desejados para refinar os lançamentos
									</DrawerDescription>
								</DrawerHeader>

								<div className="flex-1 overflow-y-auto px-4 space-y-4">
									<div>
										<div className="grid gap-3 sm:grid-cols-2">
											<div className="space-y-1.5">
												<label className="text-xs font-medium text-muted-foreground">
													Tipo de lançamento
												</label>
												<FilterSelect
													param="type"
													placeholder="Todos"
													options={TRANSACTION_TYPES.map((v) => ({
														value: slugify(v),
														label: v,
													}))}
													widthClass="w-full border-dashed"
													disabled={isPending}
													getParamValue={getParamValue}
													onChange={handleFilterChange}
													renderContent={(label) => (
														<TransactionTypeSelectContent label={label} />
													)}
												/>
											</div>

											<div className="space-y-1.5">
												<label className="text-xs font-medium text-muted-foreground">
													Condição de pagamento
												</label>
												<MultiSelectFilter
													placeholder="Todas"
													options={conditionOptions}
													selected={getParamValues("condition")}
													onChange={(values) =>
														handleMultiFilterChange("condition", values)
													}
													disabled={isPending}
												/>
											</div>

											<div className="space-y-1.5">
												<label className="text-xs font-medium text-muted-foreground">
													Forma de pagamento
												</label>
												<MultiSelectFilter
													placeholder="Todas"
													options={paymentOptions}
													selected={getParamValues("payment")}
													onChange={(values) =>
														handleMultiFilterChange("payment", values)
													}
													disabled={isPending}
												/>
											</div>

											<div className="space-y-1.5">
												<label className="text-xs font-medium text-muted-foreground">
													Pessoa
												</label>
												<MultiSelectFilter
													placeholder="Todas"
													options={payerMultiOptions}
													selected={getParamValues("payer")}
													onChange={(values) =>
														handleMultiFilterChange("payer", values)
													}
													disabled={isPending}
													searchable
													searchPlaceholder="Buscar pessoa..."
												/>
											</div>

											<div className="space-y-1.5">
												<label className="text-xs font-medium text-muted-foreground">
													Cliente/Fornecedor
												</label>
												<MultiSelectFilter
													placeholder="Todos"
													options={partyMultiOptions}
													selected={getParamValues("party")}
													onChange={(values) =>
														handleMultiFilterChange("party", values)
													}
													disabled={isPending}
													searchable
													searchPlaceholder="Buscar cliente ou fornecedor..."
												/>
											</div>

											<div className="space-y-1.5">
												<label className="text-xs font-medium text-muted-foreground">
													Categoria
												</label>
												<MultiSelectFilter
													placeholder="Todas"
													options={categoryMultiOptions}
													selected={getParamValues("category")}
													onChange={(values) =>
														handleMultiFilterChange("category", values)
													}
													disabled={isPending}
													searchable
													searchPlaceholder="Buscar categoria..."
													groupOrder={["Despesas", "Receitas", "Outras"]}
												/>
											</div>

											<div className="space-y-1.5">
												<label className="text-xs font-medium text-muted-foreground">
													Conta/Cartão
												</label>
												<MultiSelectFilter
													placeholder="Todos"
													options={accountCardMultiOptions}
													selected={getParamValues("accountCard")}
													onChange={(values) =>
														handleMultiFilterChange("accountCard", values)
													}
													disabled={isPending}
													searchable
													searchPlaceholder="Buscar conta ou cartão..."
													groupOrder={["Contas", "Cartões"]}
												/>
											</div>
										</div>
									</div>

									<Separator />

									<div className="space-y-3">
										<div className="space-y-2">
											<div className="flex items-center justify-between gap-2">
												<label className="text-xs font-medium text-muted-foreground">
													Intervalo de datas
												</label>
												{hasDateRangeFilter ? (
													<button
														type="button"
														onClick={handleResetDateRange}
														disabled={isPending}
														className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
													>
														Limpar período
													</button>
												) : null}
											</div>
											<div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
												<DatePicker
													value={searchParams.get(DATE_START_PARAM) ?? ""}
													onChange={(value) =>
														handleDateFilterChange(DATE_START_PARAM, value)
													}
													placeholder="Data inicial"
													disabled={isPending}
													inputClassName="border-dashed"
													compact
												/>
												<span className="hidden text-xs text-muted-foreground sm:block">
													até
												</span>
												<DatePicker
													value={searchParams.get(DATE_END_PARAM) ?? ""}
													onChange={(value) =>
														handleDateFilterChange(DATE_END_PARAM, value)
													}
													placeholder="Data final"
													disabled={isPending}
													inputClassName="border-dashed"
													compact
												/>
											</div>
										</div>

										<div className="space-y-2">
											<label className="text-xs font-medium text-muted-foreground">
												Faixa de valor
											</label>
											<div className="flex items-center gap-2">
												<Input
													type="number"
													inputMode="decimal"
													min="0"
													step="0.01"
													placeholder="Mínimo"
													aria-label="Valor mínimo"
													value={valorMinValue}
													onChange={(event) =>
														setValorMinValue(event.target.value)
													}
													disabled={isPending}
													className="text-sm border-dashed"
												/>
												<span className="text-xs text-muted-foreground">
													até
												</span>
												<Input
													type="number"
													inputMode="decimal"
													min="0"
													step="0.01"
													placeholder="Máximo"
													aria-label="Valor máximo"
													value={valorMaxValue}
													onChange={(event) =>
														setValorMaxValue(event.target.value)
													}
													disabled={isPending}
													className="text-sm border-dashed"
												/>
											</div>
										</div>
									</div>

									<Separator />

									<div className="space-y-3">
										<ToggleGroup
											type="single"
											value={settledFilterValue}
											onValueChange={(value) => {
												if (!value) return;
												handleFilterChange(
													"settled",
													value === FILTER_EMPTY_VALUE ? null : value,
												);
											}}
											variant="outline"
											size="sm"
											className="grid w-full grid-cols-3 rounded-md bg-muted/30 p-0.5"
											aria-label="Status de pagamento"
										>
											<ToggleGroupItem
												value={FILTER_EMPTY_VALUE}
												className="text-xs font-medium transition-all data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background data-[state=on]:shadow-sm"
											>
												Todos
											</ToggleGroupItem>
											<ToggleGroupItem
												value={SETTLED_FILTER_VALUES.PAID}
												className="text-xs font-medium transition-all data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background data-[state=on]:shadow-sm"
											>
												Pagos
											</ToggleGroupItem>
											<ToggleGroupItem
												value={SETTLED_FILTER_VALUES.UNPAID}
												className="text-xs font-medium transition-all data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background data-[state=on]:shadow-sm"
											>
												Não pagos
											</ToggleGroupItem>
										</ToggleGroup>
									</div>

									<div className="flex items-center justify-between">
										<label
											htmlFor="filter-has-attachment"
											className="text-sm font-medium cursor-pointer"
										>
											Com anexo
										</label>
										<Switch
											id="filter-has-attachment"
											checked={searchParams.get("hasAttachment") === "true"}
											disabled={isPending}
											onCheckedChange={(checked) => {
												handleFilterChange(
													"hasAttachment",
													checked ? "true" : null,
												);
											}}
										/>
									</div>

									<div className="flex items-center justify-between">
										<label
											htmlFor="filter-is-divided"
											className="text-sm font-medium cursor-pointer"
										>
											Somente divididos
										</label>
										<Switch
											id="filter-is-divided"
											checked={searchParams.get("isDivided") === "true"}
											disabled={isPending}
											onCheckedChange={(checked) => {
												handleFilterChange(
													"isDivided",
													checked ? "true" : null,
												);
											}}
										/>
									</div>
								</div>

								<DrawerFooter>
									<div className="flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-2">
										<div className="flex min-w-0 flex-col gap-0.5">
											<span
												className="text-xs text-muted-foreground"
												aria-live="polite"
											>
												{hasActiveFilters
													? `${activeFilterCount} ${
															activeFilterCount === 1
																? "filtro ativo"
																: "filtros ativos"
														}`
													: "Nenhum filtro ativo"}
											</span>
											{isPending ? (
												<span
													className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
													role="status"
												>
													<Spinner
														className="size-3"
														role="presentation"
														aria-hidden
													/>
													Aplicando filtros...
												</span>
											) : null}
										</div>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={handleResetFilters}
											disabled={isPending || !hasActiveFilters}
											className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
										>
											Limpar
										</Button>
									</div>
								</DrawerFooter>
							</DrawerContent>
						</Drawer>
					</HoverCard>
				)}
			</div>
		</div>
	);
}
