import { connection } from "next/server";
import { ClientsPage } from "@/features/clients/components/clients-page";
import { fetchClientsForUser } from "@/features/clients/queries";
import { getUserId } from "@/shared/lib/auth/server";

export default async function Page() {
	await connection();
	const userId = await getUserId();
	const clients = await fetchClientsForUser(userId);

	return (
		<main className="flex flex-col gap-6">
			<ClientsPage clients={clients} />
		</main>
	);
}
