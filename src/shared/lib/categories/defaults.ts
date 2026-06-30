import { eq } from "drizzle-orm";
import { categories } from "@/db/schema";
import type { CategoryType } from "@/shared/lib/categories/constants";
import type { CategoryPartyKind } from "@/shared/lib/categories/party-kind";
import { db } from "@/shared/lib/db";

type DefaultCategory = {
	name: string;
	type: CategoryType;
	icon: string | null;
	partyKind?: CategoryPartyKind | null;
};

type DefaultCategoryInsert = {
	name: string;
	type: CategoryType;
	icon: string | null;
	partyKind: CategoryPartyKind | null;
	userId: string;
};

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
	// Despesas
	{ name: "Pró-labore", type: "despesa", icon: "RiWallet3Line" },
	{ name: "Folha e encargos", type: "despesa", icon: "RiGroupLine" },
	{
		name: "Impostos e taxas",
		type: "despesa",
		icon: "RiArticleLine",
		partyKind: "fornecedor",
	},
	{
		name: "Contabilidade",
		type: "despesa",
		icon: "RiCalculatorLine",
		partyKind: "fornecedor",
	},
	{
		name: "Serviços terceirizados",
		type: "despesa",
		icon: "RiBriefcase4Line",
		partyKind: "fornecedor",
	},
	{
		name: "Marketing e publicidade",
		type: "despesa",
		icon: "RiMegaphoneLine",
		partyKind: "fornecedor",
	},
	{
		name: "Software e SaaS",
		type: "despesa",
		icon: "RiWindowLine",
		partyKind: "fornecedor",
	},
	{
		name: "Internet e telefonia",
		type: "despesa",
		icon: "RiWifiLine",
		partyKind: "fornecedor",
	},
	{
		name: "Equipamentos e informática",
		type: "despesa",
		icon: "RiComputerLine",
		partyKind: "fornecedor",
	},
	{
		name: "Materiais de escritório",
		type: "despesa",
		icon: "RiInboxArchiveLine",
		partyKind: "fornecedor",
	},
	{
		name: "Aluguel e condomínio",
		type: "despesa",
		icon: "RiHomeOfficeLine",
		partyKind: "fornecedor",
	},
	{
		name: "Energia e água",
		type: "despesa",
		icon: "RiFlashlightLine",
		partyKind: "fornecedor",
	},
	{
		name: "Serviços bancários",
		type: "despesa",
		icon: "RiBankCardLine",
		partyKind: "fornecedor",
	},
	{
		name: "Seguros",
		type: "despesa",
		icon: "RiShieldCheckLine",
		partyKind: "fornecedor",
	},
	{
		name: "Capacitação e cursos",
		type: "despesa",
		icon: "RiGraduationCapLine",
		partyKind: "fornecedor",
	},
	{
		name: "Viagens e hospedagem",
		type: "despesa",
		icon: "RiHotelLine",
		partyKind: "fornecedor",
	},
	{
		name: "Transporte e deslocamento",
		type: "despesa",
		icon: "RiBusLine",
		partyKind: "fornecedor",
	},
	{
		name: "Alimentação de trabalho",
		type: "despesa",
		icon: "RiRestaurant2Line",
		partyKind: "fornecedor",
	},
	{
		name: "Assinaturas",
		type: "despesa",
		icon: "RiServiceLine",
		partyKind: "fornecedor",
	},
	{ name: "Pagamentos", type: "despesa", icon: "RiBillLine" },
	{ name: "Outras despesas", type: "despesa", icon: "RiMore2Line" },

	// Receitas
	{
		name: "Serviços Prestados",
		type: "receita",
		icon: "RiUserStarLine",
		partyKind: "cliente",
	},
	{
		name: "Mensalidades e contratos",
		type: "receita",
		icon: "RiFileTextLine",
		partyKind: "cliente",
	},
	{
		name: "Vendas",
		type: "receita",
		icon: "RiShoppingCartLine",
		partyKind: "cliente",
	},
	{
		name: "Comissões",
		type: "receita",
		icon: "RiMedalLine",
		partyKind: "cliente",
	},
	{
		name: "Reembolso",
		type: "receita",
		icon: "RiRefundLine",
		partyKind: "cliente",
	},
	{
		name: "Rendimentos financeiros",
		type: "receita",
		icon: "RiFundsLine",
	},
	{ name: "Investimentos", type: "receita", icon: "RiStockLine" },
	{ name: "Outras receitas", type: "receita", icon: "RiMore2Line" },
	{ name: "Saldo inicial", type: "receita", icon: "RiWallet2Line" },

	// Category especial para transferências entre Contas
	{
		name: "Transferência interna",
		type: "receita",
		icon: "RiArrowLeftRightLine",
	},
];

export function buildDefaultCategoryValues(
	userId: string,
): DefaultCategoryInsert[] {
	return DEFAULT_CATEGORIES.map((category) => ({
		name: category.name,
		type: category.type,
		icon: category.icon,
		partyKind: category.partyKind ?? null,
		userId,
	}));
}

/**
 * Seeds default categories for a new user
 * @param userId - User ID to seed categories for
 */
export async function seedDefaultCategoriesForUser(userId: string | undefined) {
	if (!userId) {
		return;
	}

	const existing = await db.query.categories.findFirst({
		columns: { id: true },
		where: eq(categories.userId, userId),
	});

	if (existing) {
		return;
	}

	if (DEFAULT_CATEGORIES.length === 0) {
		return;
	}

	await db.insert(categories).values(buildDefaultCategoryValues(userId));
}
