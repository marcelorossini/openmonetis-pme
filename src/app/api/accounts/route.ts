import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertAccountFromApi } from "@/features/accounts/actions";
import {
	accountsApiCreateSchema,
	parseAccountsApiListSearchParams,
} from "@/features/accounts/lib/api-contract";
import { fetchAccountsForApi } from "@/features/accounts/queries";
import { revalidateForEntity } from "@/shared/lib/actions/helpers";
import { authenticateApiTokenRequest } from "@/shared/lib/auth/api-token-server";

const PRIVATE_RESPONSE_HEADERS = {
	"Cache-Control": "private, no-store",
};

function buildErrorResponse(error: string, status: number) {
	return NextResponse.json(
		{ error },
		{ status, headers: PRIVATE_RESPONSE_HEADERS },
	);
}

export async function GET(request: Request) {
	const auth = await authenticateApiTokenRequest(request);
	if (!auth.ok) {
		return buildErrorResponse(auth.error, auth.status);
	}

	try {
		const filters = parseAccountsApiListSearchParams(
			new URL(request.url).searchParams,
		);
		const result = await fetchAccountsForApi(auth.data.userId, filters);

		return NextResponse.json(result, {
			headers: PRIVATE_RESPONSE_HEADERS,
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return buildErrorResponse(
				error.issues[0]?.message ?? "Dados inválidos",
				400,
			);
		}

		console.error("[API] Error listing accounts:", error);
		return buildErrorResponse("Algo deu errado.", 500);
	}
}

export async function POST(request: Request) {
	const auth = await authenticateApiTokenRequest(request);
	if (!auth.ok) {
		return buildErrorResponse(auth.error, auth.status);
	}

	try {
		const body = await request.json();
		const input = accountsApiCreateSchema.parse(body);
		const result = await upsertAccountFromApi({
			userId: auth.data.userId,
			input,
		});

		revalidateForEntity("accounts", auth.data.userId);

		return NextResponse.json(result, {
			status: result.mode === "created" ? 201 : 200,
			headers: PRIVATE_RESPONSE_HEADERS,
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return buildErrorResponse(
				error.issues[0]?.message ?? "Dados inválidos",
				400,
			);
		}

		console.error("[API] Error upserting account:", error);
		return buildErrorResponse("Algo deu errado.", 500);
	}
}
