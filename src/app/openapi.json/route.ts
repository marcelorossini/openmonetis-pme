import { NextResponse } from "next/server";
import { buildPublicOpenApiDocument } from "@/shared/lib/api-docs/openapi";

export async function GET() {
	return NextResponse.json(buildPublicOpenApiDocument(), {
		headers: {
			"Cache-Control": "public, max-age=0, must-revalidate",
		},
	});
}
