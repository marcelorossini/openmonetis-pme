import { RiContactsBookLine } from "@remixicon/react";
import PageDescription from "@/shared/components/page-description";

export const metadata = {
	title: "Clientes e fornecedores",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<section className="space-y-6">
			<PageDescription
				icon={<RiContactsBookLine />}
				title="Clientes e fornecedores"
				subtitle="Organize os contatos que podem ser vinculados aos lançamentos por categoria."
			/>
			{children}
		</section>
	);
}
