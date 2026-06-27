import { and, eq, gt, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiTokens } from "@/db/schema";
import { extractBearerToken, hashToken } from "@/shared/lib/auth/api-token";
import { db } from "@/shared/lib/db";
import { inboxItemSchema } from "@/shared/lib/schemas/inbox";
import { InboxApiValidationError, processInboxApiItem } from "./processing";

// Rate limiting simples em memória (em produção, use Redis)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100; // 100 requests
const RATE_WINDOW = 60 * 1000; // por minuto

function checkRateLimit(userId: string): boolean {
	const now = Date.now();
	const userLimit = rateLimitMap.get(userId);

	if (!userLimit || userLimit.resetAt < now) {
		rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
		return true;
	}

	if (userLimit.count >= RATE_LIMIT) {
		return false;
	}

	userLimit.count++;
	return true;
}

export async function POST(request: Request) {
	try {
		// Extrair token do header
		const authHeader = request.headers.get("Authorization");
		const token = extractBearerToken(authHeader);

		if (!token) {
			return NextResponse.json(
				{ error: "Token não fornecido" },
				{ status: 401 },
			);
		}

		// Validar token opm_xxx via hash
		if (!token.startsWith("opm_")) {
			return NextResponse.json(
				{ error: "Formato de token inválido" },
				{ status: 401 },
			);
		}

		const tokenHash = hashToken(token);

		// Buscar token no banco
		const tokenRecord = await db.query.apiTokens.findFirst({
			where: and(
				eq(apiTokens.tokenHash, tokenHash),
				isNull(apiTokens.revokedAt),
				gt(apiTokens.expiresAt, new Date()),
			),
		});

		if (!tokenRecord) {
			return NextResponse.json(
				{ error: "Token inválido ou revogado" },
				{ status: 401 },
			);
		}

		// Rate limiting
		if (!checkRateLimit(tokenRecord.userId)) {
			return NextResponse.json(
				{ error: "Limite de requisições excedido", retryAfter: 60 },
				{ status: 429 },
			);
		}

		// Validar body
		const body = await request.json();
		const data = inboxItemSchema.parse(body);

		const result = await processInboxApiItem({
			userId: tokenRecord.userId,
			data,
		});

		// Atualizar último uso do token
		const clientIp =
			request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
			request.headers.get("x-real-ip") ||
			null;

		await db
			.update(apiTokens)
			.set({
				lastUsedAt: new Date(),
				lastUsedIp: clientIp,
			})
			.where(eq(apiTokens.id, tokenRecord.id));

		return NextResponse.json(
			{
				id: result.serverId,
				clientId: data.clientId,
				message: result.autoImported
					? "Notificação importada automaticamente"
					: "Notificação recebida",
				status: result.status,
				autoImported: result.autoImported,
				transactionId: result.transactionId,
				autoImportError: result.autoImportError,
			},
			{ status: 201 },
		);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: error.issues[0]?.message ?? "Dados inválidos" },
				{ status: 400 },
			);
		}
		if (error instanceof InboxApiValidationError) {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}

		console.error("[API] Error creating inbox item:", error);
		return NextResponse.json(
			{ error: "Erro ao lançar notificação" },
			{ status: 500 },
		);
	}
}
