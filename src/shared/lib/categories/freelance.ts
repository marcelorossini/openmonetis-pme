import { slugify } from "@/shared/utils/string";
import {
	FREELANCE_CATEGORY_NAME,
	LEGACY_FREELANCE_CATEGORY_NAME,
} from "./constants";

type CategoryCandidate = {
	name?: string | null;
	type?: string | null;
	group?: string | null;
};

export function isFreelanceIncomeCategory(
	category: CategoryCandidate | null | undefined,
) {
	if (!category?.name) {
		return false;
	}

	const categoryType = category.type ?? category.group;
	const categoryName = slugify(category.name);
	const eligibleCategoryNames = [
		FREELANCE_CATEGORY_NAME,
		LEGACY_FREELANCE_CATEGORY_NAME,
	].map(slugify);

	return (
		eligibleCategoryNames.includes(categoryName) &&
		slugify(categoryType ?? "") === "receita"
	);
}
