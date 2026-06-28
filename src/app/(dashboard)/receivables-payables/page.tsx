import { connection } from "next/server";
import { ReceivablesPayablesPage } from "@/features/receivables-payables/components/receivables-payables-page";
import { fetchFinancialTitlesPage } from "@/features/receivables-payables/queries";
import {
	getSingleParam,
	type ResolvedSearchParams,
} from "@/features/transactions/lib/page-helpers";
import MonthNavigation from "@/shared/components/month-picker/month-navigation";
import { getUserId } from "@/shared/lib/auth/server";
import { parsePeriodParam } from "@/shared/utils/period";

type PageSearchParams = Promise<ResolvedSearchParams>;

type PageProps = {
	searchParams?: PageSearchParams;
};

export default async function Page({ searchParams }: PageProps) {
	await connection();
	const userId = await getUserId();
	const resolvedSearchParams = searchParams ? await searchParams : undefined;
	const periodoParam = getSingleParam(resolvedSearchParams, "periodo");
	const { period } = parsePeriodParam(periodoParam);
	const data = await fetchFinancialTitlesPage({
		userId,
		period,
		searchParams: resolvedSearchParams,
	});

	return (
		<main className="flex flex-col gap-6">
			<MonthNavigation />
			<ReceivablesPayablesPage {...data} />
		</main>
	);
}
