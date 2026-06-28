import { and, eq, gt, isNull } from "drizzle-orm";
import { apiTokens } from "@/db/schema";
import { db } from "@/shared/lib/db";
import { extractBearerToken, hashToken } from "./api-token";

export type AuthenticatedApiToken = {
	userId: string;
	tokenId: string;
	tokenName: string;
};

export async function authenticateApiTokenRequest(
	request: Request,
): Promise<
	| { ok: true; data: AuthenticatedApiToken }
	| { ok: false; status: number; error: string }
> {
	try {
		const authHeader = request.headers.get("Authorization");
		const token = extractBearerToken(authHeader);

		if (!token) {
			return { ok: false, status: 401, error: "Token não fornecido" };
		}

		if (!token.startsWith("opm_")) {
			return { ok: false, status: 401, error: "Formato de token inválido" };
		}

		const tokenHash = hashToken(token);
		const tokenRecord = await db.query.apiTokens.findFirst({
			where: and(
				eq(apiTokens.tokenHash, tokenHash),
				isNull(apiTokens.revokedAt),
				gt(apiTokens.expiresAt, new Date()),
			),
		});

		if (!tokenRecord) {
			return { ok: false, status: 401, error: "Token inválido ou revogado" };
		}

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

		return {
			ok: true,
			data: {
				userId: tokenRecord.userId,
				tokenId: tokenRecord.id,
				tokenName: tokenRecord.name,
			},
		};
	} catch (error) {
		console.error("[API] Error authenticating token:", error);
		return { ok: false, status: 500, error: "Erro ao validar token" };
	}
}
