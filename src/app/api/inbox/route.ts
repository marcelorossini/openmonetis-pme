import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiTokenRequest } from "@/shared/lib/auth/api-token-server";
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
		const auth = await authenticateApiTokenRequest(request);
		if (!auth.ok) {
			return NextResponse.json({ error: auth.error }, { status: auth.status });
		}

		// Rate limiting
		if (!checkRateLimit(auth.data.userId)) {
			return NextResponse.json(
				{ error: "Limite de requisições excedido", retryAfter: 60 },
				{ status: 429 },
			);
		}

		// Validar body
		const body = await request.json();
		const data = inboxItemSchema.parse(body);

		const result = await processInboxApiItem({
			userId: auth.data.userId,
			data,
		});

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
				reconciliationStatus: result.reconciliationStatus,
				reconciledTitleId: result.reconciledTitleId,
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
