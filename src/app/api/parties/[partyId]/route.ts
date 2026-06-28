import { NextResponse } from "next/server";
import { z } from "zod";
import {
	inactivatePartyForUser,
	updatePartyFromApi,
} from "@/features/parties/actions";
import { partiesApiUpdateSchema } from "@/features/parties/lib/api-contract";
import { fetchPartyForApi } from "@/features/parties/queries";
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

async function resolvePartyId(params: Promise<{ partyId: string }>) {
	const { partyId } = await params;
	return uuidSchema("Cliente/Fornecedor").parse(partyId);
}

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ partyId: string }> },
) {
	const auth = await authenticateApiTokenRequest(request);
	if (!auth.ok) {
		return buildErrorResponse(auth.error, auth.status);
	}

	try {
		const partyId = await resolvePartyId(params);
		const item = await fetchPartyForApi(auth.data.userId, partyId);

		if (!item) {
			return buildErrorResponse("Cadastro não encontrado.", 404);
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

		console.error("[API] Error fetching party:", error);
		return buildErrorResponse("Algo deu errado.", 500);
	}
}

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ partyId: string }> },
) {
	const auth = await authenticateApiTokenRequest(request);
	if (!auth.ok) {
		return buildErrorResponse(auth.error, auth.status);
	}

	try {
		const [partyId, body] = await Promise.all([
			resolvePartyId(params),
			request.json(),
		]);
		const input = partiesApiUpdateSchema.parse(body);
		const item = await updatePartyFromApi({
			userId: auth.data.userId,
			partyId,
			input,
		});

		if (!item) {
			return buildErrorResponse("Cadastro não encontrado.", 404);
		}

		revalidateForEntity("parties", auth.data.userId);

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

		console.error("[API] Error updating party:", error);
		return buildErrorResponse("Algo deu errado.", 500);
	}
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ partyId: string }> },
) {
	const auth = await authenticateApiTokenRequest(request);
	if (!auth.ok) {
		return buildErrorResponse(auth.error, auth.status);
	}

	try {
		const partyId = await resolvePartyId(params);
		const item = await inactivatePartyForUser(auth.data.userId, partyId);

		if (!item) {
			return buildErrorResponse("Cadastro não encontrado.", 404);
		}

		revalidateForEntity("parties", auth.data.userId);

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

		console.error("[API] Error inactivating party:", error);
		return buildErrorResponse("Algo deu errado.", 500);
	}
}
