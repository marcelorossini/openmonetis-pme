#!/usr/bin/env tsx

import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { and, eq, ne, sql } from "drizzle-orm";
import {
	budgets,
	cards,
	categories,
	financialAccounts,
	inboxItems,
	invoices,
	notes,
	payers,
	transactions,
	user,
} from "@/db/schema";
import { loadAvatarOptions } from "@/features/payers/lib/avatar-options";
import type { TransactionInsert } from "@/features/transactions/actions/core";
import type {
	PAYMENT_METHODS,
	TRANSACTION_CONDITIONS,
	TRANSACTION_TYPES,
} from "@/features/transactions/lib/constants";
import {
	buildInvoicePaymentNote,
	INITIAL_BALANCE_CATEGORY_NAME,
	INITIAL_BALANCE_CONDITION,
	INITIAL_BALANCE_NOTE,
	INITIAL_BALANCE_PAYMENT_METHOD,
	INITIAL_BALANCE_TRANSACTION_TYPE,
} from "@/shared/lib/accounts/constants";
import {
	DEFAULT_CARD_BRANDS,
	DEFAULT_CARD_STATUS,
} from "@/shared/lib/cards/constants";
import { buildDefaultCategoryValues } from "@/shared/lib/categories/defaults";
import { db } from "@/shared/lib/db";
import { INVOICE_PAYMENT_STATUS } from "@/shared/lib/invoices";
import { loadLogoOptions } from "@/shared/lib/logo/options";
import {
	DEFAULT_PAYER_AVATAR,
	PAYER_ROLE_ADMIN,
	PAYER_ROLE_THIRD_PARTY,
	PAYER_STATUS_OPTIONS,
} from "@/shared/lib/payers/constants";
import { generateShareCode } from "@/shared/lib/payers/share-code";
import { normalizeNameFromEmail } from "@/shared/lib/payers/utils";
import {
	TRANSFER_CATEGORY_NAME,
	TRANSFER_CONDITION,
	TRANSFER_ESTABLISHMENT_ENTRADA,
	TRANSFER_ESTABLISHMENT_SAIDA,
	TRANSFER_PAYMENT_METHOD,
} from "@/shared/lib/transfers/constants";
import {
	addMonthsToDate,
	buildDateOnlyStringFromPeriodDay,
	compareDateOnly,
	getBusinessTodayInfo,
	parseLocalDateString,
} from "@/shared/utils/date";
import {
	addMonthsToPeriod,
	comparePeriods,
	derivePeriodFromDate,
	getNextPeriod,
	parsePeriod,
} from "@/shared/utils/period";

config();

const DEFAULT_MONTHS = 6;
const MIN_MONTHS = 3;
const MAX_MONTHS = 24;

const ACCOUNT_TYPES = {
	CHECKING: "Conta Corrente",
	DIGITAL_WALLET: "Carteira Digital",
} as const;

const ACCOUNT_STATUS = {
	ACTIVE: "Ativa",
} as const;

const CARD_STATUS = DEFAULT_CARD_STATUS[0];
const CARD_BRANDS = {
	MASTERCARD: DEFAULT_CARD_BRANDS[1] ?? "Mastercard",
	VISA: DEFAULT_CARD_BRANDS[0] ?? "Visa",
} as const;

const PAYER_STATUS = PAYER_STATUS_OPTIONS[0];

type CliOptions = {
	userId: string;
	startPeriod: string;
	months: number;
};

type SeedTransactionInput = {
	name: string;
	amount: number;
	purchaseDate: string;
	transactionType: (typeof TRANSACTION_TYPES)[number];
	condition: (typeof TRANSACTION_CONDITIONS)[number];
	paymentMethod: (typeof PAYMENT_METHODS)[number];
	accountId?: string | null;
	cardId?: string | null;
	categoryId?: string | null;
	payerId?: string | null;
	secondaryPayerId?: string | null;
	isSplit?: boolean;
	primarySplitAmount?: number;
	secondarySplitAmount?: number;
	installmentCount?: number;
	recurrenceCount?: number;
	dueDate?: string | null;
	note?: string | null;
	settlementBehavior?: "auto" | "open" | "settled";
	cardMeta?: {
		closingDay: string;
		dueDay: string;
	};
};

type Share = {
	payerId: string | null;
	amountCents: number;
};

type SeedSummary = {
	payers: number;
	accounts: number;
	cards: number;
	notes: number;
	budgets: number;
	transactions: number;
	invoices: number;
	invoicePayments: number;
	inboxItems: number;
};

function printUsage() {
	console.log(`
Uso:
  pnpm mockup -- --userId=<id> --startPeriod=YYYY-MM [--months=${DEFAULT_MONTHS}]

Exemplos:
  pnpm mockup -- --userId=user_123 --startPeriod=2026-01
  pnpm mockup -- --userId=user_123 --startPeriod=2025-10 --months=8
`);
}

function parseArgs(argv: string[]): CliOptions {
	let userId = "";
	let startPeriod = "";
	let months = DEFAULT_MONTHS;

	for (const arg of argv) {
		if (arg === "--help" || arg === "-h") {
			printUsage();
			process.exit(0);
		}

		if (arg.startsWith("--userId=") || arg.startsWith("--user-id=")) {
			userId = arg.split("=")[1] ?? "";
			continue;
		}

		if (arg.startsWith("--startPeriod=") || arg.startsWith("--start-period=")) {
			startPeriod = arg.split("=")[1] ?? "";
			continue;
		}

		if (arg.startsWith("--months=")) {
			const rawValue = arg.split("=")[1] ?? "";
			months = Number.parseInt(rawValue, 10);
		}
	}

	if (!userId.trim()) {
		throw new Error("Informe o `--userId` do usuário que receberá os dados.");
	}

	if (!startPeriod.trim()) {
		throw new Error("Informe o `--startPeriod` no formato `YYYY-MM`.");
	}

	parsePeriod(startPeriod);

	if (Number.isNaN(months) || months < MIN_MONTHS || months > MAX_MONTHS) {
		throw new Error(
			`O parâmetro \`--months\` deve ficar entre ${MIN_MONTHS} e ${MAX_MONTHS}.`,
		);
	}

	return {
		userId: userId.trim(),
		startPeriod: startPeriod.trim(),
		months,
	};
}

function centsToDecimalString(value: number) {
	const decimal = value / 100;
	const formatted = decimal.toFixed(2);
	return Object.is(decimal, -0) ? "0.00" : formatted;
}

function splitAmount(totalCents: number, parts: number) {
	if (parts <= 0) {
		return [];
	}

	const base = Math.trunc(totalCents / parts);
	const remainder = totalCents % parts;

	return Array.from(
		{ length: parts },
		(_, index) => base + (index < remainder ? 1 : 0),
	);
}

function buildShares(input: SeedTransactionInput): Share[] {
	const totalCents = Math.round(Math.abs(input.amount) * 100);

	if (!input.isSplit) {
		return [{ payerId: input.payerId ?? null, amountCents: totalCents }];
	}

	if (!input.payerId || !input.secondaryPayerId) {
		throw new Error(`Divisão inválida para o lançamento "${input.name}".`);
	}

	if (
		input.primarySplitAmount !== undefined &&
		input.secondarySplitAmount !== undefined
	) {
		return [
			{
				payerId: input.payerId,
				amountCents: Math.round(input.primarySplitAmount * 100),
			},
			{
				payerId: input.secondaryPayerId,
				amountCents: Math.round(input.secondarySplitAmount * 100),
			},
		];
	}

	const [primaryAmount, secondaryAmount] = splitAmount(totalCents, 2);

	return [
		{ payerId: input.payerId, amountCents: primaryAmount ?? 0 },
		{
			payerId: input.secondaryPayerId,
			amountCents: secondaryAmount ?? 0,
		},
	];
}

function deriveCreditCardPeriod(
	purchaseDate: string,
	closingDay: string | null | undefined,
	dueDay?: string | null | undefined,
) {
	const basePeriod = derivePeriodFromDate(purchaseDate);
	if (!closingDay) return basePeriod;

	const closingDayNum = Number.parseInt(closingDay, 10);
	if (Number.isNaN(closingDayNum)) return basePeriod;

	const dayPart = purchaseDate.split("-")[2];
	const purchaseDayNum = Number.parseInt(dayPart ?? "1", 10);

	let period = basePeriod;

	if (purchaseDayNum >= closingDayNum) {
		period = getNextPeriod(period);
	}

	const dueDayNum = Number.parseInt(dueDay ?? "", 10);
	if (!Number.isNaN(dueDayNum) && dueDayNum < closingDayNum) {
		period = getNextPeriod(period);
	}

	return period;
}

function pickOption(options: string[], candidates: string[], fallback: string) {
	const normalizedOptions = new Set(options);

	for (const candidate of candidates) {
		if (normalizedOptions.has(candidate)) {
			return candidate;
		}
	}

	return options[0] ?? fallback;
}

function dateForPeriodDay(period: string, day: number) {
	const value = buildDateOnlyStringFromPeriodDay(period, day);
	if (!value) {
		throw new Error(`Não foi possível montar a data ${period}/${day}.`);
	}

	return value;
}

function resolveSeedSettlement(
	input: SeedTransactionInput,
	referenceDate: Date,
	todayDate: Date,
) {
	if (input.paymentMethod === "Cartão de crédito") {
		return null;
	}

	if (input.settlementBehavior === "settled") {
		return true;
	}

	if (input.settlementBehavior === "open") {
		return false;
	}

	return compareDateOnly(referenceDate, todayDate) <= 0;
}

function createTransactionRecords(
	input: SeedTransactionInput,
	userId: string,
	todayDate: Date,
): TransactionInsert[] {
	const purchaseDate = parseLocalDateString(input.purchaseDate);
	if (Number.isNaN(purchaseDate.getTime())) {
		throw new Error(`Data inválida no lançamento "${input.name}".`);
	}

	const dueDate = input.dueDate ? parseLocalDateString(input.dueDate) : null;
	const shares = buildShares(input);
	const amountSign: 1 | -1 = input.transactionType === "Despesa" ? -1 : 1;
	const isSeries =
		input.condition === "Parcelado" || input.condition === "Recorrente";
	const seriesId = isSeries ? randomUUID() : null;
	const initialPeriod =
		input.cardId && input.cardMeta
			? deriveCreditCardPeriod(
					input.purchaseDate,
					input.cardMeta.closingDay,
					input.cardMeta.dueDay,
				)
			: derivePeriodFromDate(input.purchaseDate);

	const basePayload = {
		name: input.name,
		transactionType: input.transactionType,
		condition: input.condition,
		paymentMethod: input.paymentMethod,
		note: input.note ?? null,
		accountId: input.accountId ?? null,
		cardId: input.cardId ?? null,
		categoryId: input.categoryId ?? null,
		isDivided: input.isSplit ?? false,
		userId,
		seriesId,
	};

	const records: TransactionInsert[] = [];

	if (input.condition === "Parcelado") {
		const installmentTotal = input.installmentCount ?? 0;
		const amountsByShare = shares.map((share) =>
			splitAmount(share.amountCents, installmentTotal),
		);

		for (
			let installmentIndex = 0;
			installmentIndex < installmentTotal;
			installmentIndex += 1
		) {
			const period = addMonthsToPeriod(initialPeriod, installmentIndex);
			const installmentDueDate = dueDate
				? addMonthsToDate(dueDate, installmentIndex)
				: null;
			const settlementReferenceDate =
				installmentDueDate ?? addMonthsToDate(purchaseDate, installmentIndex);

			shares.forEach((share, shareIndex) => {
				const amountCents = amountsByShare[shareIndex]?.[installmentIndex] ?? 0;
				const isSettled = resolveSeedSettlement(
					input,
					settlementReferenceDate,
					todayDate,
				);

				records.push({
					...basePayload,
					amount: centsToDecimalString(amountCents * amountSign),
					payerId: share.payerId,
					purchaseDate,
					period,
					isSettled,
					installmentCount: installmentTotal,
					currentInstallment: installmentIndex + 1,
					recurrenceCount: null,
					dueDate: installmentDueDate,
					boletoPaymentDate:
						input.paymentMethod === "Boleto" && isSettled
							? (installmentDueDate ?? settlementReferenceDate)
							: null,
				});
			});
		}

		return records;
	}

	if (input.condition === "Recorrente") {
		const recurrenceTotal = input.recurrenceCount ?? 0;

		for (let index = 0; index < recurrenceTotal; index += 1) {
			const period = addMonthsToPeriod(initialPeriod, index);
			const recurrencePurchaseDate = addMonthsToDate(purchaseDate, index);
			const recurrenceDueDate = dueDate
				? addMonthsToDate(dueDate, index)
				: null;
			const settlementReferenceDate =
				recurrenceDueDate ?? recurrencePurchaseDate;

			shares.forEach((share) => {
				const isSettled = resolveSeedSettlement(
					input,
					settlementReferenceDate,
					todayDate,
				);

				records.push({
					...basePayload,
					amount: centsToDecimalString(share.amountCents * amountSign),
					payerId: share.payerId,
					purchaseDate: recurrencePurchaseDate,
					period,
					isSettled,
					installmentCount: null,
					currentInstallment: null,
					recurrenceCount: recurrenceTotal,
					dueDate: recurrenceDueDate,
					boletoPaymentDate:
						input.paymentMethod === "Boleto" && isSettled
							? (recurrenceDueDate ?? recurrencePurchaseDate)
							: null,
				});
			});
		}

		return records;
	}

	shares.forEach((share) => {
		const settlementReferenceDate = dueDate ?? purchaseDate;
		const isSettled = resolveSeedSettlement(
			input,
			settlementReferenceDate,
			todayDate,
		);

		records.push({
			...basePayload,
			amount: centsToDecimalString(share.amountCents * amountSign),
			payerId: share.payerId,
			purchaseDate,
			period: initialPeriod,
			isSettled,
			installmentCount: null,
			currentInstallment: null,
			recurrenceCount: null,
			dueDate,
			boletoPaymentDate:
				input.paymentMethod === "Boleto" && isSettled
					? (dueDate ?? purchaseDate)
					: null,
		});
	});

	return records;
}

async function ensureCategories(userId: string) {
	const existing = await db.query.categories.findMany({
		columns: { id: true, name: true },
		where: eq(categories.userId, userId),
	});

	const existingNames = new Set(existing.map((item) => item.name));
	const missingDefaults = buildDefaultCategoryValues(userId).filter(
		(category) => !existingNames.has(category.name),
	);

	if (missingDefaults.length > 0) {
		await db.insert(categories).values(missingDefaults);
	}

	const refreshed = await db.query.categories.findMany({
		columns: { id: true, name: true },
		where: eq(categories.userId, userId),
	});

	return new Map(refreshed.map((category) => [category.name, category.id]));
}

async function ensureAdminPayer(targetUser: typeof user.$inferSelect) {
	const existingAdmin = await db.query.payers.findFirst({
		columns: { id: true, name: true },
		where: and(
			eq(payers.userId, targetUser.id),
			eq(payers.role, PAYER_ROLE_ADMIN),
		),
	});

	if (existingAdmin) {
		return existingAdmin;
	}

	const name =
		targetUser.name?.trim() ||
		normalizeNameFromEmail(targetUser.email) ||
		"Admin";

	const [created] = await db
		.insert(payers)
		.values({
			name,
			email: targetUser.email ?? null,
			avatarUrl: targetUser.image ?? DEFAULT_PAYER_AVATAR,
			status: PAYER_STATUS,
			note: null,
			role: PAYER_ROLE_ADMIN,
			isAutoSend: false,
			shareCode: generateShareCode(),
			userId: targetUser.id,
		})
		.returning({ id: payers.id, name: payers.name });

	if (!created) {
		throw new Error("Não foi possível criar o pagador admin do usuário.");
	}

	return created;
}

async function countByUserId(
	table:
		| typeof financialAccounts
		| typeof cards
		| typeof budgets
		| typeof notes
		| typeof invoices
		| typeof transactions
		| typeof inboxItems,
	userColumn:
		| typeof financialAccounts.userId
		| typeof cards.userId
		| typeof budgets.userId
		| typeof notes.userId
		| typeof invoices.userId
		| typeof transactions.userId
		| typeof inboxItems.userId,
	userId: string,
) {
	const [result] = await db
		.select({ count: sql<number>`count(*)` })
		.from(table)
		.where(eq(userColumn, userId));

	return Number(result?.count ?? 0);
}

async function assertFinancialSpaceIsEmpty(userId: string) {
	const [
		accountCount,
		cardCount,
		budgetCount,
		noteCount,
		invoiceCount,
		transactionCount,
		inboxCount,
		extraPayerCount,
	] = await Promise.all([
		countByUserId(financialAccounts, financialAccounts.userId, userId),
		countByUserId(cards, cards.userId, userId),
		countByUserId(budgets, budgets.userId, userId),
		countByUserId(notes, notes.userId, userId),
		countByUserId(invoices, invoices.userId, userId),
		countByUserId(transactions, transactions.userId, userId),
		countByUserId(inboxItems, inboxItems.userId, userId),
		db
			.select({ count: sql<number>`count(*)` })
			.from(payers)
			.where(and(eq(payers.userId, userId), ne(payers.role, PAYER_ROLE_ADMIN)))
			.then((rows) => Number(rows[0]?.count ?? 0)),
	]);

	const blockers = [
		accountCount > 0 ? `${accountCount} conta(s)` : null,
		cardCount > 0 ? `${cardCount} cartao(oes)` : null,
		transactionCount > 0 ? `${transactionCount} lancamento(s)` : null,
		invoiceCount > 0 ? `${invoiceCount} fatura(s)` : null,
		budgetCount > 0 ? `${budgetCount} orcamento(s)` : null,
		noteCount > 0 ? `${noteCount} anotacao(oes)` : null,
		extraPayerCount > 0 ? `${extraPayerCount} pagador(es) extra(s)` : null,
		inboxCount > 0 ? `${inboxCount} pre-lancamento(s)` : null,
	].filter(Boolean);

	if (blockers.length > 0) {
		throw new Error(
			`O usuário ${userId} não está com a conta zerada. Itens encontrados: ${blockers.join(", ")}.`,
		);
	}
}

async function seedInvoicesForCards(params: {
	userId: string;
	adminPayerId: string;
	cardsByKey: Record<
		string,
		{
			id: string;
			name: string;
			accountId: string;
			dueDay: string;
			closingDay: string;
		}
	>;
	paymentCategoryId: string | undefined;
	insertedTransactionRecords: TransactionInsert[];
}) {
	const { userId, adminPayerId, cardsByKey, paymentCategoryId } = params;
	const todayInfo = getBusinessTodayInfo();
	const cardEntries = Object.entries(cardsByKey);

	let createdInvoices = 0;
	let createdInvoicePayments = 0;

	await db.transaction(async (tx) => {
		for (const [cardKey, card] of cardEntries) {
			const cardPeriods = Array.from(
				new Set(
					params.insertedTransactionRecords
						.filter((record) => record.cardId === card.id)
						.map((record) => record.period ?? "")
						.filter(Boolean),
				),
			).sort(comparePeriods);

			const historicalPeriods = cardPeriods.filter(
				(period) => comparePeriods(period, todayInfo.period) <= 0,
			);

			if (historicalPeriods.length === 0) {
				continue;
			}

			const latestHistoricalPeriod =
				historicalPeriods[historicalPeriods.length - 1];

			for (const period of historicalPeriods) {
				const shouldLeavePending =
					cardKey === "ultravioleta" && period === latestHistoricalPeriod;
				const status = shouldLeavePending
					? INVOICE_PAYMENT_STATUS.PENDING
					: INVOICE_PAYMENT_STATUS.PAID;

				const existingInvoice = await tx.query.invoices.findFirst({
					columns: { id: true },
					where: and(
						eq(invoices.userId, userId),
						eq(invoices.cardId, card.id),
						eq(invoices.period, period),
					),
				});

				if (existingInvoice) {
					await tx
						.update(invoices)
						.set({
							paymentStatus: status,
						})
						.where(eq(invoices.id, existingInvoice.id));
				} else {
					await tx.insert(invoices).values({
						cardId: card.id,
						userId,
						period,
						paymentStatus: status,
					});
				}

				await tx
					.update(transactions)
					.set({
						isSettled: status === INVOICE_PAYMENT_STATUS.PAID,
					})
					.where(
						and(
							eq(transactions.userId, userId),
							eq(transactions.cardId, card.id),
							eq(transactions.period, period),
						),
					);

				createdInvoices += 1;

				if (status !== INVOICE_PAYMENT_STATUS.PAID) {
					continue;
				}

				const [adminShareRow] = await tx
					.select({
						total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
					})
					.from(transactions)
					.where(
						and(
							eq(transactions.userId, userId),
							eq(transactions.cardId, card.id),
							eq(transactions.period, period),
							eq(transactions.payerId, adminPayerId),
						),
					);

				const adminShare = Number(adminShareRow?.total ?? 0);
				const adminPayableAmount = Math.abs(Math.min(adminShare, 0));

				if (adminPayableAmount <= 0) {
					continue;
				}

				const paymentDate = dateForPeriodDay(period, Number(card.dueDay));
				const paymentNote = buildInvoicePaymentNote(card.id, period);

				await tx.insert(transactions).values({
					condition: "À vista",
					name: `Pagamento fatura - ${card.name}`,
					paymentMethod: "Pix",
					note: paymentNote,
					amount: `-${adminPayableAmount.toFixed(2)}`,
					purchaseDate: parseLocalDateString(paymentDate),
					transactionType: "Despesa",
					period,
					isSettled: true,
					userId,
					accountId: card.accountId,
					categoryId: paymentCategoryId ?? null,
					payerId: adminPayerId,
				});

				createdInvoicePayments += 1;
			}
		}
	});

	return {
		createdInvoices,
		createdInvoicePayments,
	};
}

async function main() {
	const options = parseArgs(process.argv.slice(2));

	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL não está configurada no ambiente.");
	}

	const logoOptions = await loadLogoOptions();
	const avatarOptions = await loadAvatarOptions();
	const businessToday = getBusinessTodayInfo();
	const summary: SeedSummary = {
		payers: 0,
		accounts: 0,
		cards: 0,
		notes: 0,
		budgets: 0,
		transactions: 0,
		invoices: 0,
		invoicePayments: 0,
		inboxItems: 0,
	};

	const targetUser = await db.query.user.findFirst({
		where: eq(user.id, options.userId),
	});

	if (!targetUser) {
		throw new Error(`Usuário ${options.userId} não foi encontrado.`);
	}

	await assertFinancialSpaceIsEmpty(targetUser.id);
	const adminPayer = await ensureAdminPayer(targetUser);

	const categoriesByName = await ensureCategories(targetUser.id);

	const getCategoryId = (name: string) => {
		const categoryId = categoriesByName.get(name);
		if (!categoryId) {
			throw new Error(`Categoria obrigatória não encontrada: ${name}.`);
		}
		return categoryId;
	};

	const periods = Array.from({ length: options.months }, (_, index) =>
		addMonthsToPeriod(options.startPeriod, index),
	);

	const firstPeriod = periods[0];
	const secondPeriod = periods[1] ?? periods[0];
	const thirdPeriod = periods[2] ?? periods[periods.length - 1] ?? periods[0];
	const middlePeriod = periods[Math.floor(periods.length / 2)] ?? periods[0];
	const lastPeriod = periods[periods.length - 1] ?? periods[0];
	const firstDayOfSeed = dateForPeriodDay(firstPeriod, 1);

	const preferredAvatar = (candidates: string[]) =>
		pickOption(avatarOptions, candidates, DEFAULT_PAYER_AVATAR);
	const preferredLogo = (candidates: string[], fallback: string) =>
		pickOption(logoOptions, candidates, fallback);

	const createdPayers: Record<string, string> = {
		admin: adminPayer.id,
	};
	const createdAccounts: Record<string, string> = {};
	const createdCards: Record<
		string,
		{
			id: string;
			name: string;
			accountId: string;
			closingDay: string;
			dueDay: string;
		}
	> = {};

	await db.transaction(async (tx) => {
		const extraPayerDefinitions = [
			{
				key: "mario",
				name: "Mario Oliveira",
				email: "mario.oliveira@exemplo.com",
				avatarUrl: preferredAvatar(["4825038.png", "4825051.png"]),
				note: "Divide as despesas da casa e do mercado.",
				isAutoSend: true,
			},
			{
				key: "eduardo",
				name: "Eduardo Lima",
				email: "eduardo.lima@exemplo.com",
				avatarUrl: preferredAvatar(["4825096.png", "4825123.png"]),
				note: "Costuma rachar viagens e presentes em familia.",
				isAutoSend: false,
			},
		] as const;

		for (const definition of extraPayerDefinitions) {
			const [created] = await tx
				.insert(payers)
				.values({
					name: definition.name,
					email: definition.email,
					avatarUrl: definition.avatarUrl,
					status: PAYER_STATUS,
					note: definition.note,
					role: PAYER_ROLE_THIRD_PARTY,
					isAutoSend: definition.isAutoSend,
					shareCode: generateShareCode(),
					userId: targetUser.id,
				})
				.returning({ id: payers.id });

			if (!created) {
				throw new Error(`Falha ao criar o pagador ${definition.name}.`);
			}

			createdPayers[definition.key] = created.id;
			summary.payers += 1;
		}

		const accountDefinitions = [
			{
				key: "itau",
				name: "Itaú Personnalité",
				accountType: ACCOUNT_TYPES.CHECKING,
				status: ACCOUNT_STATUS.ACTIVE,
				logo: preferredLogo(["itaupersonnalite.png", "itau.png"], "itau.png"),
				note: "Conta principal onde cai o salário e saem boletos e investimentos.",
				initialBalance: "8200.00",
			},
			{
				key: "nubank",
				name: "Nubank",
				accountType: ACCOUNT_TYPES.DIGITAL_WALLET,
				status: ACCOUNT_STATUS.ACTIVE,
				logo: preferredLogo(["nubank.png"], "nubank.png"),
				note: "Conta do dia a dia para mercado, transporte e despesas variáveis.",
				initialBalance: "5500.00",
			},
			{
				key: "inter",
				name: "Banco Inter",
				accountType: ACCOUNT_TYPES.CHECKING,
				status: ACCOUNT_STATUS.ACTIVE,
				logo: preferredLogo(["intermedium.png"], "intermedium.png"),
				note: "Conta usada para reserva de emergência e investimentos curtos.",
				initialBalance: "2300.00",
			},
			{
				key: "mercado-pago",
				name: "Mercado Pago",
				accountType: ACCOUNT_TYPES.DIGITAL_WALLET,
				status: ACCOUNT_STATUS.ACTIVE,
				logo: preferredLogo(["mercadopago.png"], "mercadopago.png"),
				note: "Carteira para corridas por aplicativo e pequenos pagamentos.",
				initialBalance: "480.00",
			},
		] as const;

		for (const definition of accountDefinitions) {
			const [created] = await tx
				.insert(financialAccounts)
				.values({
					name: definition.name,
					accountType: definition.accountType,
					status: definition.status,
					note: definition.note,
					logo: definition.logo,
					initialBalance: definition.initialBalance,
					excludeFromBalance: false,
					excludeInitialBalanceFromIncome: true,
					userId: targetUser.id,
				})
				.returning({ id: financialAccounts.id });

			if (!created) {
				throw new Error(`Falha ao criar a conta ${definition.name}.`);
			}

			createdAccounts[definition.key] = created.id;
			summary.accounts += 1;

			await tx.insert(transactions).values({
				condition: INITIAL_BALANCE_CONDITION,
				name: `Saldo inicial - ${definition.name}`,
				paymentMethod: INITIAL_BALANCE_PAYMENT_METHOD,
				note: INITIAL_BALANCE_NOTE,
				amount: definition.initialBalance,
				purchaseDate: parseLocalDateString(firstDayOfSeed),
				transactionType: INITIAL_BALANCE_TRANSACTION_TYPE,
				period: firstPeriod,
				isSettled: true,
				userId: targetUser.id,
				accountId: created.id,
				categoryId: getCategoryId(INITIAL_BALANCE_CATEGORY_NAME),
				payerId: adminPayer.id,
			});

			summary.transactions += 1;
		}

		const cardDefinitions = [
			{
				key: "ultravioleta",
				name: "Nubank Ultravioleta",
				brand: CARD_BRANDS.MASTERCARD,
				status: CARD_STATUS,
				closingDay: "25",
				dueDay: "03",
				note: "Cartão principal para assinaturas, delivery e compras parceladas.",
				limit: "18995.50",
				logo: preferredLogo(
					["nubank-ultravioleta.png", "nubank.png"],
					"nubank.png",
				),
				accountId: createdAccounts.nubank,
			},
			{
				key: "itaucard",
				name: "Itaucard Visa Infinite",
				brand: CARD_BRANDS.VISA,
				status: CARD_STATUS,
				closingDay: "15",
				dueDay: "22",
				note: "Cartão usado para compras grandes, eletrônicos e viagens.",
				limit: "30000.00",
				logo: preferredLogo(["itau.png"], "itau.png"),
				accountId: createdAccounts.itau,
			},
			{
				key: "interblack",
				name: "Inter Black",
				brand: CARD_BRANDS.MASTERCARD,
				status: CARD_STATUS,
				closingDay: "10",
				dueDay: "17",
				note: "Cartão complementar para mercado e farmácia com cashback.",
				limit: "15000.00",
				logo: preferredLogo(["intermedium.png"], "intermedium.png"),
				accountId: createdAccounts.inter,
			},
		] as const;

		for (const definition of cardDefinitions) {
			const [created] = await tx
				.insert(cards)
				.values({
					name: definition.name,
					brand: definition.brand,
					status: definition.status,
					closingDay: definition.closingDay,
					dueDay: definition.dueDay,
					note: definition.note,
					limit: definition.limit,
					logo: definition.logo,
					accountId: definition.accountId,
					userId: targetUser.id,
				})
				.returning({ id: cards.id });

			if (!created) {
				throw new Error(`Falha ao criar o cartao ${definition.name}.`);
			}

			createdCards[definition.key] = {
				id: created.id,
				name: definition.name,
				accountId: definition.accountId,
				closingDay: definition.closingDay,
				dueDay: definition.dueDay,
			};
			summary.cards += 1;
		}

		const noteDefinitions = [
			{
				title: "Planejar viagem para Disney",
				type: "nota" as const,
				description:
					"Separar passagens LATAM, hospedagem via Booking e ingressos. Meta: manter o pacote abaixo de R$ 18.000 dividido em 10x no Itaucard.",
				tasks: null,
				archived: false,
			},
			{
				title: "Pendências financeiras do mês",
				type: "tarefa" as const,
				description: null,
				tasks: JSON.stringify([
					{
						id: randomUUID(),
						text: "Revisar fatura do Itaucard antes do fechamento",
						completed: true,
					},
					{
						id: randomUUID(),
						text: "Migrar reserva de emergência para CDB do Inter",
						completed: false,
					},
					{
						id: randomUUID(),
						text: "Cancelar trial do HBO Max se não usar",
						completed: false,
					},
					{
						id: randomUUID(),
						text: "Pagar IPVA antes do vencimento",
						completed: false,
					},
				]),
				archived: false,
			},
			{
				title: "Renegociar plano Vivo Fibra",
				type: "nota" as const,
				description:
					"Comparar com Claro e TIM antes do reajuste anual. Verificar bônus de portabilidade e valor de instalação.",
				tasks: null,
				archived: false,
			},
			{
				title: "Compras Black Friday 2025",
				type: "tarefa" as const,
				description: null,
				tasks: JSON.stringify([
					{
						id: randomUUID(),
						text: "Comprar iPhone 16 Pro na Apple",
						completed: true,
					},
					{
						id: randomUUID(),
						text: "Smart TV Samsung 65 polegadas no Magazine Luiza",
						completed: true,
					},
					{
						id: randomUUID(),
						text: "Notebook Dell XPS na Amazon",
						completed: true,
					},
				]),
				archived: true,
			},
		] as const;

		await tx.insert(notes).values(
			noteDefinitions.map((noteItem) => ({
				title: noteItem.title,
				type: noteItem.type,
				description: noteItem.description,
				tasks: noteItem.tasks,
				archived: noteItem.archived,
				userId: targetUser.id,
			})),
		);
		summary.notes += noteDefinitions.length;

		const budgetDefinitions = [
			{ categoryName: "Software e SaaS", baseAmount: 1100 },
			{ categoryName: "Marketing e publicidade", baseAmount: 380 },
			{ categoryName: "Transporte e deslocamento", baseAmount: 700 },
			{ categoryName: "Aluguel e condomínio", baseAmount: 3600 },
			{ categoryName: "Capacitação e cursos", baseAmount: 450 },
			{ categoryName: "Assinaturas", baseAmount: 480 },
			{ categoryName: "Seguros", baseAmount: 750 },
			{ categoryName: "Alimentação de trabalho", baseAmount: 250 },
			{ categoryName: "Materiais de escritório", baseAmount: 350 },
		] as const;

		const budgetRows = periods.flatMap((period, index) =>
			budgetDefinitions.map((budgetItem) => ({
				amount: (budgetItem.baseAmount + index * 10).toFixed(2),
				period,
				userId: targetUser.id,
				categoryId: getCategoryId(budgetItem.categoryName),
			})),
		);

		await tx.insert(budgets).values(budgetRows);
		summary.budgets += budgetRows.length;
	});

	const seedTransactionRecords: TransactionInsert[] = [];

	const createRecords = (input: SeedTransactionInput) => {
		seedTransactionRecords.push(
			...createTransactionRecords(input, targetUser.id, businessToday.date),
		);
	};

	// ── Receitas recorrentes ──
	createRecords({
		name: "Globo",
		amount: 9500,
		purchaseDate: dateForPeriodDay(firstPeriod, 5),
		transactionType: "Receita",
		condition: "Recorrente",
		paymentMethod: "Transferência bancária",
		accountId: createdAccounts.itau,
		categoryId: getCategoryId("Mensalidades e contratos"),
		payerId: adminPayer.id,
		recurrenceCount: options.months,
		note: "Receita mensal recorrente de contratos de consultoria.",
	});

	// ── Despesas recorrentes (estrutura, utilidades e assinaturas) ──
	createRecords({
		name: "Regus",
		amount: 3200,
		purchaseDate: dateForPeriodDay(firstPeriod, 5),
		transactionType: "Despesa",
		condition: "Recorrente",
		paymentMethod: "Pix",
		accountId: createdAccounts.itau,
		categoryId: getCategoryId("Aluguel e condomínio"),
		payerId: adminPayer.id,
		secondaryPayerId: createdPayers.mario,
		isSplit: true,
		primarySplitAmount: 1600,
		secondarySplitAmount: 1600,
		recurrenceCount: options.months,
		dueDate: dateForPeriodDay(firstPeriod, 8),
		note: "Coworking mensal dividido com mario.",
	});

	createRecords({
		name: "Vivo Fibra",
		amount: 139.9,
		purchaseDate: dateForPeriodDay(firstPeriod, 2),
		transactionType: "Despesa",
		condition: "Recorrente",
		paymentMethod: "Boleto",
		accountId: createdAccounts.itau,
		categoryId: getCategoryId("Internet e telefonia"),
		payerId: adminPayer.id,
		recurrenceCount: options.months,
		dueDate: dateForPeriodDay(firstPeriod, 12),
		note: "Link principal do escritório.",
	});

	createRecords({
		name: "Vivo",
		amount: 79.9,
		purchaseDate: dateForPeriodDay(firstPeriod, 9),
		transactionType: "Despesa",
		condition: "Recorrente",
		paymentMethod: "Cartão de crédito",
		cardId: createdCards.ultravioleta.id,
		categoryId: getCategoryId("Internet e telefonia"),
		payerId: adminPayer.id,
		recurrenceCount: options.months,
		cardMeta: createdCards.ultravioleta,
		note: "Plano móvel corporativo.",
	});

	createRecords({
		name: "Enel",
		amount: 195.4,
		purchaseDate: dateForPeriodDay(firstPeriod, 3),
		transactionType: "Despesa",
		condition: "Recorrente",
		paymentMethod: "Boleto",
		accountId: createdAccounts.itau,
		categoryId: getCategoryId("Energia e água"),
		payerId: adminPayer.id,
		recurrenceCount: options.months,
		dueDate: dateForPeriodDay(firstPeriod, 18),
		note: "Conta mensal de energia.",
	});

	createRecords({
		name: "Sabesp",
		amount: 95.6,
		purchaseDate: dateForPeriodDay(firstPeriod, 4),
		transactionType: "Despesa",
		condition: "Recorrente",
		paymentMethod: "Boleto",
		accountId: createdAccounts.itau,
		categoryId: getCategoryId("Energia e água"),
		payerId: adminPayer.id,
		recurrenceCount: options.months,
		dueDate: dateForPeriodDay(firstPeriod, 20),
		note: "Conta mensal de água.",
	});

	createRecords({
		name: "Slack",
		amount: 55.9,
		purchaseDate: dateForPeriodDay(firstPeriod, 9),
		transactionType: "Despesa",
		condition: "Recorrente",
		paymentMethod: "Cartão de crédito",
		cardId: createdCards.ultravioleta.id,
		categoryId: getCategoryId("Assinaturas"),
		payerId: adminPayer.id,
		recurrenceCount: options.months,
		cardMeta: createdCards.ultravioleta,
		note: "Licença mensal do workspace.",
	});

	createRecords({
		name: "Google Workspace",
		amount: 34.9,
		purchaseDate: dateForPeriodDay(firstPeriod, 8),
		transactionType: "Despesa",
		condition: "Recorrente",
		paymentMethod: "Cartão de crédito",
		cardId: createdCards.ultravioleta.id,
		categoryId: getCategoryId("Assinaturas"),
		payerId: adminPayer.id,
		recurrenceCount: options.months,
		cardMeta: createdCards.ultravioleta,
		note: "Caixas de e-mail e drive da operação.",
	});

	createRecords({
		name: "Zoom",
		amount: 33.9,
		purchaseDate: dateForPeriodDay(firstPeriod, 12),
		transactionType: "Despesa",
		condition: "Recorrente",
		paymentMethod: "Cartão de crédito",
		cardId: createdCards.ultravioleta.id,
		categoryId: getCategoryId("Assinaturas"),
		payerId: adminPayer.id,
		recurrenceCount: options.months,
		cardMeta: createdCards.ultravioleta,
		note: "Licença de reuniões com clientes.",
	});

	createRecords({
		name: "Conta Azul",
		amount: 39.9,
		purchaseDate: dateForPeriodDay(firstPeriod, 14),
		transactionType: "Despesa",
		condition: "Recorrente",
		paymentMethod: "Cartão de crédito",
		cardId: createdCards.ultravioleta.id,
		categoryId: getCategoryId("Software e SaaS"),
		payerId: adminPayer.id,
		recurrenceCount: options.months,
		cardMeta: createdCards.ultravioleta,
		note: "Gestão financeira operacional.",
	});

	createRecords({
		name: "Canva",
		amount: 28.9,
		purchaseDate: dateForPeriodDay(firstPeriod, 7),
		transactionType: "Despesa",
		condition: "Recorrente",
		paymentMethod: "Cartão de crédito",
		cardId: createdCards.ultravioleta.id,
		categoryId: getCategoryId("Assinaturas"),
		payerId: adminPayer.id,
		recurrenceCount: options.months,
		cardMeta: createdCards.ultravioleta,
		note: "Assinatura para materiais comerciais.",
	});

	createRecords({
		name: "Amazon Prime",
		amount: 14.9,
		purchaseDate: dateForPeriodDay(firstPeriod, 10),
		transactionType: "Despesa",
		condition: "Recorrente",
		paymentMethod: "Cartão de crédito",
		cardId: createdCards.ultravioleta.id,
		categoryId: getCategoryId("Assinaturas"),
		payerId: adminPayer.id,
		recurrenceCount: options.months,
		cardMeta: createdCards.ultravioleta,
		note: "Assinatura logística e mídia.",
	});

	createRecords({
		name: "OpenAI",
		amount: 109.9,
		purchaseDate: dateForPeriodDay(firstPeriod, 13),
		transactionType: "Despesa",
		condition: "Recorrente",
		paymentMethod: "Cartão de crédito",
		cardId: createdCards.ultravioleta.id,
		categoryId: getCategoryId("Software e SaaS"),
		payerId: adminPayer.id,
		recurrenceCount: options.months,
		cardMeta: createdCards.ultravioleta,
		note: "Ferramenta de apoio à operação.",
	});

	createRecords({
		name: "Dropbox",
		amount: 14.9,
		purchaseDate: dateForPeriodDay(firstPeriod, 17),
		transactionType: "Despesa",
		condition: "Recorrente",
		paymentMethod: "Cartão de crédito",
		cardId: createdCards.ultravioleta.id,
		categoryId: getCategoryId("Assinaturas"),
		payerId: adminPayer.id,
		recurrenceCount: options.months,
		cardMeta: createdCards.ultravioleta,
		note: "Armazenamento de arquivos compartilhados.",
	});

	createRecords({
		name: "Notion",
		amount: 49.9,
		purchaseDate: dateForPeriodDay(firstPeriod, 19),
		transactionType: "Despesa",
		condition: "Recorrente",
		paymentMethod: "Cartão de crédito",
		cardId: createdCards.ultravioleta.id,
		categoryId: getCategoryId("Software e SaaS"),
		payerId: adminPayer.id,
		recurrenceCount: options.months,
		cardMeta: createdCards.ultravioleta,
		note: "Base de conhecimento e projetos.",
	});

	createRecords({
		name: "Omie Academy",
		amount: 129.9,
		purchaseDate: dateForPeriodDay(firstPeriod, 11),
		transactionType: "Despesa",
		condition: "Recorrente",
		paymentMethod: "Cartão de crédito",
		cardId: createdCards.ultravioleta.id,
		categoryId: getCategoryId("Capacitação e cursos"),
		payerId: adminPayer.id,
		recurrenceCount: options.months,
		cardMeta: createdCards.ultravioleta,
		note: "Treinamento mensal da equipe.",
	});

	createRecords({
		name: "SulAmérica",
		amount: 489,
		purchaseDate: dateForPeriodDay(firstPeriod, 4),
		transactionType: "Despesa",
		condition: "Recorrente",
		paymentMethod: "Boleto",
		accountId: createdAccounts.itau,
		categoryId: getCategoryId("Seguros"),
		payerId: adminPayer.id,
		recurrenceCount: options.months,
		dueDate: dateForPeriodDay(firstPeriod, 10),
		note: "Seguro empresarial com assistência.",
	});

	createRecords({
		name: "Porto Seguro",
		amount: 285,
		purchaseDate: dateForPeriodDay(firstPeriod, 6),
		transactionType: "Despesa",
		condition: "Recorrente",
		paymentMethod: "Boleto",
		accountId: createdAccounts.itau,
		categoryId: getCategoryId("Seguros"),
		payerId: adminPayer.id,
		recurrenceCount: options.months,
		dueDate: dateForPeriodDay(firstPeriod, 15),
		note: "Seguro de responsabilidade operacional.",
	});

	createRecords({
		name: "Condomínio Regus",
		amount: 720,
		purchaseDate: dateForPeriodDay(firstPeriod, 1),
		transactionType: "Despesa",
		condition: "Recorrente",
		paymentMethod: "Pix",
		accountId: createdAccounts.itau,
		categoryId: getCategoryId("Aluguel e condomínio"),
		payerId: adminPayer.id,
		recurrenceCount: options.months,
		dueDate: dateForPeriodDay(firstPeriod, 10),
		note: "Taxa condominial do coworking.",
	});

	// ── Despesas e receitas variáveis (loop mensal) ──
	for (const [index, period] of periods.entries()) {
		const carrefourAmount = 580 + index * 24.5;
		const paoAcucarAmount = 360 + index * 18.2;
		const assaiAmount = 420 + index * 22;
		const uberAmount = 165 + index * 8.4;
		const noventaENoveAmount = 78 + index * 5.6;
		const shellAmount = 280 + index * 12.5;
		const ipirangaAmount = 195 + index * 9.8;
		const ifoodAmount = 142 + index * 8.7;
		const rappiAmount = 88 + index * 6.2;
		const mcdonaldsAmount = 52 + index * 4.1;
		const starbucksAmount = 78 + index * 5.3;
		const burgerKingAmount = 48 + index * 3.6;
		const drogasilAmount = 96 + index * 7.4;
		const raiaAmount = 72 + index * 5.8;
		const investmentYield = 84 + index * 6.4;

		// Software e SaaS — estoura o orçamento
		createRecords({
			name: "AWS",
			amount: carrefourAmount,
			purchaseDate: dateForPeriodDay(period, 6),
			transactionType: "Despesa",
			condition: "À vista",
			paymentMethod: "Pix",
			accountId: createdAccounts.nubank,
			categoryId: getCategoryId("Software e SaaS"),
			payerId: adminPayer.id,
			secondaryPayerId: createdPayers.mario,
			isSplit: true,
			primarySplitAmount: carrefourAmount / 2,
			secondarySplitAmount: carrefourAmount / 2,
			note: "Infraestrutura em nuvem dividida com mario.",
		});

		createRecords({
			name: "OpenRouter",
			amount: paoAcucarAmount,
			purchaseDate: dateForPeriodDay(period, 13),
			transactionType: "Despesa",
			condition: "À vista",
			paymentMethod: "Cartão de crédito",
			cardId: createdCards.interblack.id,
			categoryId: getCategoryId("Software e SaaS"),
			payerId: adminPayer.id,
			cardMeta: createdCards.interblack,
			note: "Consumo complementar de APIs.",
		});

		createRecords({
			name: "Vercel",
			amount: assaiAmount,
			purchaseDate: dateForPeriodDay(period, 22),
			transactionType: "Despesa",
			condition: "À vista",
			paymentMethod: "Cartão de crédito",
			cardId: createdCards.interblack.id,
			categoryId: getCategoryId("Software e SaaS"),
			payerId: adminPayer.id,
			cardMeta: createdCards.interblack,
			note: "Hospedagem e bandwidth do mês.",
		});

		// Transporte e deslocamento
		createRecords({
			name: "Uber",
			amount: uberAmount,
			purchaseDate: dateForPeriodDay(period, 14),
			transactionType: "Despesa",
			condition: "À vista",
			paymentMethod: "Pix",
			accountId: createdAccounts["mercado-pago"],
			categoryId: getCategoryId("Transporte e deslocamento"),
			payerId: adminPayer.id,
			note: "Corridas do dia a dia.",
		});

		createRecords({
			name: "99",
			amount: noventaENoveAmount,
			purchaseDate: dateForPeriodDay(period, 19),
			transactionType: "Despesa",
			condition: "À vista",
			paymentMethod: "Pix",
			accountId: createdAccounts["mercado-pago"],
			categoryId: getCategoryId("Transporte e deslocamento"),
			payerId: adminPayer.id,
			note: "Corridas e idas ao aeroporto.",
		});

		createRecords({
			name: "Shell",
			amount: shellAmount,
			purchaseDate: dateForPeriodDay(period, 9),
			transactionType: "Despesa",
			condition: "À vista",
			paymentMethod: "Cartão de débito",
			accountId: createdAccounts.itau,
			categoryId: getCategoryId("Transporte e deslocamento"),
			payerId: adminPayer.id,
			note: "Abastecimento principal do mês.",
		});

		createRecords({
			name: "Ipiranga",
			amount: ipirangaAmount,
			purchaseDate: dateForPeriodDay(period, 23),
			transactionType: "Despesa",
			condition: "À vista",
			paymentMethod: "Cartão de débito",
			accountId: createdAccounts.itau,
			categoryId: getCategoryId("Transporte e deslocamento"),
			payerId: adminPayer.id,
			note: "Reabastecimento de fim de mês.",
		});

		// Alimentação de trabalho
		createRecords({
			name: "iFood",
			amount: ifoodAmount,
			purchaseDate: dateForPeriodDay(period, 20),
			transactionType: "Despesa",
			condition: "À vista",
			paymentMethod: "Cartão de crédito",
			cardId: createdCards.ultravioleta.id,
			categoryId: getCategoryId("Alimentação de trabalho"),
			payerId: adminPayer.id,
			cardMeta: createdCards.ultravioleta,
			note: "Refeição em dia de fechamento.",
		});

		createRecords({
			name: "Rappi",
			amount: rappiAmount,
			purchaseDate: dateForPeriodDay(period, 27),
			transactionType: "Despesa",
			condition: "À vista",
			paymentMethod: "Cartão de crédito",
			cardId: createdCards.ultravioleta.id,
			categoryId: getCategoryId("Alimentação de trabalho"),
			payerId: adminPayer.id,
			cardMeta: createdCards.ultravioleta,
			note: "Reunião externa com cliente.",
		});

		// Marketing e publicidade — estoura o orçamento
		createRecords({
			name: "Meta Ads",
			amount: mcdonaldsAmount,
			purchaseDate: dateForPeriodDay(period, 16),
			transactionType: "Despesa",
			condition: "À vista",
			paymentMethod: "Pré-Pago | VR/VA",
			accountId: createdAccounts["mercado-pago"],
			categoryId: getCategoryId("Marketing e publicidade"),
			payerId: adminPayer.id,
			note: "Campanha always-on de aquisição.",
		});

		createRecords({
			name: "Google Ads",
			amount: starbucksAmount,
			purchaseDate: dateForPeriodDay(period, 11),
			transactionType: "Despesa",
			condition: "À vista",
			paymentMethod: "Cartão de crédito",
			cardId: createdCards.ultravioleta.id,
			categoryId: getCategoryId("Marketing e publicidade"),
			payerId: adminPayer.id,
			cardMeta: createdCards.ultravioleta,
			note: "Busca paga para geração de demanda.",
		});

		createRecords({
			name: "LinkedIn Ads",
			amount: burgerKingAmount,
			purchaseDate: dateForPeriodDay(period, 24),
			transactionType: "Despesa",
			condition: "À vista",
			paymentMethod: "Pré-Pago | VR/VA",
			accountId: createdAccounts["mercado-pago"],
			categoryId: getCategoryId("Marketing e publicidade"),
			payerId: adminPayer.id,
			note: "Impulsionamento de conteúdo B2B.",
		});

		// Capacitação e cursos
		createRecords({
			name: "Alura",
			amount: drogasilAmount,
			purchaseDate: dateForPeriodDay(period, 12),
			transactionType: "Despesa",
			condition: "À vista",
			paymentMethod: "Cartão de débito",
			accountId: createdAccounts.nubank,
			categoryId: getCategoryId("Capacitação e cursos"),
			payerId: adminPayer.id,
			note: "Trilha técnica da equipe.",
		});

		createRecords({
			name: "Udemy",
			amount: raiaAmount,
			purchaseDate: dateForPeriodDay(period, 26),
			transactionType: "Despesa",
			condition: "À vista",
			paymentMethod: "Cartão de débito",
			accountId: createdAccounts.nubank,
			categoryId: getCategoryId("Capacitação e cursos"),
			payerId: adminPayer.id,
			note: "Cursos complementares e reciclagem.",
		});

		// Investimentos (rendimento)
		createRecords({
			name: "XP Investimentos",
			amount: investmentYield,
			purchaseDate: dateForPeriodDay(period, 27),
			transactionType: "Receita",
			condition: "À vista",
			paymentMethod: "Transferência bancária",
			accountId: createdAccounts.inter,
			categoryId: getCategoryId("Investimentos"),
			payerId: adminPayer.id,
			note: "Rendimento líquido do CDB.",
		});

		// Esporádicos por paridade do mês
		if (index % 2 === 0) {
			createRecords({
				name: "Amazon",
				amount: 168 + index * 12.8,
				purchaseDate: dateForPeriodDay(period, 18),
				transactionType: "Despesa",
				condition: "À vista",
				paymentMethod: "Cartão de crédito",
				cardId: createdCards.itaucard.id,
				categoryId: getCategoryId("Equipamentos e informática"),
				payerId: adminPayer.id,
				cardMeta: createdCards.itaucard,
				note: "Periféricos e acessórios do escritório.",
			});
		}

		if (index % 2 === 0) {
			createRecords({
				name: "Mercado Livre",
				amount: 134 + index * 11.4,
				purchaseDate: dateForPeriodDay(period, 25),
				transactionType: "Despesa",
				condition: "À vista",
				paymentMethod: "Cartão de crédito",
				cardId: createdCards.itaucard.id,
				categoryId: getCategoryId("Materiais de escritório"),
				payerId: adminPayer.id,
				cardMeta: createdCards.itaucard,
				note: "Reposição avulsa de insumos.",
			});
		}

		if (index % 2 === 1) {
			createRecords({
				name: "Stone",
				amount: 1850 + index * 140,
				purchaseDate: dateForPeriodDay(period, 24),
				transactionType: "Receita",
				condition: "À vista",
				paymentMethod: "Pix",
				accountId: createdAccounts.itau,
				categoryId: getCategoryId("Serviços Prestados"),
				payerId: adminPayer.id,
				note: "Projeto freelance de consultoria.",
			});
		}

		if (index % 3 === 0) {
			createRecords({
				name: "Outback",
				amount: 248 + index * 11.2,
				purchaseDate: dateForPeriodDay(period, 21),
				transactionType: "Despesa",
				condition: "À vista",
				paymentMethod: "Cartão de crédito",
				cardId: createdCards.itaucard.id,
				categoryId: getCategoryId("Serviços terceirizados"),
				payerId: adminPayer.id,
				cardMeta: createdCards.itaucard,
				note: "Designer parceiro para campanha.",
			});
		}

		if (index % 3 === 1) {
			createRecords({
				name: "Madero",
				amount: 198 + index * 9.5,
				purchaseDate: dateForPeriodDay(period, 17),
				transactionType: "Despesa",
				condition: "À vista",
				paymentMethod: "Cartão de crédito",
				cardId: createdCards.itaucard.id,
				categoryId: getCategoryId("Serviços terceirizados"),
				payerId: adminPayer.id,
				cardMeta: createdCards.itaucard,
				note: "Edição de vídeo terceirizada.",
			});
		}

		if (index % 2 === 0) {
			createRecords({
				name: "RD Station",
				amount: 142 + index * 8.5,
				purchaseDate: dateForPeriodDay(period, 21),
				transactionType: "Despesa",
				condition: "À vista",
				paymentMethod: "Cartão de crédito",
				cardId: createdCards.itaucard.id,
				categoryId: getCategoryId("Marketing e publicidade"),
				payerId: adminPayer.id,
				cardMeta: createdCards.itaucard,
				note: "Automação de nutrição e CRM.",
			});
		}
	}

	// ── Parcelados grandes ──
	createRecords({
		name: "Apple",
		amount: 9999,
		purchaseDate: dateForPeriodDay(firstPeriod, 14),
		transactionType: "Despesa",
		condition: "Parcelado",
		paymentMethod: "Cartão de crédito",
		cardId: createdCards.itaucard.id,
		categoryId: getCategoryId("Equipamentos e informática"),
		payerId: adminPayer.id,
		installmentCount: 12,
		cardMeta: createdCards.itaucard,
		note: "Notebook principal da operação em 12x.",
	});

	createRecords({
		name: "Samsung",
		amount: 5499,
		purchaseDate: dateForPeriodDay(firstPeriod, 26),
		transactionType: "Despesa",
		condition: "Parcelado",
		paymentMethod: "Cartão de crédito",
		cardId: createdCards.itaucard.id,
		categoryId: getCategoryId("Equipamentos e informática"),
		payerId: adminPayer.id,
		installmentCount: 10,
		cardMeta: createdCards.itaucard,
		note: "Monitor ultrawide para produtividade.",
	});

	createRecords({
		name: "Dell",
		amount: 7999.2,
		purchaseDate: dateForPeriodDay(secondPeriod, 18),
		transactionType: "Despesa",
		condition: "Parcelado",
		paymentMethod: "Cartão de crédito",
		cardId: createdCards.itaucard.id,
		categoryId: getCategoryId("Equipamentos e informática"),
		payerId: adminPayer.id,
		installmentCount: 10,
		cardMeta: createdCards.itaucard,
		note: "Estação de trabalho adicional.",
	});

	createRecords({
		name: "Magazine Luiza",
		amount: 2299.5,
		purchaseDate: dateForPeriodDay(thirdPeriod, 7),
		transactionType: "Despesa",
		condition: "Parcelado",
		paymentMethod: "Cartão de crédito",
		cardId: createdCards.itaucard.id,
		categoryId: getCategoryId("Materiais de escritório"),
		payerId: adminPayer.id,
		installmentCount: 5,
		cardMeta: createdCards.itaucard,
		note: "Mobiliário para a sala de reuniões.",
	});

	createRecords({
		name: "LATAM",
		amount: 4280.5,
		purchaseDate: dateForPeriodDay(thirdPeriod, 16),
		transactionType: "Despesa",
		condition: "Parcelado",
		paymentMethod: "Cartão de crédito",
		cardId: createdCards.ultravioleta.id,
		categoryId: getCategoryId("Viagens e hospedagem"),
		payerId: adminPayer.id,
		secondaryPayerId: createdPayers.eduardo,
		isSplit: true,
		primarySplitAmount: 2140.25,
		secondarySplitAmount: 2140.25,
		installmentCount: 6,
		cardMeta: createdCards.ultravioleta,
		note: "Passagens para Salvador, divididas com Eduardo.",
	});

	createRecords({
		name: "Booking",
		amount: 3690,
		purchaseDate: dateForPeriodDay(thirdPeriod, 17),
		transactionType: "Despesa",
		condition: "Parcelado",
		paymentMethod: "Cartão de crédito",
		cardId: createdCards.ultravioleta.id,
		categoryId: getCategoryId("Viagens e hospedagem"),
		payerId: adminPayer.id,
		installmentCount: 6,
		cardMeta: createdCards.ultravioleta,
		note: "Hospedagem da viagem.",
	});

	// ── Compras avulsas (à vista) ──
	createRecords({
		name: "Apple",
		amount: 4299,
		purchaseDate: dateForPeriodDay(secondPeriod, 5),
		transactionType: "Despesa",
		condition: "À vista",
		paymentMethod: "Cartão de crédito",
		cardId: createdCards.ultravioleta.id,
		categoryId: getCategoryId("Equipamentos e informática"),
		payerId: adminPayer.id,
		cardMeta: createdCards.ultravioleta,
		note: "Headset premium para calls.",
	});

	createRecords({
		name: "Kalunga",
		amount: 689.8,
		purchaseDate: dateForPeriodDay(middlePeriod, 17),
		transactionType: "Despesa",
		condition: "À vista",
		paymentMethod: "Cartão de crédito",
		cardId: createdCards.ultravioleta.id,
		categoryId: getCategoryId("Materiais de escritório"),
		payerId: adminPayer.id,
		cardMeta: createdCards.ultravioleta,
		note: "Cadernos, blocos e suprimentos.",
	});

	createRecords({
		name: "Amazon Business",
		amount: 412.5,
		purchaseDate: dateForPeriodDay(thirdPeriod, 9),
		transactionType: "Despesa",
		condition: "À vista",
		paymentMethod: "Cartão de crédito",
		cardId: createdCards.ultravioleta.id,
		categoryId: getCategoryId("Materiais de escritório"),
		payerId: adminPayer.id,
		cardMeta: createdCards.ultravioleta,
		note: "Reposição de periféricos e cabos.",
	});

	createRecords({
		name: "Logitech",
		amount: 899.9,
		purchaseDate: dateForPeriodDay(firstPeriod, 23),
		transactionType: "Despesa",
		condition: "À vista",
		paymentMethod: "Cartão de crédito",
		cardId: createdCards.ultravioleta.id,
		categoryId: getCategoryId("Equipamentos e informática"),
		payerId: adminPayer.id,
		cardMeta: createdCards.ultravioleta,
		note: "Mouse e teclado sem fio.",
	});

	// ── Cursos, brindes e apoio comercial ──
	createRecords({
		name: "Alura",
		amount: 1499.9,
		purchaseDate: dateForPeriodDay(firstPeriod, 20),
		transactionType: "Despesa",
		condition: "À vista",
		paymentMethod: "Cartão de crédito",
		cardId: createdCards.ultravioleta.id,
		categoryId: getCategoryId("Capacitação e cursos"),
		payerId: adminPayer.id,
		cardMeta: createdCards.ultravioleta,
		note: "Plano anual de desenvolvimento.",
	});

	createRecords({
		name: "Printi",
		amount: 189,
		purchaseDate: dateForPeriodDay(thirdPeriod, 11),
		transactionType: "Despesa",
		condition: "À vista",
		paymentMethod: "Pix",
		accountId: createdAccounts.nubank,
		categoryId: getCategoryId("Marketing e publicidade"),
		payerId: adminPayer.id,
		note: "Brindes e materiais promocionais.",
	});

	createRecords({
		name: "Freela Motion",
		amount: 480,
		purchaseDate: dateForPeriodDay(middlePeriod, 8),
		transactionType: "Despesa",
		condition: "Parcelado",
		paymentMethod: "Cartão de crédito",
		cardId: createdCards.ultravioleta.id,
		categoryId: getCategoryId("Serviços terceirizados"),
		payerId: adminPayer.id,
		secondaryPayerId: createdPayers.mario,
		isSplit: true,
		primarySplitAmount: 240,
		secondarySplitAmount: 240,
		installmentCount: 3,
		cardMeta: createdCards.ultravioleta,
		note: "Animação curta para campanha, dividida com mario.",
	});

	// ── Seguros e reembolsos ──
	createRecords({
		name: "Porto Seguro Saúde",
		amount: 320,
		purchaseDate: dateForPeriodDay(middlePeriod, 9),
		transactionType: "Despesa",
		condition: "À vista",
		paymentMethod: "Boleto",
		accountId: createdAccounts.itau,
		categoryId: getCategoryId("Seguros"),
		payerId: adminPayer.id,
		dueDate: dateForPeriodDay(middlePeriod, 17),
		note: "Franquia complementar do seguro empresarial.",
	});

	createRecords({
		name: "Amil",
		amount: 218.5,
		purchaseDate: dateForPeriodDay(secondPeriod, 26),
		transactionType: "Receita",
		condition: "À vista",
		paymentMethod: "Pix",
		accountId: createdAccounts.itau,
		categoryId: getCategoryId("Reembolso"),
		payerId: adminPayer.id,
		note: "Reembolso de consulta médica.",
	});

	// ── Boleto em aberto (testa lembretes) ──
	createRecords({
		name: "Detran",
		amount: 1284.32,
		purchaseDate: dateForPeriodDay(lastPeriod, 10),
		transactionType: "Despesa",
		condition: "À vista",
		paymentMethod: "Boleto",
		accountId: createdAccounts.itau,
		categoryId: getCategoryId("Impostos e taxas"),
		payerId: adminPayer.id,
		dueDate: dateForPeriodDay(lastPeriod, 25),
		note: "Taxa anual em aberto.",
		settlementBehavior: "open",
	});

	// ── Estouro do Inter Black no último mês (testa barra destructive) ──
	createRecords({
		name: "Magazine Luiza",
		amount: 2199,
		purchaseDate: dateForPeriodDay(lastPeriod, 4),
		transactionType: "Despesa",
		condition: "À vista",
		paymentMethod: "Cartão de crédito",
		cardId: createdCards.interblack.id,
		categoryId: getCategoryId("Equipamentos e informática"),
		payerId: adminPayer.id,
		cardMeta: createdCards.interblack,
		note: "Compra acima da média para expansão do setup.",
	});

	// ── Transferências internas entre contas ──
	const transferCategoryId = getCategoryId(TRANSFER_CATEGORY_NAME);

	const pushTransfer = (params: {
		fromAccountId: string;
		toAccountId: string;
		amount: number;
		date: string;
		fromAccountName: string;
		toAccountName: string;
	}) => {
		const transferId = randomUUID();
		const period = derivePeriodFromDate(params.date);
		const purchaseDate = parseLocalDateString(params.date);
		const note = `de ${params.fromAccountName} -> ${params.toAccountName}`;
		const sharedFields = {
			condition: TRANSFER_CONDITION,
			paymentMethod: TRANSFER_PAYMENT_METHOD,
			note,
			purchaseDate,
			transactionType: "Transferência" as const,
			period,
			isSettled: true,
			userId: targetUser.id,
			categoryId: transferCategoryId,
			payerId: adminPayer.id,
			transferId,
		};

		seedTransactionRecords.push({
			...sharedFields,
			name: TRANSFER_ESTABLISHMENT_SAIDA,
			amount: `-${params.amount.toFixed(2)}`,
			accountId: params.fromAccountId,
		});
		seedTransactionRecords.push({
			...sharedFields,
			name: TRANSFER_ESTABLISHMENT_ENTRADA,
			amount: params.amount.toFixed(2),
			accountId: params.toAccountId,
		});
	};

	// Repasse mensal do salário (Itaú → Nubank) para o dia a dia
	for (const period of periods) {
		pushTransfer({
			fromAccountId: createdAccounts.itau,
			toAccountId: createdAccounts.nubank,
			amount: 4000,
			date: dateForPeriodDay(period, 6),
			fromAccountName: "Itaú Personnalité",
			toAccountName: "Nubank",
		});
	}

	// Reserva de emergência no Inter (eventual)
	pushTransfer({
		fromAccountId: createdAccounts.itau,
		toAccountId: createdAccounts.inter,
		amount: 1500,
		date: dateForPeriodDay(secondPeriod, 12),
		fromAccountName: "Itaú Personnalité",
		toAccountName: "Banco Inter",
	});

	pushTransfer({
		fromAccountId: createdAccounts.itau,
		toAccountId: createdAccounts.inter,
		amount: 2000,
		date: dateForPeriodDay(middlePeriod, 14),
		fromAccountName: "Itaú Personnalité",
		toAccountName: "Banco Inter",
	});

	// Recargas pontuais para o Mercado Pago
	pushTransfer({
		fromAccountId: createdAccounts.nubank,
		toAccountId: createdAccounts["mercado-pago"],
		amount: 250,
		date: dateForPeriodDay(firstPeriod, 18),
		fromAccountName: "Nubank",
		toAccountName: "Mercado Pago",
	});

	pushTransfer({
		fromAccountId: createdAccounts.nubank,
		toAccountId: createdAccounts["mercado-pago"],
		amount: 180,
		date: dateForPeriodDay(thirdPeriod, 14),
		fromAccountName: "Nubank",
		toAccountName: "Mercado Pago",
	});

	await db.insert(transactions).values(seedTransactionRecords);
	summary.transactions += seedTransactionRecords.length;

	const { createdInvoices, createdInvoicePayments } =
		await seedInvoicesForCards({
			userId: targetUser.id,
			adminPayerId: adminPayer.id,
			cardsByKey: createdCards,
			paymentCategoryId: categoriesByName.get("Pagamentos"),
			insertedTransactionRecords: seedTransactionRecords,
		});

	summary.invoices += createdInvoices;
	summary.invoicePayments += createdInvoicePayments;
	summary.transactions += createdInvoicePayments;

	const inboxItemsData = [
		{
			userId: targetUser.id,
			sourceApp: "com.nu.production",
			sourceAppName: "Nubank",
			originalTitle: "Compra aprovada",
			originalText:
				"Compra de R$ 142,80 aprovada no cartão Ultravioleta em IFOOD*IFOOD",
			notificationTimestamp: parseLocalDateString(
				dateForPeriodDay(lastPeriod, 3),
			),
			parsedName: "iFood",
			parsedAmount: "142.80",
			status: "pending" as const,
			transactionId: null,
			processedAt: null,
			discardedAt: null,
		},
		{
			userId: targetUser.id,
			sourceApp: "com.nu.production",
			sourceAppName: "Nubank",
			originalTitle: "Pix enviado",
			originalText: "Você enviou R$ 320,00 via Pix para mario Oliveira.",
			notificationTimestamp: parseLocalDateString(
				dateForPeriodDay(lastPeriod, 5),
			),
			parsedName: "mario Oliveira",
			parsedAmount: "320.00",
			status: "pending" as const,
			transactionId: null,
			processedAt: null,
			discardedAt: null,
		},
		{
			userId: targetUser.id,
			sourceApp: "br.com.itau.personnalite",
			sourceAppName: "Itaú Personnalité",
			originalTitle: "Débito em conta",
			originalText: "Débito de R$ 78,90 realizado. STARBUCKS COFFEE",
			notificationTimestamp: parseLocalDateString(
				dateForPeriodDay(lastPeriod, 7),
			),
			parsedName: "Starbucks",
			parsedAmount: "78.90",
			status: "pending" as const,
			transactionId: null,
			processedAt: null,
			discardedAt: null,
		},
		{
			userId: targetUser.id,
			sourceApp: "br.com.itau.personnalite",
			sourceAppName: "Itaú Personnalité",
			originalTitle: "Compra aprovada",
			originalText:
				"Compra de R$ 487,40 aprovada no cartão Itaucard em AMAZON BR. Limite disponível: R$ 1.512,60",
			notificationTimestamp: parseLocalDateString(
				dateForPeriodDay(lastPeriod, 10),
			),
			parsedName: "Amazon",
			parsedAmount: "487.40",
			status: "pending" as const,
			transactionId: null,
			processedAt: null,
			discardedAt: null,
		},
		{
			userId: targetUser.id,
			sourceApp: "com.mercadopago.wallet",
			sourceAppName: "Mercado Pago",
			originalTitle: null,
			originalText: "Pagamento de R$ 38,50 aprovado em UBER*TRIP",
			notificationTimestamp: parseLocalDateString(
				dateForPeriodDay(lastPeriod, 13),
			),
			parsedName: "Uber",
			parsedAmount: "38.50",
			status: "pending" as const,
			transactionId: null,
			processedAt: null,
			discardedAt: null,
		},
		{
			userId: targetUser.id,
			sourceApp: "com.nu.production",
			sourceAppName: "Nubank",
			originalTitle: "Compra aprovada",
			originalText:
				"Compra de R$ 224,90 aprovada no cartão Ultravioleta em SHOPEE*SHOPEE BR",
			notificationTimestamp: parseLocalDateString(
				dateForPeriodDay(lastPeriod, 18),
			),
			parsedName: "Shopee",
			parsedAmount: "224.90",
			status: "pending" as const,
			transactionId: null,
			processedAt: null,
			discardedAt: null,
		},
		{
			userId: targetUser.id,
			sourceApp: "com.nu.production",
			sourceAppName: "Nubank",
			originalTitle: "Compra aprovada",
			originalText:
				"Compra de R$ 89,90 aprovada no cartão Ultravioleta em NETFLIX.COM",
			notificationTimestamp: parseLocalDateString(
				dateForPeriodDay(lastPeriod, 21),
			),
			parsedName: "Netflix",
			parsedAmount: "89.90",
			status: "pending" as const,
			transactionId: null,
			processedAt: null,
			discardedAt: null,
		},
		{
			userId: targetUser.id,
			sourceApp: "com.mercadopago.wallet",
			sourceAppName: "Mercado Pago",
			originalTitle: null,
			originalText: "Você pagou R$ 92,50 via Pix para SHELL POSTO",
			notificationTimestamp: parseLocalDateString(
				dateForPeriodDay(lastPeriod, 22),
			),
			parsedName: "Shell",
			parsedAmount: "92.50",
			status: "pending" as const,
			transactionId: null,
			processedAt: null,
			discardedAt: null,
		},
		{
			userId: targetUser.id,
			sourceApp: "com.mercadolivre.mercadolibre",
			sourceAppName: "Mercado Livre",
			originalTitle: "Pedido confirmado",
			originalText:
				"Seu pedido de R$ 379,00 foi confirmado em MERCADO LIVRE BR",
			notificationTimestamp: parseLocalDateString(
				dateForPeriodDay(lastPeriod, 24),
			),
			parsedName: "Mercado Livre",
			parsedAmount: "379.00",
			status: "pending" as const,
			transactionId: null,
			processedAt: null,
			discardedAt: null,
		},
		{
			userId: targetUser.id,
			sourceApp: "com.apple.android.music",
			sourceAppName: "Apple",
			originalTitle: "Compra recebida",
			originalText: "Sua compra de R$ 19,90 em APPLE.COM/BILL foi processada.",
			notificationTimestamp: parseLocalDateString(
				dateForPeriodDay(lastPeriod, 25),
			),
			parsedName: "Apple",
			parsedAmount: "19.90",
			status: "pending" as const,
			transactionId: null,
			processedAt: null,
			discardedAt: null,
		},
	];

	await db.insert(inboxItems).values(inboxItemsData);
	summary.inboxItems += inboxItemsData.length;

	const finalPeriods = Array.from(
		new Set(
			seedTransactionRecords
				.map((record) => record.period ?? "")
				.filter(Boolean),
		),
	).sort(comparePeriods);

	const seededFrom = finalPeriods[0] ?? options.startPeriod;
	const seededTo = finalPeriods[finalPeriods.length - 1] ?? options.startPeriod;

	console.log("Seed concluído com sucesso.");
	console.log(
		JSON.stringify(
			{
				userId: targetUser.id,
				userName: targetUser.name,
				startPeriod: options.startPeriod,
				months: options.months,
				seededFrom,
				seededTo,
				todayPeriod: businessToday.period,
				summary,
			},
			null,
			2,
		),
	);
}

void main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(
			error instanceof Error
				? error.message
				: "Erro inesperado ao popular conta.",
		);
		process.exit(1);
	});
