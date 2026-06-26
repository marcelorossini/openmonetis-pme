import { RiContactsBookLine } from "@remixicon/react";
import PageDescription from "@/shared/components/page-description";

export const metadata = {
	title: "Clientes",
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
				title="Clientes"
				subtitle="Organize receitas de serviços prestados por cliente."
			/>
			{children}
		</section>
	);
}
