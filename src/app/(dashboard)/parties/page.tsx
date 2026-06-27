import { connection } from "next/server";
import { PartiesPage } from "@/features/parties/components/parties-page";
import { fetchPartiesForUser } from "@/features/parties/queries";
import { getUserId } from "@/shared/lib/auth/server";

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

type PageProps = {
	searchParams?: PageSearchParams;
};

const getSingleParam = (
	params: Record<string, string | string[] | undefined> | undefined,
	key: string,
) => {
	const value = params?.[key];
	if (!value) return null;
	return Array.isArray(value) ? (value[0] ?? null) : value;
};

export default async function Page({ searchParams }: PageProps) {
	await connection();
	const userId = await getUserId();
	const resolvedSearchParams = searchParams ? await searchParams : undefined;
	const selectedPartyId = getSingleParam(resolvedSearchParams, "party");
	const parties = await fetchPartiesForUser(userId);

	return (
		<main className="flex flex-col gap-6">
			<PartiesPage parties={parties} selectedPartyId={selectedPartyId} />
		</main>
	);
}
