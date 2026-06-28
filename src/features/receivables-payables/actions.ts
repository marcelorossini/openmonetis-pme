"use server";

import { randomUUID } from "node:crypto";
import { and, eq, gt, gte, inArray } from "drizzle-orm";
import {
	categories,
	financialAccounts,
	financialTitles,
	parties,
	payers,
	transactions,
} from "@/db/schema";
import {
	buildSeriesPeriodsToGenerate,
	getMonthlySeriesDueDate,
	getRecurringSeriesIndex,
	normalizeRecurringDueDateForPeriod,
} from "@/features/receivables-payables/lib/recurrence";
import {
	ensureRecurringFinancialTitleCoverage,
	getSeriesRegenerationReferencePeriod,
	RECURRING_FINANCIAL_TITLE_HORIZON_MONTHS,
} from "@/features/receivables-payables/lib/recurring-series-service";
import {
	type CancelFinancialTitleInput,
	type CreateFinancialTitleInput,
	cancelFinancialTitleSchema,
	createFinancialTitleSchema,
	type EndFinancialTitleSeriesInput,
	type ExtendFinancialTitleSeriesInput,
	endFinancialTitleSeriesSchema,
	extendFinancialTitleSeriesSchema,
	type RestoreFinancialTitleInput,
	type ResumeFinancialTitleSeriesInput,
	restoreFinancialTitleSchema,
	resumeFinancialTitleSeriesSchema,
	type SettleFinancialTitleInput,
	settleFinancialTitleSchema,
	type UpdateFinancialTitleInput,
	updateFinancialTitleSchema,
} from "@/features/receivables-payables/lib/schemas";
import { buildSettlementTransactionValues } from "@/features/receivables-payables/lib/settlement";
import { deriveTitlePeriodFromDate } from "@/features/receivables-payables/lib/status";
import {
	handleActionError,
	revalidateForEntity,
} from "@/shared/lib/actions/helpers";
import { getUser } from "@/shared/lib/auth/server";
import { canCategoryLinkParty } from "@/shared/lib/categories/party-kind";
import { db } from "@/shared/lib/db";
import { getAdminPayerId } from "@/shared/lib/payers/get-admin-id";
import type { ActionResult } from "@/shared/lib/types/actions";
import { formatDecimalForDbRequired } from "@/shared/utils/currency";
import {
	getBusinessDateString,
	getBusinessTodayInfo,
	parseLocalDateString,
	toDateOnlyString,
} from "@/shared/utils/date";
import { comparePeriods } from "@/shared/utils/period";

const revalidateTitles = (userId: string) =>
	revalidateForEntity("financialTitles", userId);

type ResolvedReferences = {
	party: typeof parties.$inferSelect | null;
	category: typeof categories.$inferSelect | null;
	account: typeof financialAccounts.$inferSelect | null;
	payerId: string | null;
};

const getAnchorDayFromDate = (dateString: string) => {
	const [, , dayPart] = dateString.split("-");
	return Number.parseInt(dayPart ?? "1", 10) || 1;
};

const isRecurringTitle = (title: typeof financialTitles.$inferSelect) =>
	Boolean(title.seriesId && title.seriesFrequency === "monthly");

const getSeriesStartPeriod = (title: typeof financialTitles.$inferSelect) =>
	title.seriesStartDate
		? deriveTitlePeriodFromDate(toDateOnlyString(title.seriesStartDate) ?? "")
		: title.competencePeriod;

async function resolveTitleReferences(
	userId: string,
	input: {
		partyId: string | null;
		categoryId: string | null;
		accountId: string | null;
		payerId: string | null;
	},
): Promise<
	{ ok: true; data: ResolvedReferences } | { ok: false; error: string }
> {
	const resolvedPayerId = input.payerId ?? (await getAdminPayerId(userId));

	const [party, category, account, payer] = await Promise.all([
		input.partyId
			? db.query.parties.findFirst({
					where: and(eq(parties.id, input.partyId), eq(parties.userId, userId)),
				})
			: Promise.resolve(null),
		input.categoryId
			? db.query.categories.findFirst({
					where: and(
						eq(categories.id, input.categoryId),
						eq(categories.userId, userId),
					),
				})
			: Promise.resolve(null),
		input.accountId
			? db.query.financialAccounts.findFirst({
					where: and(
						eq(financialAccounts.id, input.accountId),
						eq(financialAccounts.userId, userId),
					),
				})
			: Promise.resolve(null),
		resolvedPayerId
			? db.query.payers.findFirst({
					where: and(eq(payers.id, resolvedPayerId), eq(payers.userId, userId)),
				})
			: Promise.resolve(null),
	]);

	if (input.partyId && !party) {
		return { ok: false, error: "Cliente/fornecedor não encontrado." };
	}

	if (input.categoryId && !category) {
		return { ok: false, error: "Categoria não encontrada." };
	}

	if (input.accountId && !account) {
		return { ok: false, error: "Conta não encontrada." };
	}

	if (resolvedPayerId && !payer) {
		return { ok: false, error: "Pessoa não encontrada." };
	}

	if (category?.partyKind && !party) {
		return {
			ok: false,
			error: "Selecione o cliente/fornecedor compatível com a categoria.",
		};
	}

	if (category?.partyKind && party && !canCategoryLinkParty(category, party)) {
		return {
			ok: false,
			error:
				"O cliente/fornecedor selecionado não é compatível com a categoria.",
		};
	}

	return {
		ok: true,
		data: {
			party: party ?? null,
			category: category ?? null,
			account: account ?? null,
			payerId: payer?.id ?? null,
		},
	};
}

function buildMutableTitlePayload(
	input: CreateFinancialTitleInput | UpdateFinancialTitleInput,
	references: ResolvedReferences,
	dueDateString = input.dueDate,
) {
	return {
		type: input.type,
		name: input.name,
		description: input.description,
		amount: formatDecimalForDbRequired(input.amount),
		dueDate: parseLocalDateString(dueDateString),
		competencePeriod: deriveTitlePeriodFromDate(dueDateString),
		paymentMethod: input.paymentMethod,
		partyId: references.party?.id ?? null,
		categoryId: references.category?.id ?? null,
		accountId: references.account?.id ?? null,
		payerId: references.payerId,
	};
}

async function resolveSeriesOrigin(userId: string, seriesId: string) {
	return db.query.financialTitles.findFirst({
		where: and(
			eq(financialTitles.userId, userId),
			eq(financialTitles.seriesId, seriesId),
			eq(financialTitles.seriesRole, "origin"),
		),
	});
}

export async function createFinancialTitleAction(
	input: CreateFinancialTitleInput,
): Promise<ActionResult<{ id: string }>> {
	try {
		const user = await getUser();
		const data = createFinancialTitleSchema.parse(input);
		const references = await resolveTitleReferences(user.id, data);
		if (!references.ok) {
			return { success: false, error: references.error };
		}

		if (!data.recurrence) {
			const [created] = await db
				.insert(financialTitles)
				.values({
					...buildMutableTitlePayload(data, references.data),
					userId: user.id,
				})
				.returning({ id: financialTitles.id });

			revalidateTitles(user.id);

			return {
				success: true,
				message: "Título financeiro criado com sucesso.",
				data: created,
			};
		}
		const recurrence = data.recurrence;

		const currentPeriod = getBusinessTodayInfo().period;
		const seriesStartPeriod = deriveTitlePeriodFromDate(data.dueDate);
		const firstMaterializedPeriod =
			recurrence.generateRetroactive ||
			comparePeriods(seriesStartPeriod, currentPeriod) > 0
				? seriesStartPeriod
				: currentPeriod;
		const seriesEndPeriod = recurrence.endDate
			? deriveTitlePeriodFromDate(recurrence.endDate)
			: null;

		if (
			seriesEndPeriod &&
			comparePeriods(seriesEndPeriod, firstMaterializedPeriod) < 0
		) {
			return {
				success: false,
				error:
					"A data final da recorrência precisa ser igual ou posterior ao primeiro mês gerado.",
			};
		}

		const seriesId = randomUUID();
		const anchorDay = getAnchorDayFromDate(data.dueDate);
		const originDueDate = getMonthlySeriesDueDate(
			firstMaterializedPeriod,
			anchorDay,
		);
		const originValues = {
			...buildMutableTitlePayload(data, references.data, originDueDate),
			userId: user.id,
			seriesId,
			seriesRole: "origin" as const,
			seriesFrequency: recurrence.frequency,
			seriesIndex: getRecurringSeriesIndex({
				seriesStartPeriod,
				targetPeriod: firstMaterializedPeriod,
			}),
			seriesStartDate: parseLocalDateString(data.dueDate),
			seriesEndDate: recurrence.endDate
				? parseLocalDateString(recurrence.endDate)
				: null,
			seriesAnchorDay: anchorDay,
			seriesGeneratedThrough: firstMaterializedPeriod,
			seriesClosedAt: null,
		};
		const periodsToGenerate = buildSeriesPeriodsToGenerate({
			currentPeriod,
			generateRetroactive: true,
			horizonMonths: RECURRING_FINANCIAL_TITLE_HORIZON_MONTHS,
			seriesGeneratedThrough: firstMaterializedPeriod,
			seriesStartPeriod,
			seriesEndPeriod,
		});

		const [created] = await db.transaction(async (tx) => {
			const [createdOrigin] = await tx
				.insert(financialTitles)
				.values(originValues)
				.returning({ id: financialTitles.id });

			if (periodsToGenerate.length > 0) {
				await tx.insert(financialTitles).values(
					periodsToGenerate.map((period) => ({
						...buildMutableTitlePayload(
							data,
							references.data,
							getMonthlySeriesDueDate(period, anchorDay),
						),
						userId: user.id,
						seriesId,
						seriesRole: "occurrence" as const,
						seriesFrequency: recurrence.frequency,
						seriesIndex: getRecurringSeriesIndex({
							seriesStartPeriod,
							targetPeriod: period,
						}),
						seriesStartDate: originValues.seriesStartDate,
						seriesEndDate: originValues.seriesEndDate,
						seriesAnchorDay: anchorDay,
						seriesGeneratedThrough: null,
						seriesClosedAt: null,
					})),
				);

				await tx
					.update(financialTitles)
					.set({
						seriesGeneratedThrough:
							periodsToGenerate.at(-1) ?? firstMaterializedPeriod,
						updatedAt: new Date(),
					})
					.where(
						and(
							eq(financialTitles.id, createdOrigin.id),
							eq(financialTitles.userId, user.id),
						),
					);
			}

			return [createdOrigin];
		});

		revalidateTitles(user.id);

		return {
			success: true,
			message: "Título recorrente criado com sucesso.",
			data: created,
		};
	} catch (error) {
		return handleActionError(error) as ActionResult<{ id: string }>;
	}
}

export async function updateFinancialTitleAction(
	input: UpdateFinancialTitleInput,
): Promise<ActionResult> {
	try {
		const user = await getUser();
		const data = updateFinancialTitleSchema.parse(input);
		const existing = await db.query.financialTitles.findFirst({
			where: and(
				eq(financialTitles.id, data.id),
				eq(financialTitles.userId, user.id),
			),
		});

		if (!existing) {
			return { success: false, error: "Título financeiro não encontrado." };
		}

		const references = await resolveTitleReferences(user.id, data);
		if (!references.ok) {
			return { success: false, error: references.error };
		}

		const dueDateForUpdate = isRecurringTitle(existing)
			? normalizeRecurringDueDateForPeriod({
					competencePeriod: existing.competencePeriod,
					selectedDate: data.dueDate,
				})
			: data.dueDate;

		if (existing.status === "settled") {
			const immutableChanged =
				existing.type !== data.type ||
				existing.amount !== formatDecimalForDbRequired(data.amount) ||
				(existing.categoryId ?? null) !==
					(references.data.category?.id ?? null) ||
				(existing.accountId ?? null) !==
					(references.data.account?.id ?? null) ||
				(existing.partyId ?? null) !== (references.data.party?.id ?? null) ||
				toDateOnlyString(existing.dueDate) !== dueDateForUpdate;

			if (immutableChanged) {
				return {
					success: false,
					error:
						"Títulos baixados não podem ter valor, vencimento ou vínculos alterados.",
				};
			}
		}

		if (!isRecurringTitle(existing) || data.editScope === "single") {
			await db
				.update(financialTitles)
				.set({
					...buildMutableTitlePayload(data, references.data, dueDateForUpdate),
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(financialTitles.id, data.id),
						eq(financialTitles.userId, user.id),
					),
				);

			revalidateTitles(user.id);
			return {
				success: true,
				message: "Título financeiro atualizado com sucesso.",
			};
		}

		const seriesId = existing.seriesId;
		if (!seriesId) {
			return { success: false, error: "Série recorrente não encontrada." };
		}

		const origin = await resolveSeriesOrigin(user.id, seriesId);
		if (!origin) {
			return { success: false, error: "Origem da série não encontrada." };
		}

		const anchorDay = getAnchorDayFromDate(data.dueDate);
		const futureRows = await db.query.financialTitles.findMany({
			where: and(
				eq(financialTitles.userId, user.id),
				eq(financialTitles.seriesId, seriesId),
				gte(financialTitles.competencePeriod, existing.competencePeriod),
			),
		});
		const editableRows = futureRows.filter((row) => row.status !== "settled");

		await db.transaction(async (tx) => {
			for (const row of editableRows) {
				const rowDueDate = getMonthlySeriesDueDate(
					row.competencePeriod,
					anchorDay,
				);

				await tx
					.update(financialTitles)
					.set({
						...buildMutableTitlePayload(data, references.data, rowDueDate),
						seriesAnchorDay: anchorDay,
						updatedAt: new Date(),
					})
					.where(
						and(
							eq(financialTitles.id, row.id),
							eq(financialTitles.userId, user.id),
						),
					);
			}

			await tx
				.update(financialTitles)
				.set({
					type: data.type,
					name: data.name,
					description: data.description,
					amount: formatDecimalForDbRequired(data.amount),
					paymentMethod: data.paymentMethod,
					partyId: references.data.party?.id ?? null,
					categoryId: references.data.category?.id ?? null,
					accountId: references.data.account?.id ?? null,
					payerId: references.data.payerId,
					seriesAnchorDay: anchorDay,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(financialTitles.id, origin.id),
						eq(financialTitles.userId, user.id),
					),
				);
		});

		revalidateTitles(user.id);
		return {
			success: true,
			message: "Títulos futuros da recorrência foram atualizados.",
		};
	} catch (error) {
		return handleActionError(error);
	}
}

export async function cancelFinancialTitleAction(
	input: CancelFinancialTitleInput,
): Promise<ActionResult> {
	try {
		const user = await getUser();
		const data = cancelFinancialTitleSchema.parse(input);
		const existing = await db.query.financialTitles.findFirst({
			where: and(
				eq(financialTitles.id, data.id),
				eq(financialTitles.userId, user.id),
			),
		});

		if (!existing) {
			return { success: false, error: "Título financeiro não encontrado." };
		}

		if (existing.status === "settled") {
			return {
				success: false,
				error: "Títulos baixados não podem ser cancelados.",
			};
		}

		await db
			.update(financialTitles)
			.set({
				status: "cancelled",
				cancelledAt: new Date(),
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(financialTitles.id, data.id),
					eq(financialTitles.userId, user.id),
				),
			);

		revalidateTitles(user.id);
		return {
			success: true,
			message: "Título financeiro cancelado com sucesso.",
		};
	} catch (error) {
		return handleActionError(error);
	}
}

export async function restoreFinancialTitleAction(
	input: RestoreFinancialTitleInput,
): Promise<ActionResult> {
	try {
		const user = await getUser();
		const data = restoreFinancialTitleSchema.parse(input);
		const existing = await db.query.financialTitles.findFirst({
			where: and(
				eq(financialTitles.id, data.id),
				eq(financialTitles.userId, user.id),
			),
		});

		if (!existing) {
			return { success: false, error: "Título financeiro não encontrado." };
		}

		if (existing.status !== "cancelled") {
			return {
				success: false,
				error: "Somente títulos cancelados podem ser restaurados.",
			};
		}

		await db
			.update(financialTitles)
			.set({
				status: "pending",
				cancelledAt: null,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(financialTitles.id, data.id),
					eq(financialTitles.userId, user.id),
				),
			);

		revalidateTitles(user.id);
		return {
			success: true,
			message: "Título financeiro restaurado com sucesso.",
		};
	} catch (error) {
		return handleActionError(error);
	}
}

export async function settleFinancialTitleAction(
	input: SettleFinancialTitleInput,
): Promise<ActionResult<{ transactionId: string }>> {
	try {
		const user = await getUser();
		const data = settleFinancialTitleSchema.parse(input);
		const existing = await db.query.financialTitles.findFirst({
			where: and(
				eq(financialTitles.id, data.id),
				eq(financialTitles.userId, user.id),
			),
		});

		if (!existing) {
			return { success: false, error: "Título financeiro não encontrado." };
		}

		if (existing.status !== "pending") {
			return {
				success: false,
				error: "Somente títulos pendentes podem ser baixados.",
			};
		}

		const account = await db.query.financialAccounts.findFirst({
			where: and(
				eq(financialAccounts.id, data.accountId),
				eq(financialAccounts.userId, user.id),
			),
		});

		if (!account) {
			return { success: false, error: "Conta de baixa não encontrada." };
		}

		const [transactionId] = await db.transaction(async (tx) => {
			const [createdTransaction] = await tx
				.insert(transactions)
				.values(
					buildSettlementTransactionValues({
						title: {
							type: existing.type === "payable" ? "payable" : "receivable",
							name: existing.name,
							description: existing.description,
							dueDate:
								toDateOnlyString(existing.dueDate) ?? getBusinessDateString(),
							categoryId: existing.categoryId,
							partyId: existing.partyId,
							payerId: existing.payerId,
						},
						userId: user.id,
						accountId: account.id,
						paymentMethod: data.paymentMethod,
						settledAt: data.settledAt,
						settledAmount: data.settledAmount,
					}),
				)
				.returning({ id: transactions.id });

			await tx
				.update(financialTitles)
				.set({
					status: "settled",
					paymentMethod: data.paymentMethod,
					accountId: account.id,
					settledAt: parseLocalDateString(data.settledAt),
					settledAmount: formatDecimalForDbRequired(data.settledAmount),
					settlementTransactionId: createdTransaction?.id ?? null,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(financialTitles.id, existing.id),
						eq(financialTitles.userId, user.id),
					),
				);

			return [createdTransaction?.id ?? ""];
		});

		revalidateTitles(user.id);
		revalidateForEntity("transactions", user.id);

		return {
			success: true,
			message:
				existing.type === "payable"
					? "Título marcado como pago."
					: "Título marcado como recebido.",
			data: { transactionId },
		};
	} catch (error) {
		return handleActionError(error) as ActionResult<{ transactionId: string }>;
	}
}

export async function endFinancialTitleSeriesAction(
	input: EndFinancialTitleSeriesInput,
): Promise<ActionResult> {
	try {
		const user = await getUser();
		const data = endFinancialTitleSeriesSchema.parse(input);
		const existing = await db.query.financialTitles.findFirst({
			where: and(
				eq(financialTitles.id, data.id),
				eq(financialTitles.userId, user.id),
			),
		});

		if (!existing || !isRecurringTitle(existing) || !existing.seriesId) {
			return { success: false, error: "Série recorrente não encontrada." };
		}
		const seriesId = existing.seriesId;

		const origin = await resolveSeriesOrigin(user.id, seriesId);
		if (!origin) {
			return { success: false, error: "Origem da série não encontrada." };
		}

		const endPeriod = deriveTitlePeriodFromDate(data.endDate);
		if (comparePeriods(endPeriod, origin.competencePeriod) < 0) {
			return {
				success: false,
				error:
					"A data final precisa ser igual ou posterior ao primeiro mês materializado da série.",
			};
		}

		const blockingRows = await db.query.financialTitles.findMany({
			columns: { id: true },
			where: and(
				eq(financialTitles.userId, user.id),
				eq(financialTitles.seriesId, seriesId),
				gt(financialTitles.competencePeriod, endPeriod),
				eq(financialTitles.status, "settled"),
			),
		});

		if (blockingRows.length > 0) {
			return {
				success: false,
				error:
					"Existem ocorrências já baixadas após a data final informada. Ajuste o corte ou revise essas baixas primeiro.",
			};
		}

		const rowsToDelete = await db.query.financialTitles.findMany({
			columns: { id: true },
			where: and(
				eq(financialTitles.userId, user.id),
				eq(financialTitles.seriesId, seriesId),
				gt(financialTitles.competencePeriod, endPeriod),
			),
		});

		await db.transaction(async (tx) => {
			if (rowsToDelete.length > 0) {
				await tx.delete(financialTitles).where(
					and(
						eq(financialTitles.userId, user.id),
						inArray(
							financialTitles.id,
							rowsToDelete.map((row) => row.id),
						),
					),
				);
			}

			await tx
				.update(financialTitles)
				.set({
					seriesEndDate: parseLocalDateString(data.endDate),
					seriesClosedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(financialTitles.userId, user.id),
						eq(financialTitles.seriesId, seriesId),
					),
				);

			await tx
				.update(financialTitles)
				.set({
					seriesGeneratedThrough:
						origin.seriesGeneratedThrough &&
						comparePeriods(origin.seriesGeneratedThrough, endPeriod) > 0
							? endPeriod
							: origin.seriesGeneratedThrough,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(financialTitles.id, origin.id),
						eq(financialTitles.userId, user.id),
					),
				);
		});

		revalidateTitles(user.id);
		return {
			success: true,
			message: "Recorrência encerrada com sucesso.",
		};
	} catch (error) {
		return handleActionError(error);
	}
}

export async function extendFinancialTitleSeriesAction(
	input: ExtendFinancialTitleSeriesInput,
): Promise<ActionResult> {
	try {
		const user = await getUser();
		const data = extendFinancialTitleSeriesSchema.parse(input);
		const existing = await db.query.financialTitles.findFirst({
			where: and(
				eq(financialTitles.id, data.id),
				eq(financialTitles.userId, user.id),
			),
		});

		if (!existing || !isRecurringTitle(existing) || !existing.seriesId) {
			return { success: false, error: "Série recorrente não encontrada." };
		}
		const seriesId = existing.seriesId;

		const origin = await resolveSeriesOrigin(user.id, seriesId);
		if (!origin) {
			return { success: false, error: "Origem da série não encontrada." };
		}

		const endPeriod = deriveTitlePeriodFromDate(data.endDate);
		if (comparePeriods(endPeriod, getSeriesStartPeriod(origin)) < 0) {
			return {
				success: false,
				error:
					"A data final precisa ser igual ou posterior ao início da recorrência.",
			};
		}

		await db
			.update(financialTitles)
			.set({
				seriesEndDate: parseLocalDateString(data.endDate),
				seriesClosedAt: origin.seriesClosedAt ?? new Date(),
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(financialTitles.userId, user.id),
					eq(financialTitles.seriesId, seriesId),
				),
			);

		await ensureRecurringFinancialTitleCoverage({
			referencePeriod: getSeriesRegenerationReferencePeriod(
				existing.competencePeriod,
			),
			seriesId,
			userId: user.id,
		});

		revalidateTitles(user.id);
		return {
			success: true,
			message: "Data final da recorrência atualizada com sucesso.",
		};
	} catch (error) {
		return handleActionError(error);
	}
}

export async function resumeFinancialTitleSeriesAction(
	input: ResumeFinancialTitleSeriesInput,
): Promise<ActionResult> {
	try {
		const user = await getUser();
		const data = resumeFinancialTitleSeriesSchema.parse(input);
		const existing = await db.query.financialTitles.findFirst({
			where: and(
				eq(financialTitles.id, data.id),
				eq(financialTitles.userId, user.id),
			),
		});

		if (!existing || !isRecurringTitle(existing) || !existing.seriesId) {
			return { success: false, error: "Série recorrente não encontrada." };
		}
		const seriesId = existing.seriesId;

		await db
			.update(financialTitles)
			.set({
				seriesEndDate: null,
				seriesClosedAt: null,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(financialTitles.userId, user.id),
					eq(financialTitles.seriesId, seriesId),
				),
			);

		await ensureRecurringFinancialTitleCoverage({
			referencePeriod: getSeriesRegenerationReferencePeriod(
				existing.competencePeriod,
			),
			seriesId,
			userId: user.id,
		});

		revalidateTitles(user.id);
		return {
			success: true,
			message: "Recorrência reativada com sucesso.",
		};
	} catch (error) {
		return handleActionError(error);
	}
}
