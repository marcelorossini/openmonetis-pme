import { asc, eq } from "drizzle-orm";
import { categories } from "@/db/schema";
import { mapCategoryRowToCategory } from "@/features/categories/lib/service";
import { db } from "@/shared/lib/db";
import type { CategoryRecord } from "./lib/service";

export {
	fetchCategoriesForApi,
	fetchCategoryForApi,
} from "@/features/categories/lib/service";

export async function fetchCategoriesForUser(
	userId: string,
): Promise<CategoryRecord[]> {
	const categoryRows = await db.query.categories.findMany({
		where: eq(categories.userId, userId),
		orderBy: [asc(categories.name)],
	});

	return categoryRows.map(mapCategoryRowToCategory);
}
