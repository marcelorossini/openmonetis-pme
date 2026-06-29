export const CATEGORY_TYPES = ["receita", "despesa"] as const;

export const INVOICE_PAYMENT_CATEGORY_NAME = "Pagamentos";
export const PROTECTED_CATEGORY_NAMES = [
	"Transferência interna",
	"Saldo inicial",
	INVOICE_PAYMENT_CATEGORY_NAME,
] as const;

export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const CATEGORY_TYPE_LABEL: Record<CategoryType, string> = {
	receita: "Receita",
	despesa: "Despesa",
};

export function isProtectedCategoryName(name: string) {
	return PROTECTED_CATEGORY_NAMES.includes(
		name as (typeof PROTECTED_CATEGORY_NAMES)[number],
	);
}
