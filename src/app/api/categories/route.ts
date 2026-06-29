import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertCategoryFromApi } from "@/features/categories/actions";
import {
	categoriesApiCreateSchema,
	parseCategoriesApiListSearchParams,
} from "@/features/categories/lib/api-contract";
import { CategoryServiceError } from "@/features/categories/lib/service";
import { fetchCategoriesForApi } from "@/features/categories/queries";
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
		const filters = parseCategoriesApiListSearchParams(
			new URL(request.url).searchParams,
		);
		const result = await fetchCategoriesForApi(auth.data.userId, filters);

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

		console.error("[API] Error listing categories:", error);
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
		const input = categoriesApiCreateSchema.parse(body);
		const result = await upsertCategoryFromApi({
			userId: auth.data.userId,
			input,
		});

		revalidateForEntity("categories", auth.data.userId);

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

		if (error instanceof CategoryServiceError) {
			return buildErrorResponse(error.message, error.status);
		}

		console.error("[API] Error upserting category:", error);
		return buildErrorResponse("Algo deu errado.", 500);
	}
}
