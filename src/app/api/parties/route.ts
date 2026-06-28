import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertPartyFromApi } from "@/features/parties/actions";
import {
	parsePartiesApiListSearchParams,
	partiesApiCreateSchema,
} from "@/features/parties/lib/api-contract";
import { fetchPartiesForApi } from "@/features/parties/queries";
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
		const filters = parsePartiesApiListSearchParams(
			new URL(request.url).searchParams,
		);
		const result = await fetchPartiesForApi(auth.data.userId, filters);

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

		console.error("[API] Error listing parties:", error);
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
		const input = partiesApiCreateSchema.parse(body);
		const result = await upsertPartyFromApi({
			userId: auth.data.userId,
			input,
		});

		revalidateForEntity("parties", auth.data.userId);

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

		console.error("[API] Error upserting party:", error);
		return buildErrorResponse("Algo deu errado.", 500);
	}
}
