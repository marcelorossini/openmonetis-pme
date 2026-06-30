"use server";

import { createHash, randomBytes } from "node:crypto";
import { verifyPassword } from "better-auth/crypto";
import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { account, apiTokens, appBrandingSettings, payers } from "@/db/schema";
import { revalidateForEntity } from "@/shared/lib/actions/helpers";
import { auth } from "@/shared/lib/auth/config";
import { getUser } from "@/shared/lib/auth/server";
import {
	DEFAULT_PRIMARY_COLOR_HEX,
	normalizePrimaryColorHex,
} from "@/shared/lib/branding/color";
import {
	BrandingLogoValidationError,
	prepareBrandingLogoForStorage,
} from "@/shared/lib/branding/logo";
import {
	APP_BRANDING_CACHE_TAG,
	APP_BRANDING_ID,
} from "@/shared/lib/branding/queries";
import { buildDefaultCategoryValues } from "@/shared/lib/categories/defaults";
import { db, schema } from "@/shared/lib/db";
import { normalizeOptionalText } from "@/shared/lib/inbox-integrations/mapping";
import { reprocessPendingInboxItem } from "@/shared/lib/inbox-integrations/service";
import {
	DEFAULT_PAYER_AVATAR,
	PAYER_ROLE_ADMIN,
	PAYER_STATUS_OPTIONS,
} from "@/shared/lib/payers/constants";
import { getAdminPayerId } from "@/shared/lib/payers/get-admin-id";
import { generateShareCode } from "@/shared/lib/payers/share-code";
import { normalizeNameFromEmail } from "@/shared/lib/payers/utils";
import { deleteS3Object } from "@/shared/lib/storage/presign";

type ActionResponse<T = void> = {
	success: boolean;
	message?: string;
	error?: string;
	data?: T;
};

// Schema de validação
const updateNameSchema = z.object({
	firstName: z.string().min(1, "Primeiro nome é obrigatório"),
	lastName: z.string().min(1, "Sobrenome é obrigatório"),
});

const updatePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, "Senha atual é obrigatória"),
		newPassword: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
		confirmPassword: z.string(),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "As senhas não coincidem",
		path: ["confirmPassword"],
	});

const updateEmailSchema = z
	.object({
		password: z.string().optional(), // Opcional para usuários Google OAuth
		newEmail: z.string().email("E-mail inválido"),
		confirmEmail: z.string().email("E-mail inválido"),
	})
	.refine((data) => data.newEmail === data.confirmEmail, {
		message: "Os e-mails não coincidem",
		path: ["confirmEmail"],
	});

const deleteAccountSchema = z.object({
	confirmation: z.literal("DELETAR"),
});

const resetAccountSchema = z.object({
	confirmation: z.literal("ZERAR"),
});

const updatePreferencesSchema = z.object({
	statementNoteAsColumn: z.boolean(),
	transactionsColumnOrder: z.array(z.string()).nullable(),
	attachmentMaxSizeMb: z.number().int().min(1).max(100),
	showTransactionSummary: z.boolean(),
	hideAnticipatedInstallments: z.boolean(),
});

const updateBrandingColorSchema = z.object({
	primaryColorHex: z.string().nullable(),
});

const integrationEntitySchema = z.enum(["account", "party", "category"]);

const saveIntegrationMappingSchema = z.object({
	entityType: integrationEntitySchema,
	sourceApp: z.string().min(1, "Informe a origem").max(255),
	profileKey: z.string().max(255).optional(),
	externalKey: z.string().min(1, "Informe o valor recebido").max(255),
	targetId: z.string().uuid("Destino inválido"),
});

const deleteIntegrationMappingSchema = z.object({
	entityType: integrationEntitySchema,
	sourceApp: z.string().min(1, "Informe a origem").max(255),
	profileKey: z.string().max(255).optional(),
	externalKey: z.string().min(1, "Informe o valor recebido").max(255),
});

type ResettableUser = {
	name: string | null;
	email: string | null;
	image: string | null;
};

async function resetUserAppData(
	userId: string,
	user: ResettableUser,
): Promise<void> {
	const payerName =
		(user.name && user.name.trim().length > 0
			? user.name.trim()
			: normalizeNameFromEmail(user.email)) || "Pessoa principal";
	const avatarUrl = user.image ?? DEFAULT_PAYER_AVATAR;
	const defaultPayerStatus = PAYER_STATUS_OPTIONS[0];

	const userAttachments = await db
		.select({ id: schema.attachments.id, fileKey: schema.attachments.fileKey })
		.from(schema.attachments)
		.where(eq(schema.attachments.userId, userId));

	await db.transaction(async (tx: typeof db) => {
		// Regra do reset: toda nova tabela de dados do app vinculada ao usuário
		// precisa entrar nesta limpeza, além das revalidações de resetAccountAction.
		await tx
			.delete(schema.payerShares)
			.where(
				or(
					eq(schema.payerShares.sharedWithUserId, userId),
					eq(schema.payerShares.createdByUserId, userId),
				),
			);

		await tx
			.delete(schema.userPreferences)
			.where(eq(schema.userPreferences.userId, userId));
		await tx
			.delete(schema.integrationPartyMappings)
			.where(eq(schema.integrationPartyMappings.userId, userId));
		await tx
			.delete(schema.integrationAccountMappings)
			.where(eq(schema.integrationAccountMappings.userId, userId));
		await tx
			.delete(schema.integrationCategoryMappings)
			.where(eq(schema.integrationCategoryMappings.userId, userId));
		await tx
			.delete(schema.importCategoryMappings)
			.where(eq(schema.importCategoryMappings.userId, userId));
		await tx
			.delete(schema.dashboardNotificationStates)
			.where(eq(schema.dashboardNotificationStates.userId, userId));
		await tx
			.delete(schema.establishmentLogos)
			.where(eq(schema.establishmentLogos.userId, userId));
		await tx
			.delete(schema.apiTokens)
			.where(eq(schema.apiTokens.userId, userId));
		await tx
			.delete(schema.savedInsights)
			.where(eq(schema.savedInsights.userId, userId));
		await tx.delete(schema.notes).where(eq(schema.notes.userId, userId));
		await tx
			.delete(schema.inboxItems)
			.where(eq(schema.inboxItems.userId, userId));
		await tx.delete(schema.budgets).where(eq(schema.budgets.userId, userId));
		await tx
			.delete(schema.financialTitles)
			.where(eq(schema.financialTitles.userId, userId));
		await tx
			.delete(schema.installmentAnticipations)
			.where(eq(schema.installmentAnticipations.userId, userId));
		await tx
			.delete(schema.transactions)
			.where(eq(schema.transactions.userId, userId));
		await tx
			.delete(schema.attachments)
			.where(eq(schema.attachments.userId, userId));
		await tx.delete(schema.invoices).where(eq(schema.invoices.userId, userId));
		await tx.delete(schema.cards).where(eq(schema.cards.userId, userId));
		await tx
			.delete(schema.financialAccounts)
			.where(eq(schema.financialAccounts.userId, userId));
		await tx.delete(schema.parties).where(eq(schema.parties.userId, userId));
		await tx.delete(schema.payers).where(eq(schema.payers.userId, userId));
		await tx
			.delete(schema.categories)
			.where(eq(schema.categories.userId, userId));

		const defaultCategoryValues = buildDefaultCategoryValues(userId);

		if (defaultCategoryValues.length > 0) {
			await tx.insert(schema.categories).values(defaultCategoryValues);
		}

		await tx.insert(schema.payers).values({
			name: payerName,
			email: user.email,
			avatarUrl,
			status: defaultPayerStatus,
			note: null,
			role: PAYER_ROLE_ADMIN,
			isAutoSend: false,
			shareCode: generateShareCode(),
			userId,
		});
	});

	await Promise.all(
		userAttachments.map((att) =>
			deleteS3Object(att.fileKey).catch((err) => {
				console.error("Falha ao remover anexo do S3 no reset:", err);
			}),
		),
	);
}

async function upsertBrandingSettings(
	values: Partial<typeof appBrandingSettings.$inferInsert>,
) {
	const [existing] = await db
		.select({ id: appBrandingSettings.id })
		.from(appBrandingSettings)
		.where(eq(appBrandingSettings.id, APP_BRANDING_ID))
		.limit(1);

	if (existing) {
		await db
			.update(appBrandingSettings)
			.set({ ...values, updatedAt: new Date() })
			.where(eq(appBrandingSettings.id, APP_BRANDING_ID));
		return;
	}

	await db.insert(appBrandingSettings).values({
		id: APP_BRANDING_ID,
		...values,
	});
}

function revalidateBranding() {
	revalidateTag(APP_BRANDING_CACHE_TAG, "max");
	revalidatePath("/", "layout");
	revalidatePath("/settings");
}

// Actions

export async function updateNameAction(
	data: z.infer<typeof updateNameSchema>,
): Promise<ActionResponse> {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user?.id) {
			return {
				success: false,
				error: "Não autenticado",
			};
		}

		const validated = updateNameSchema.parse(data);
		const fullName = `${validated.firstName} ${validated.lastName}`;
		const adminPayerId = await getAdminPayerId(session.user.id);

		// Atualizar nome do usuário
		await db
			.update(schema.user)
			.set({ name: fullName })
			.where(eq(schema.user.id, session.user.id));

		// Sincronizar nome com o pessoa admin
		if (adminPayerId) {
			await db
				.update(payers)
				.set({ name: fullName })
				.where(
					and(eq(payers.userId, session.user.id), eq(payers.id, adminPayerId)),
				);
		}

		// Revalidar o layout do dashboard para atualizar a sidebar
		revalidatePath("/", "layout");
		revalidatePath("/payers");

		return {
			success: true,
			message: "Nome atualizado com sucesso",
		};
	} catch (error) {
		if (error instanceof z.ZodError) {
			return {
				success: false,
				error: error.issues[0]?.message || "Dados inválidos",
			};
		}

		console.error("Erro ao atualizar nome:", error);
		return {
			success: false,
			error: "Erro ao atualizar nome. Tente novamente.",
		};
	}
}

export async function updatePasswordAction(
	data: z.infer<typeof updatePasswordSchema>,
): Promise<ActionResponse> {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user?.id || !session?.user?.email) {
			return {
				success: false,
				error: "Não autenticado",
			};
		}

		const validated = updatePasswordSchema.parse(data);

		// Verificar se o usuário tem conta com provedor Google
		const userAccount = await db.query.account.findFirst({
			where: and(
				eq(schema.account.userId, session.user.id),
				eq(schema.account.providerId, "google"),
			),
		});

		if (userAccount) {
			return {
				success: false,
				error:
					"Não é possível alterar senha para financialAccounts autenticadas via Google",
			};
		}

		// Usar a API do Better Auth para atualizar a senha
		try {
			await auth.api.changePassword({
				body: {
					newPassword: validated.newPassword,
					currentPassword: validated.currentPassword,
				},
				headers: await headers(),
			});

			return {
				success: true,
				message: "Senha atualizada com sucesso",
			};
		} catch (authError) {
			console.error("Erro na API do Better Auth:", authError);

			// Verificar se o erro é de senha incorreta
			if (
				(authError as Error)?.message?.includes("password") ||
				(authError as Error)?.message?.includes("incorrect")
			) {
				return {
					success: false,
					error: "Senha atual incorreta",
				};
			}

			return {
				success: false,
				error:
					"Erro ao atualizar senha. Verifique se a senha atual está correta.",
			};
		}
	} catch (error) {
		if (error instanceof z.ZodError) {
			return {
				success: false,
				error: error.issues[0]?.message || "Dados inválidos",
			};
		}

		console.error("Erro ao atualizar senha:", error);
		return {
			success: false,
			error: "Erro ao atualizar senha. Tente novamente.",
		};
	}
}

export async function updateEmailAction(
	data: z.infer<typeof updateEmailSchema>,
): Promise<ActionResponse> {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user?.id || !session?.user?.email) {
			return {
				success: false,
				error: "Não autenticado",
			};
		}

		const validated = updateEmailSchema.parse(data);

		// Verificar se o usuário tem conta com provedor Google
		const userAccount = await db.query.account.findFirst({
			where: and(
				eq(schema.account.userId, session.user.id),
				eq(schema.account.providerId, "google"),
			),
		});

		const isGoogleAuth = !!userAccount;

		// Se não for Google OAuth, validar senha
		if (!isGoogleAuth) {
			if (!validated.password) {
				return {
					success: false,
					error: "Senha é obrigatória para confirmar a alteração",
				};
			}

			// Buscar hash da senha no registro de credencial
			const credentialAccount = await db
				.select({ password: account.password })
				.from(account)
				.where(
					and(
						eq(account.userId, session.user.id),
						eq(account.providerId, "credential"),
					),
				)
				.limit(1);

			const storedHash = credentialAccount[0]?.password;
			if (!storedHash) {
				return {
					success: false,
					error: "Conta de credencial não encontrada.",
				};
			}

			const isValid = await verifyPassword({
				password: validated.password,
				hash: storedHash,
			});

			if (!isValid) {
				return {
					success: false,
					error: "Senha incorreta",
				};
			}
		}

		// Verificar se o e-mail já está em uso por outro usuário
		const existingUser = await db.query.user.findFirst({
			where: and(
				eq(schema.user.email, validated.newEmail),
				ne(schema.user.id, session.user.id),
			),
		});

		if (existingUser) {
			return {
				success: false,
				error: "Este e-mail já está em uso",
			};
		}

		// Verificar se o novo e-mail é diferente do atual
		if (validated.newEmail.toLowerCase() === session.user.email.toLowerCase()) {
			return {
				success: false,
				error: "O novo e-mail deve ser diferente do atual",
			};
		}

		// Atualizar e-mail
		await db
			.update(schema.user)
			.set({
				email: validated.newEmail,
				emailVerified: false, // Marcar como não verificado
			})
			.where(eq(schema.user.id, session.user.id));

		// Revalidar o layout do dashboard para atualizar a sidebar
		revalidatePath("/", "layout");

		return {
			success: true,
			message:
				"E-mail atualizado com sucesso. Por favor, verifique seu novo e-mail.",
		};
	} catch (error) {
		if (error instanceof z.ZodError) {
			return {
				success: false,
				error: error.issues[0]?.message || "Dados inválidos",
			};
		}

		console.error("Erro ao atualizar e-mail:", error);
		return {
			success: false,
			error: "Erro ao atualizar e-mail. Tente novamente.",
		};
	}
}

export async function deleteAccountAction(
	data: z.infer<typeof deleteAccountSchema>,
): Promise<ActionResponse> {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user?.id) {
			return {
				success: false,
				error: "Não autenticado",
			};
		}

		// Validar confirmação
		deleteAccountSchema.parse(data);

		// Deletar todos os dados do usuário em cascade
		// O schema deve ter as relações configuradas com onDelete: cascade
		await db.delete(schema.user).where(eq(schema.user.id, session.user.id));

		return {
			success: true,
			message: "Conta deletada com sucesso.",
		};
	} catch (error) {
		if (error instanceof z.ZodError) {
			return {
				success: false,
				error: error.issues[0]?.message || "Dados inválidos",
			};
		}

		console.error("Erro ao deletar financialAccount:", error);
		return {
			success: false,
			error: "Erro ao deletar conta. Tente novamente.",
		};
	}
}

export async function resetAccountAction(
	data: z.infer<typeof resetAccountSchema>,
): Promise<ActionResponse> {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user?.id) {
			return {
				success: false,
				error: "Não autenticado",
			};
		}

		resetAccountSchema.parse(data);

		const currentUser = await db.query.user.findFirst({
			columns: {
				name: true,
				email: true,
				image: true,
			},
			where: eq(schema.user.id, session.user.id),
		});

		if (!currentUser) {
			return {
				success: false,
				error: "Usuário não encontrado.",
			};
		}

		await resetUserAppData(session.user.id, currentUser);

		revalidateForEntity("accounts", session.user.id);
		revalidateForEntity("cards", session.user.id);
		revalidateForEntity("categories", session.user.id);
		revalidateForEntity("budgets", session.user.id);
		revalidateForEntity("payers", session.user.id);
		revalidateForEntity("parties", session.user.id);
		revalidateForEntity("notes", session.user.id);
		revalidateForEntity("transactions", session.user.id);
		revalidateForEntity("inbox", session.user.id);
		revalidateForEntity("financialTitles", session.user.id);
		revalidatePath("/settings");
		revalidatePath("/insights");
		revalidatePath("/reports");
		revalidatePath("/calendar");
		revalidatePath("/", "layout");

		return {
			success: true,
			message: "Conta zerada com sucesso.",
		};
	} catch (error) {
		if (error instanceof z.ZodError) {
			return {
				success: false,
				error: error.issues[0]?.message || "Dados inválidos",
			};
		}

		console.error("Erro ao zerar conta:", error);
		return {
			success: false,
			error: "Erro ao zerar conta. Tente novamente.",
		};
	}
}

export async function updatePreferencesAction(
	data: z.infer<typeof updatePreferencesSchema>,
): Promise<ActionResponse> {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user?.id) {
			return {
				success: false,
				error: "Não autenticado",
			};
		}

		const validated = updatePreferencesSchema.parse(data);

		// Check if preferences exist, if not create them
		const existingResult = await db
			.select()
			.from(schema.userPreferences)
			.where(eq(schema.userPreferences.userId, session.user.id))
			.limit(1);

		const existing = existingResult[0] || null;

		if (existing) {
			// Update existing preferences
			await db
				.update(schema.userPreferences)
				.set({
					statementNoteAsColumn: validated.statementNoteAsColumn,
					transactionsColumnOrder: validated.transactionsColumnOrder,
					attachmentMaxSizeMb: validated.attachmentMaxSizeMb,
					showTransactionSummary: validated.showTransactionSummary,
					hideAnticipatedInstallments: validated.hideAnticipatedInstallments,
					updatedAt: new Date(),
				})
				.where(eq(schema.userPreferences.userId, session.user.id));
		} else {
			// Create new preferences
			await db.insert(schema.userPreferences).values({
				userId: session.user.id,
				statementNoteAsColumn: validated.statementNoteAsColumn,
				transactionsColumnOrder: validated.transactionsColumnOrder,
				attachmentMaxSizeMb: validated.attachmentMaxSizeMb,
				showTransactionSummary: validated.showTransactionSummary,
				hideAnticipatedInstallments: validated.hideAnticipatedInstallments,
			});
		}

		// Revalidar o layout do dashboard
		revalidatePath("/", "layout");

		return {
			success: true,
			message: "Preferências atualizadas com sucesso",
		};
	} catch (error) {
		if (error instanceof z.ZodError) {
			return {
				success: false,
				error: error.issues[0]?.message || "Dados inválidos",
			};
		}

		console.error("Erro ao atualizar preferências:", error);
		return {
			success: false,
			error: "Erro ao atualizar preferências. Tente novamente.",
		};
	}
}

export async function updateBrandingColorAction(data: {
	primaryColorHex: string | null;
}): Promise<ActionResponse<{ primaryColorHex: string }>> {
	try {
		await getUser();
		const validated = updateBrandingColorSchema.parse(data);
		const normalized =
			validated.primaryColorHex === null
				? DEFAULT_PRIMARY_COLOR_HEX
				: normalizePrimaryColorHex(validated.primaryColorHex);

		if (!normalized) {
			return {
				success: false,
				error: "Informe uma cor hexadecimal válida.",
			};
		}

		await upsertBrandingSettings({
			primaryColorHex:
				normalized === DEFAULT_PRIMARY_COLOR_HEX ? null : normalized,
		});

		revalidateBranding();

		return {
			success: true,
			message: "Cor principal atualizada com sucesso",
			data: { primaryColorHex: normalized },
		};
	} catch (error) {
		if (error instanceof z.ZodError) {
			return {
				success: false,
				error: error.issues[0]?.message || "Dados inválidos",
			};
		}

		console.error("Erro ao atualizar cor principal:", error);
		return {
			success: false,
			error: "Erro ao atualizar cor principal. Tente novamente.",
		};
	}
}

export async function saveBrandingLogoAction(
	formData: FormData,
): Promise<ActionResponse> {
	try {
		await getUser();
		const logo = formData.get("logo");

		if (!(logo instanceof File)) {
			return {
				success: false,
				error: "Selecione um arquivo de logo.",
			};
		}

		const preparedLogo = await prepareBrandingLogoForStorage(logo);

		await upsertBrandingSettings({
			logoContentBase64: preparedLogo.logoContentBase64,
			logoFileName: preparedLogo.logoFileName,
			logoMimeType: preparedLogo.logoMimeType,
			logoFileSize: preparedLogo.logoFileSize,
		});

		revalidateBranding();

		return {
			success: true,
			message: "Logo atualizada com sucesso",
		};
	} catch (error) {
		if (error instanceof BrandingLogoValidationError) {
			return {
				success: false,
				error: error.message,
			};
		}

		console.error("Erro ao salvar logo:", error);
		return {
			success: false,
			error: "Erro ao salvar logo. Tente novamente.",
		};
	}
}

export async function resetBrandingLogoAction(): Promise<ActionResponse> {
	try {
		await getUser();

		await upsertBrandingSettings({
			logoContentBase64: null,
			logoFileName: null,
			logoMimeType: null,
			logoFileSize: null,
		});

		revalidateBranding();

		return {
			success: true,
			message: "Logo padrão restaurada com sucesso",
		};
	} catch (error) {
		console.error("Erro ao restaurar logo padrão:", error);
		return {
			success: false,
			error: "Erro ao restaurar logo padrão. Tente novamente.",
		};
	}
}

// API Token Actions

const createApiTokenSchema = z.object({
	name: z.string().min(1, "Nome do dispositivo é obrigatório").max(100),
});

const revokeApiTokenSchema = z.object({
	tokenId: z.string().uuid("ID do token inválido"),
});

function generateSecureToken(): string {
	const prefix = "opm";
	const randomPart = randomBytes(32).toString("base64url");
	return `${prefix}_${randomPart}`;
}

function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

export async function createApiTokenAction(
	data: z.infer<typeof createApiTokenSchema>,
): Promise<ActionResponse<{ token: string; tokenId: string }>> {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user?.id) {
			return {
				success: false,
				error: "Não autenticado",
			};
		}

		const validated = createApiTokenSchema.parse(data);

		// Generate token
		const token = generateSecureToken();
		const tokenHash = hashToken(token);
		const tokenPrefix = token.substring(0, 10);

		// Save to database
		const [newToken] = await db
			.insert(apiTokens)
			.values({
				userId: session.user.id,
				name: validated.name,
				tokenHash,
				tokenPrefix,
				expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 ano
			})
			.returning({ id: apiTokens.id });

		revalidatePath("/settings");

		return {
			success: true,
			message: "Token criado com sucesso",
			data: {
				token,
				tokenId: newToken.id,
			},
		};
	} catch (error) {
		if (error instanceof z.ZodError) {
			return {
				success: false,
				error: error.issues[0]?.message || "Dados inválidos",
			};
		}

		console.error("Erro ao criar token:", error);
		return {
			success: false,
			error: "Erro ao criar token. Tente novamente.",
		};
	}
}

export async function revokeApiTokenAction(
	data: z.infer<typeof revokeApiTokenSchema>,
): Promise<ActionResponse> {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user?.id) {
			return {
				success: false,
				error: "Não autenticado",
			};
		}

		const validated = revokeApiTokenSchema.parse(data);

		// Find token and verify ownership
		const [existingToken] = await db
			.select()
			.from(apiTokens)
			.where(
				and(
					eq(apiTokens.id, validated.tokenId),
					eq(apiTokens.userId, session.user.id),
					isNull(apiTokens.revokedAt),
				),
			)
			.limit(1);

		if (!existingToken) {
			return {
				success: false,
				error: "Token não encontrado",
			};
		}

		// Revoke token
		await db
			.update(apiTokens)
			.set({
				revokedAt: new Date(),
			})
			.where(
				and(
					eq(apiTokens.id, validated.tokenId),
					eq(apiTokens.userId, session.user.id),
				),
			);

		revalidatePath("/settings");

		return {
			success: true,
			message: "Token revogado com sucesso",
		};
	} catch (error) {
		if (error instanceof z.ZodError) {
			return {
				success: false,
				error: error.issues[0]?.message || "Dados inválidos",
			};
		}

		console.error("Erro ao revogar token:", error);
		return {
			success: false,
			error: "Erro ao revogar token. Tente novamente.",
		};
	}
}

export async function saveIntegrationMappingAction(
	data: z.infer<typeof saveIntegrationMappingSchema>,
): Promise<ActionResponse> {
	try {
		const user = await getUser();
		const validated = saveIntegrationMappingSchema.parse(data);
		const profileScope = normalizeOptionalText(validated.profileKey) ?? "";
		const externalKey = validated.externalKey.trim();
		const now = new Date();

		if (validated.entityType === "account") {
			const existingAccount = await db.query.financialAccounts.findFirst({
				where: and(
					eq(schema.financialAccounts.id, validated.targetId),
					eq(schema.financialAccounts.userId, user.id),
				),
			});

			if (!existingAccount) {
				return { success: false, error: "Conta não encontrada." };
			}

			await db
				.insert(schema.integrationAccountMappings)
				.values({
					userId: user.id,
					sourceApp: validated.sourceApp.trim(),
					profileKey: profileScope,
					externalKey,
					accountId: validated.targetId,
					updatedAt: now,
				})
				.onConflictDoUpdate({
					target: [
						schema.integrationAccountMappings.userId,
						schema.integrationAccountMappings.sourceApp,
						schema.integrationAccountMappings.profileKey,
						schema.integrationAccountMappings.externalKey,
					],
					set: {
						accountId: sql`excluded.account_id`,
						updatedAt: sql`excluded.updated_at`,
					},
				});
		} else if (validated.entityType === "party") {
			const existingParty = await db.query.parties.findFirst({
				where: and(
					eq(schema.parties.id, validated.targetId),
					eq(schema.parties.userId, user.id),
				),
			});

			if (!existingParty) {
				return { success: false, error: "Cliente/fornecedor não encontrado." };
			}

			await db
				.insert(schema.integrationPartyMappings)
				.values({
					userId: user.id,
					sourceApp: validated.sourceApp.trim(),
					profileKey: profileScope,
					externalKey,
					partyId: validated.targetId,
					updatedAt: now,
				})
				.onConflictDoUpdate({
					target: [
						schema.integrationPartyMappings.userId,
						schema.integrationPartyMappings.sourceApp,
						schema.integrationPartyMappings.profileKey,
						schema.integrationPartyMappings.externalKey,
					],
					set: {
						partyId: sql`excluded.party_id`,
						updatedAt: sql`excluded.updated_at`,
					},
				});
		} else {
			const existingCategory = await db.query.categories.findFirst({
				where: and(
					eq(schema.categories.id, validated.targetId),
					eq(schema.categories.userId, user.id),
				),
			});

			if (!existingCategory) {
				return { success: false, error: "Categoria não encontrada." };
			}

			await db
				.insert(schema.integrationCategoryMappings)
				.values({
					userId: user.id,
					sourceApp: validated.sourceApp.trim(),
					profileKey: profileScope,
					externalKey,
					categoryId: validated.targetId,
					updatedAt: now,
				})
				.onConflictDoUpdate({
					target: [
						schema.integrationCategoryMappings.userId,
						schema.integrationCategoryMappings.sourceApp,
						schema.integrationCategoryMappings.profileKey,
						schema.integrationCategoryMappings.externalKey,
					],
					set: {
						categoryId: sql`excluded.category_id`,
						updatedAt: sql`excluded.updated_at`,
					},
				});
		}

		await syncPendingInboxItemsForMapping({
			userId: user.id,
			entityType: validated.entityType,
			sourceApp: validated.sourceApp.trim(),
			profileKey: profileScope,
			externalKey,
			targetId: validated.targetId,
		});

		revalidatePath("/settings");
		revalidateForEntity("inbox", user.id);

		return {
			success: true,
			message: "Mapeamento salvo com sucesso.",
		};
	} catch (error) {
		if (error instanceof z.ZodError) {
			return {
				success: false,
				error: error.issues[0]?.message || "Dados inválidos",
			};
		}

		console.error("Erro ao salvar mapeamento:", error);
		return {
			success: false,
			error: "Erro ao salvar mapeamento. Tente novamente.",
		};
	}
}

export async function deleteIntegrationMappingAction(
	data: z.infer<typeof deleteIntegrationMappingSchema>,
): Promise<ActionResponse> {
	try {
		const user = await getUser();
		const validated = deleteIntegrationMappingSchema.parse(data);
		const sourceApp = validated.sourceApp.trim();
		const profileScope = normalizeOptionalText(validated.profileKey) ?? "";
		const externalKey = validated.externalKey.trim();

		if (validated.entityType === "account") {
			await db
				.delete(schema.integrationAccountMappings)
				.where(
					and(
						eq(schema.integrationAccountMappings.userId, user.id),
						eq(schema.integrationAccountMappings.sourceApp, sourceApp),
						eq(schema.integrationAccountMappings.profileKey, profileScope),
						eq(schema.integrationAccountMappings.externalKey, externalKey),
					),
				);
		} else if (validated.entityType === "party") {
			await db
				.delete(schema.integrationPartyMappings)
				.where(
					and(
						eq(schema.integrationPartyMappings.userId, user.id),
						eq(schema.integrationPartyMappings.sourceApp, sourceApp),
						eq(schema.integrationPartyMappings.profileKey, profileScope),
						eq(schema.integrationPartyMappings.externalKey, externalKey),
					),
				);
		} else {
			await db
				.delete(schema.integrationCategoryMappings)
				.where(
					and(
						eq(schema.integrationCategoryMappings.userId, user.id),
						eq(schema.integrationCategoryMappings.sourceApp, sourceApp),
						eq(schema.integrationCategoryMappings.profileKey, profileScope),
						eq(schema.integrationCategoryMappings.externalKey, externalKey),
					),
				);
		}

		revalidatePath("/settings");

		return {
			success: true,
			message: "Mapeamento removido.",
		};
	} catch (error) {
		if (error instanceof z.ZodError) {
			return {
				success: false,
				error: error.issues[0]?.message || "Dados inválidos",
			};
		}

		console.error("Erro ao remover mapeamento:", error);
		return {
			success: false,
			error: "Erro ao remover mapeamento. Tente novamente.",
		};
	}
}

async function syncPendingInboxItemsForMapping({
	userId,
	entityType,
	sourceApp,
	profileKey,
	externalKey,
	targetId,
}: {
	userId: string;
	entityType: "account" | "party" | "category";
	sourceApp: string;
	profileKey: string;
	externalKey: string;
	targetId: string;
}) {
	const pendingItems = await db.query.inboxItems.findMany({
		where: and(
			eq(schema.inboxItems.userId, userId),
			eq(schema.inboxItems.status, "pending"),
			eq(schema.inboxItems.sourceApp, sourceApp),
			entityType === "account"
				? eq(schema.inboxItems.accountExternalKey, externalKey)
				: entityType === "party"
					? eq(schema.inboxItems.partyExternalKey, externalKey)
					: eq(schema.inboxItems.categoryExternalKey, externalKey),
			profileKey
				? eq(schema.inboxItems.profileKey, profileKey)
				: isNull(schema.inboxItems.profileKey),
		),
	});

	for (const item of pendingItems) {
		const nextAccountId =
			entityType === "account" ? (item.accountId ?? targetId) : item.accountId;
		const nextPartyId =
			entityType === "party" ? (item.partyId ?? targetId) : item.partyId;
		const nextCategoryId =
			entityType === "category"
				? (item.categoryId ?? targetId)
				: item.categoryId;

		await db
			.update(schema.inboxItems)
			.set({
				accountId: nextAccountId,
				partyId: nextPartyId,
				categoryId: nextCategoryId,
				updatedAt: new Date(),
			})
			.where(eq(schema.inboxItems.id, item.id));

		if (item.autoImportRequested) {
			await reprocessPendingInboxItem({
				userId,
				inboxItemId: item.id,
			});
		}
	}
}
