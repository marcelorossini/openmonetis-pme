import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiTokenRequest } from "@/shared/lib/auth/api-token-server";
import { inboxBatchSchema } from "@/shared/lib/schemas/inbox";
import { processInboxApiItem } from "../processing";

// Rate limiting simples em memória
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20; // 20 batch requests
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

interface BatchResult {
	clientId?: string;
	serverId?: string;
	success: boolean;
	status?: "pending" | "processed";
	autoImported?: boolean;
	transactionId?: string;
	autoImportError?: string;
	reconciliationStatus?: "reconciled" | "unmatched" | "ambiguous";
	reconciledTitleId?: string;
	error?: string;
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
		const { items } = inboxBatchSchema.parse(body);

		const settled = await Promise.allSettled(
			items.map((item) =>
				processInboxApiItem({
					userId: auth.data.userId,
					data: item,
				}),
			),
		);

		const results: BatchResult[] = settled.map((result, i) => {
			const item = items[i];
			if (result.status === "fulfilled") {
				return {
					...result.value,
				};
			}
			console.error("[API] Error processing batch item:", result.reason);
			return {
				clientId: item?.clientId,
				success: false,
				error: "Erro ao lançar notificação",
			};
		});

		const successCount = results.filter((r) => r.success).length;
		const failCount = results.filter((r) => !r.success).length;

		return NextResponse.json(
			{
				message: `${successCount} notificações processadas${failCount > 0 ? `, ${failCount} falharam` : ""}`,
				total: items.length,
				success: successCount,
				failed: failCount,
				results,
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

		console.error("[API] Error creating batch inbox items:", error);
		return NextResponse.json(
			{ error: "Erro ao lançar notificações" },
			{ status: 500 },
		);
	}
}
