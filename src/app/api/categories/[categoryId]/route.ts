import { NextResponse } from "next/server";
import { z } from "zod";
import {
	deleteCategoryFromApi,
	updateCategoryFromApi,
} from "@/features/categories/actions";
import { categoriesApiUpdateSchema } from "@/features/categories/lib/api-contract";
import { CategoryServiceError } from "@/features/categories/lib/service";
import { fetchCategoryForApi } from "@/features/categories/queries";
import { revalidateForEntity } from "@/shared/lib/actions/helpers";
import { authenticateApiTokenRequest } from "@/shared/lib/auth/api-token-server";
import { uuidSchema } from "@/shared/lib/schemas/common";

const PRIVATE_RESPONSE_HEADERS = {
	"Cache-Control": "private, no-store",
};

function buildErrorResponse(error: string, status: number) {
	return NextResponse.json(
		{ error },
		{ status, headers: PRIVATE_RESPONSE_HEADERS },
	);
}

async function resolveCategoryId(params: Promise<{ categoryId: string }>) {
	const { categoryId } = await params;
	return uuidSchema("Categoria").parse(categoryId);
}

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ categoryId: string }> },
) {
	const auth = await authenticateApiTokenRequest(request);
	if (!auth.ok) {
		return buildErrorResponse(auth.error, auth.status);
	}

	try {
		const categoryId = await resolveCategoryId(params);
		const item = await fetchCategoryForApi(auth.data.userId, categoryId);

		if (!item) {
			return buildErrorResponse("Categoria não encontrada.", 404);
		}

		return NextResponse.json(item, {
			headers: PRIVATE_RESPONSE_HEADERS,
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return buildErrorResponse(
				error.issues[0]?.message ?? "Dados inválidos",
				400,
			);
		}

		console.error("[API] Error fetching category:", error);
		return buildErrorResponse("Algo deu errado.", 500);
	}
}

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ categoryId: string }> },
) {
	const auth = await authenticateApiTokenRequest(request);
	if (!auth.ok) {
		return buildErrorResponse(auth.error, auth.status);
	}

	try {
		const [categoryId, body] = await Promise.all([
			resolveCategoryId(params),
			request.json(),
		]);
		const input = categoriesApiUpdateSchema.parse(body);
		const item = await updateCategoryFromApi({
			userId: auth.data.userId,
			categoryId,
			input,
		});

		if (!item) {
			return buildErrorResponse("Categoria não encontrada.", 404);
		}

		revalidateForEntity("categories", auth.data.userId);

		return NextResponse.json(item, {
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

		console.error("[API] Error updating category:", error);
		return buildErrorResponse("Algo deu errado.", 500);
	}
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ categoryId: string }> },
) {
	const auth = await authenticateApiTokenRequest(request);
	if (!auth.ok) {
		return buildErrorResponse(auth.error, auth.status);
	}

	try {
		const categoryId = await resolveCategoryId(params);
		const item = await deleteCategoryFromApi(auth.data.userId, categoryId);

		if (!item) {
			return buildErrorResponse("Categoria não encontrada.", 404);
		}

		revalidateForEntity("categories", auth.data.userId);

		return NextResponse.json(item, {
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

		console.error("[API] Error deleting category:", error);
		return buildErrorResponse("Algo deu errado.", 500);
	}
}
