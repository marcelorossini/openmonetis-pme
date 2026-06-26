import type { TransactionItem } from "@/features/transactions/components/types";
import { getTodayDateString } from "@/shared/utils/date";
import { derivePeriodFromDate, getNextPeriod } from "@/shared/utils/period";
import {
	PAYMENT_METHODS,
	TRANSACTION_CONDITIONS,
	TRANSACTION_TYPES,
} from "./constants";

/**
 * Derives the fatura period for a credit card purchase based on closing day
 * and due day. The period represents the month the fatura is due (vencimento).
 *
 * Steps:
 * 1. If purchase day >= closing day → the purchase missed this month's closing,
 *    so it enters the NEXT month's billing cycle (+1 month from purchase).
 * 2. Then, if dueDay < closingDay, the due date falls in the month AFTER the
 *    closing month (e.g., closes 22nd, due 1st → closes Mar/22, due Apr/1),
 *    so we add another +1 month.
 *
 * @example
 * // Card closes day 22, due day 1 (dueDay < closingDay → +1 extra)
 * deriveCreditCardPeriod("2026-02-25", "22", "1")  // "2026-04" (missed Feb closing → Mar cycle → due Apr)
 * deriveCreditCardPeriod("2026-02-15", "22", "1")  // "2026-03" (in Feb cycle → due Mar)
 *
 * // Card closes day 5, due day 15 (dueDay >= closingDay → no extra)
 * deriveCreditCardPeriod("2026-02-10", "5", "15")  // "2026-03" (missed Feb closing → Mar cycle → due Mar)
 * deriveCreditCardPeriod("2026-02-05", "5", "15")  // "2026-03" (closing day itself already goes to next cycle)
 * deriveCreditCardPeriod("2026-02-03", "5", "15")  // "2026-02" (in Feb cycle → due Feb)
 */
export function deriveCreditCardPeriod(
	purchaseDate: string,
	closingDay: string | null | undefined,
	dueDay?: string | null | undefined,
): string {
	const basePeriod = derivePeriodFromDate(purchaseDate);
	if (!closingDay) return basePeriod;

	const closingDayNum = Number.parseInt(closingDay, 10);
	if (Number.isNaN(closingDayNum)) return basePeriod;

	const dayPart = purchaseDate.split("-")[2];
	const purchaseDayNum = Number.parseInt(dayPart ?? "1", 10);

	// Start with the purchase month as the billing cycle
	let period = basePeriod;

	// If purchase is on/after closing day, it enters the next billing cycle
	if (purchaseDayNum >= closingDayNum) {
		period = getNextPeriod(period);
	}

	// If due day < closing day, the due date falls in the month after closing
	// (e.g., closes 22nd, due 1st → closing in March means due in April)
	const dueDayNum = Number.parseInt(dueDay ?? "", 10);
	if (!Number.isNaN(dueDayNum) && dueDayNum < closingDayNum) {
		period = getNextPeriod(period);
	}

	return period;
}

/**
 * Form state type for lancamento dialog
 */
export type TransactionFormState = {
	purchaseDate: string;
	period: string;
	name: string;
	transactionType: string;
	amount: string;
	condition: string;
	paymentMethod: string;
	payerId: string | undefined;
	clientId: string | undefined;
	secondaryPayerId: string | undefined;
	splitShares: Array<{ payerId: string; amount: string }>;
	isSplit: boolean;
	primarySplitAmount: string;
	secondarySplitAmount: string;
	accountId: string | undefined;
	cardId: string | undefined;
	categoryId: string | undefined;
	installmentCount: string;
	startInstallment: string;
	recurrenceCount: string;
	dueDate: string;
	boletoPaymentDate: string;
	note: string;
	isSettled: boolean | null;
};

/**
 * Initial state overrides for lancamento form
 */
type TransactionFormOverrides = {
	defaultCardId?: string | null;
	defaultAccountId?: string | null;
	defaultPaymentMethod?: string | null;
	defaultPurchaseDate?: string | null;
	defaultName?: string | null;
	defaultAmount?: string | null;
	defaultTransactionType?: "Despesa" | "Receita";
	isImporting?: boolean;
};

/**
 * Builds initial form state from lancamento data and defaults
 */
export function buildTransactionInitialState(
	transaction?: TransactionItem,
	defaultPayerId?: string | null,
	preferredPeriod?: string,
	overrides?: TransactionFormOverrides,
): TransactionFormState {
	const purchaseDate = transaction?.purchaseDate
		? transaction.purchaseDate.slice(0, 10)
		: (overrides?.defaultPurchaseDate ?? getTodayDateString());

	const paymentMethod =
		transaction?.paymentMethod ??
		overrides?.defaultPaymentMethod ??
		PAYMENT_METHODS[0];

	const derivedPeriod = derivePeriodFromDate(purchaseDate);
	const fallbackPeriod =
		preferredPeriod && /^\d{4}-\d{2}$/.test(preferredPeriod)
			? preferredPeriod
			: derivedPeriod;

	// Quando importando, usar valores padrão do usuário logado ao invés dos valores do lançamento original
	const isImporting = overrides?.isImporting ?? false;
	const fallbackPayerId = isImporting
		? (defaultPayerId ?? null)
		: (transaction?.payerId ?? defaultPayerId ?? null);
	const fallbackClientId =
		!isImporting && transaction?.transactionType === "Receita"
			? transaction.clientId
			: null;

	const boletoPaymentDate =
		transaction?.boletoPaymentDate ??
		(paymentMethod === "Boleto" && (transaction?.isSettled ?? false)
			? getTodayDateString()
			: "");

	// Calcular o valor correto para importação de parcelados
	let amountValue = overrides?.defaultAmount ?? "";
	if (!amountValue && typeof transaction?.amount === "number") {
		let baseAmount = Math.abs(transaction.amount);

		// Se está importando e é parcelado, usar o valor total (parcela * quantidade)
		if (
			isImporting &&
			transaction.condition === "Parcelado" &&
			transaction.installmentCount
		) {
			baseAmount = baseAmount * transaction.installmentCount;
		}

		amountValue = (Math.round(baseAmount * 100) / 100).toFixed(2);
	}

	return {
		purchaseDate,
		period:
			transaction?.period && /^\d{4}-\d{2}$/.test(transaction.period)
				? transaction.period
				: fallbackPeriod,
		name: transaction?.name ?? overrides?.defaultName ?? "",
		transactionType:
			transaction?.transactionType ??
			overrides?.defaultTransactionType ??
			TRANSACTION_TYPES[0],
		amount: amountValue,
		condition: transaction?.condition ?? TRANSACTION_CONDITIONS[0],
		paymentMethod,
		payerId: fallbackPayerId ?? undefined,
		clientId: fallbackClientId ?? undefined,
		secondaryPayerId: undefined,
		splitShares: [],
		isSplit: false,

		primarySplitAmount: "",
		secondarySplitAmount: "",
		accountId:
			paymentMethod === "Cartão de crédito"
				? undefined
				: isImporting
					? undefined
					: (transaction?.accountId ??
						overrides?.defaultAccountId ??
						undefined),
		cardId:
			paymentMethod === "Cartão de crédito"
				? isImporting
					? (overrides?.defaultCardId ?? undefined)
					: (transaction?.cardId ?? overrides?.defaultCardId ?? undefined)
				: undefined,
		categoryId: isImporting
			? undefined
			: (transaction?.categoryId ?? undefined),
		installmentCount: transaction?.installmentCount
			? String(transaction.installmentCount)
			: "",
		startInstallment:
			isImporting &&
			transaction?.condition === "Parcelado" &&
			transaction.currentInstallment
				? String(transaction.currentInstallment)
				: "1",
		recurrenceCount: transaction?.recurrenceCount
			? String(transaction.recurrenceCount)
			: "",
		dueDate: transaction?.dueDate ?? "",
		boletoPaymentDate,
		note: transaction?.note ?? "",
		isSettled:
			paymentMethod === "Cartão de crédito"
				? null
				: (transaction?.isSettled ?? true),
	};
}

/**
 * Applies field dependencies when form state changes
 * This function encapsulates the business logic for field interdependencies
 */
export function applyFieldDependencies(
	key: keyof TransactionFormState,
	value: TransactionFormState[keyof TransactionFormState],
	currentState: TransactionFormState,
	cardInfo?: { closingDay: string | null; dueDay: string | null } | null,
): Partial<TransactionFormState> {
	const updates: Partial<TransactionFormState> = {};

	// Auto-derive period from purchaseDate
	if (key === "purchaseDate" && typeof value === "string" && value) {
		const method = currentState.paymentMethod;
		if (method === "Cartão de crédito") {
			updates.period = deriveCreditCardPeriod(
				value,
				cardInfo?.closingDay,
				cardInfo?.dueDay,
			);
		} else if (method !== "Boleto") {
			updates.period = derivePeriodFromDate(value);
		}
	}

	// Auto-derive period from dueDate when payment method is boleto
	if (key === "dueDate" && typeof value === "string" && value) {
		if (currentState.paymentMethod === "Boleto") {
			updates.period = derivePeriodFromDate(value);
		}
	}

	// Auto-derive period when cardId changes (credit card selected)
	if (key === "cardId" && currentState.paymentMethod === "Cartão de crédito") {
		if (typeof value === "string" && value && currentState.purchaseDate) {
			updates.period = deriveCreditCardPeriod(
				currentState.purchaseDate,
				cardInfo?.closingDay,
				cardInfo?.dueDay,
			);
		}
	}

	// When condition changes, clear irrelevant fields
	if (key === "condition" && typeof value === "string") {
		if (value !== "Parcelado") {
			updates.installmentCount = "";
			updates.startInstallment = "1";
		}
		if (value !== "Recorrente") {
			updates.recurrenceCount = "";
		}
	}

	if (key === "transactionType" && value !== "Receita") {
		updates.clientId = undefined;
	}

	if (key === "installmentCount" && typeof value === "string" && value) {
		const nextCount = Number.parseInt(value, 10);
		const currentStart = Number.parseInt(currentState.startInstallment, 10);
		if (
			!Number.isNaN(nextCount) &&
			!Number.isNaN(currentStart) &&
			currentStart > nextCount
		) {
			updates.startInstallment = String(nextCount);
		}
	}

	// When payment method changes, adjust related fields
	if (key === "paymentMethod" && typeof value === "string") {
		if (value === "Cartão de crédito") {
			updates.accountId = undefined;
			updates.isSettled = null;
		} else {
			updates.cardId = undefined;
			updates.isSettled = currentState.isSettled ?? true;
		}

		// Re-derive period based on new payment method
		if (value === "Cartão de crédito") {
			if (
				currentState.purchaseDate &&
				currentState.cardId &&
				cardInfo?.closingDay
			) {
				updates.period = deriveCreditCardPeriod(
					currentState.purchaseDate,
					cardInfo.closingDay,
					cardInfo.dueDay,
				);
			} else if (currentState.purchaseDate) {
				updates.period = derivePeriodFromDate(currentState.purchaseDate);
			}
		} else if (value === "Boleto" && currentState.dueDate) {
			updates.period = derivePeriodFromDate(currentState.dueDate);
		} else if (currentState.purchaseDate) {
			updates.period = derivePeriodFromDate(currentState.purchaseDate);
		}

		// Clear boleto-specific fields if not boleto
		if (value !== "Boleto") {
			updates.dueDate = "";
			updates.boletoPaymentDate = "";
		} else if (
			currentState.isSettled ||
			(updates.isSettled !== null && updates.isSettled !== undefined)
		) {
			// Set today's date for boleto payment if settled
			const settled = updates.isSettled ?? currentState.isSettled;
			if (settled) {
				updates.boletoPaymentDate =
					currentState.boletoPaymentDate || getTodayDateString();
			}
		}
	}

	// When split is disabled, clear secondary pagador and split fields
	if (key === "isSplit" && value === false) {
		updates.secondaryPayerId = undefined;
		updates.splitShares = [];
		updates.primarySplitAmount = "";
		updates.secondarySplitAmount = "";
	}

	// When split is enabled and amount exists, calculate initial split amounts
	if (key === "isSplit" && value === true) {
		const totalAmount = Number.parseFloat(currentState.amount) || 0;
		if (totalAmount > 0) {
			updates.primarySplitAmount = totalAmount.toFixed(2);
			updates.secondarySplitAmount = "";
		}
	}

	// When amount changes and split is enabled, recalculate split amounts
	if (key === "amount" && typeof value === "string" && currentState.isSplit) {
		const totalAmount = Number.parseFloat(value) || 0;
		if (totalAmount > 0) {
			const otherTotal = currentState.splitShares.reduce(
				(total, share) => total + (Number.parseFloat(share.amount) || 0),
				0,
			);
			updates.primarySplitAmount = Math.max(
				0,
				totalAmount - otherTotal,
			).toFixed(2);
		} else {
			updates.primarySplitAmount = "";
			updates.splitShares = currentState.splitShares.map((share) => ({
				...share,
				amount: "",
			}));
		}
	}

	// When primary pagador changes, clear secondary if it matches
	if (key === "payerId" && typeof value === "string") {
		const secondaryValue = currentState.secondaryPayerId;
		if (secondaryValue && secondaryValue === value) {
			updates.secondaryPayerId = undefined;
		}
		if (currentState.splitShares.some((share) => share.payerId === value)) {
			const nextShares = currentState.splitShares.filter(
				(share) => share.payerId !== value,
			);
			updates.splitShares = nextShares;
			if (currentState.isSplit) {
				const totalAmount = Number.parseFloat(currentState.amount) || 0;
				const otherTotal = nextShares.reduce(
					(total, share) => total + (Number.parseFloat(share.amount) || 0),
					0,
				);
				updates.primarySplitAmount = Math.max(
					0,
					totalAmount - otherTotal,
				).toFixed(2);
			}
		}
	}

	// When isSettled changes and payment method is Boleto
	if (key === "isSettled" && currentState.paymentMethod === "Boleto") {
		if (value === true) {
			updates.boletoPaymentDate =
				currentState.boletoPaymentDate || getTodayDateString();
		} else if (value === false) {
			updates.boletoPaymentDate = "";
		}
	}

	return updates;
}
