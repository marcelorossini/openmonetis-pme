import { NextResponse } from "next/server";
import { authenticateApiTokenRequest } from "@/shared/lib/auth/api-token-server";

export async function POST(request: Request) {
	const auth = await authenticateApiTokenRequest(request);
	if (!auth.ok) {
		return NextResponse.json(
			{
				valid: false,
				error: auth.error,
			},
			{ status: auth.status },
		);
	}

	return NextResponse.json({
		valid: true,
		userId: auth.data.userId,
		tokenId: auth.data.tokenId,
		tokenName: auth.data.tokenName,
	});
}
