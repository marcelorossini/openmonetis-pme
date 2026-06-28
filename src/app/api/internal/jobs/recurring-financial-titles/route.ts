import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ensureRecurringFinancialTitleCoverage } from "@/features/receivables-payables/lib/recurring-series-service";

const JOB_SECRET_HEADER = "x-openmonetis-job-secret";

function compareSecrets(received: string, expected: string) {
	const receivedBuffer = Buffer.from(received);
	const expectedBuffer = Buffer.from(expected);

	if (receivedBuffer.length !== expectedBuffer.length) {
		return false;
	}

	return timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function POST(request: Request) {
	const expectedSecret = process.env.JOBS_SECRET?.trim();
	if (expectedSecret) {
		const receivedSecret = request.headers.get(JOB_SECRET_HEADER)?.trim() ?? "";
		if (!receivedSecret || !compareSecrets(receivedSecret, expectedSecret)) {
			return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
		}
	}

	try {
		const result = await ensureRecurringFinancialTitleCoverage();

		return NextResponse.json({
			ok: true,
			job: "recurring-financial-titles",
			createdCount: result.createdCount,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Recurring financial titles job failed:", error);
		return NextResponse.json({ error: "Algo deu errado." }, { status: 500 });
	}
}
