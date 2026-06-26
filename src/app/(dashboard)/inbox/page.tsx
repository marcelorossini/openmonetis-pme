import { connection } from "next/server";
import { InboxPage } from "@/features/inbox/components/inbox-page";
import {
	type ResolvedInboxSearchParams,
	resolveInboxApp,
	resolveInboxPagination,
	resolveInboxStatus,
} from "@/features/inbox/page-helpers";
import {
	fetchAppLogoMap,
	fetchInboxDialogData,
	fetchInboxItemsPage,
	fetchInboxSourceApps,
	fetchInboxStatusCounts,
} from "@/features/inbox/queries";
import { getUserId } from "@/shared/lib/auth/server";

type PageSearchParams = Promise<ResolvedInboxSearchParams>;

type PageProps = {
	searchParams?: PageSearchParams;
};

const EMPTY_DIALOG_DATA = {
	payerOptions: [],
	splitPayerOptions: [],
	defaultPayerId: null,
	clientOptions: [],
	accountOptions: [],
	cardOptions: [],
	categoryOptions: [],
	estabelecimentos: [],
};

export default async function Page({ searchParams }: PageProps) {
	await connection();
	const userId = await getUserId();
	const resolvedSearchParams = searchParams ? await searchParams : undefined;
	const activeStatus = resolveInboxStatus(resolvedSearchParams);
	const activeApp = resolveInboxApp(resolvedSearchParams);
	const paginationInput = resolveInboxPagination(resolvedSearchParams);

	const [itemsPage, counts, sourceApps, dialogData, appLogoMap] =
		await Promise.all([
			fetchInboxItemsPage(userId, activeStatus, {
				...paginationInput,
				sourceApp: activeApp,
			}),
			fetchInboxStatusCounts(userId),
			fetchInboxSourceApps(userId, activeStatus).catch(() => [] as string[]),
			activeStatus === "pending"
				? fetchInboxDialogData(userId)
				: Promise.resolve(EMPTY_DIALOG_DATA),
			fetchAppLogoMap(userId),
		]);

	const normalizedSourceApps = Array.isArray(sourceApps) ? sourceApps : [];

	return (
		<main className="flex flex-col gap-6">
			<InboxPage
				activeStatus={activeStatus}
				activeApp={activeApp}
				sourceApps={normalizedSourceApps}
				items={itemsPage.items}
				counts={counts}
				pagination={itemsPage.pagination}
				payerOptions={dialogData.payerOptions}
				splitPayerOptions={dialogData.splitPayerOptions}
				defaultPayerId={dialogData.defaultPayerId}
				clientOptions={dialogData.clientOptions}
				accountOptions={dialogData.accountOptions}
				cardOptions={dialogData.cardOptions}
				categoryOptions={dialogData.categoryOptions}
				estabelecimentos={dialogData.estabelecimentos}
				appLogoMap={appLogoMap}
			/>
		</main>
	);
}
