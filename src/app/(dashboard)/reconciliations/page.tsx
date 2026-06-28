import { ReconciliationsPage } from "@/features/reconciliations/components/page/reconciliations-page";
import { fetchReconciliationsPage } from "@/features/reconciliations/queries";
import type { ReconciliationFilterStatus } from "@/features/reconciliations/types";
import { getUser } from "@/shared/lib/auth/server";

const resolveStatus = (
	value: string | string[] | undefined,
): ReconciliationFilterStatus =>
	value === "unmatched" || value === "ambiguous" ? value : "all";

const resolvePage = (value: string | string[] | undefined) => {
	const raw = Array.isArray(value) ? value[0] : value;
	const parsed = Number(raw);
	return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
};

export default async function Page({
	searchParams,
}: {
	searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
	const user = await getUser();
	const resolvedSearchParams = searchParams ? await searchParams : undefined;
	const data = await fetchReconciliationsPage({
		userId: user.id,
		status: resolveStatus(resolvedSearchParams?.status),
		page: resolvePage(resolvedSearchParams?.page),
	});

	return <ReconciliationsPage {...data} />;
}
