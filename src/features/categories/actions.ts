"use server";

import {
	type CreateCategoryInput,
	createCategoryInputSchema,
	type DeleteCategoryInput,
	deleteCategoryInputSchema,
	type UpdateCategoryInput,
	updateCategoryInputSchema,
} from "@/features/categories/lib/schemas";
import {
	CategoryServiceError,
	createCategoryForUser,
	deleteCategoryFromApi as deleteCategoryFromApiService,
	updateCategoryForUser,
	updateCategoryFromApi as updateCategoryFromApiService,
	upsertCategoryFromApi as upsertCategoryFromApiService,
} from "@/features/categories/lib/service";
import {
	type ActionResult,
	handleActionError,
	revalidateForEntity,
} from "@/shared/lib/actions/helpers";
import { getUser } from "@/shared/lib/auth/server";

export async function createCategoryAction(
	input: CreateCategoryInput,
): Promise<ActionResult<{ id: string }>> {
	try {
		const user = await getUser();
		const data = createCategoryInputSchema.parse(input);
		const createdId = await createCategoryForUser(user.id, data);

		revalidateForEntity("categories", user.id);

		return {
			success: true,
			message: "Categoria criada com sucesso.",
			data: { id: createdId },
		};
	} catch (error) {
		return handleActionError(error) as ActionResult<{ id: string }>;
	}
}

export async function updateCategoryAction(
	input: UpdateCategoryInput,
): Promise<ActionResult> {
	try {
		const user = await getUser();
		const data = updateCategoryInputSchema.parse(input);
		const updated = await updateCategoryForUser(user.id, data.id, data);

		if (!updated) {
			return {
				success: false,
				error: "Categoria não encontrada.",
			};
		}

		revalidateForEntity("categories", user.id);

		return { success: true, message: "Categoria atualizada com sucesso." };
	} catch (error) {
		if (error instanceof CategoryServiceError) {
			return { success: false, error: error.message };
		}

		return handleActionError(error);
	}
}

export async function deleteCategoryAction(
	input: DeleteCategoryInput,
): Promise<ActionResult> {
	try {
		const user = await getUser();
		const data = deleteCategoryInputSchema.parse(input);
		const deleted = await deleteCategoryFromApiService(user.id, data.id);

		if (!deleted) {
			return {
				success: false,
				error: "Categoria não encontrada.",
			};
		}

		revalidateForEntity("categories", user.id);

		return { success: true, message: "Categoria removida com sucesso." };
	} catch (error) {
		if (error instanceof CategoryServiceError) {
			return { success: false, error: error.message };
		}

		return handleActionError(error);
	}
}

export async function upsertCategoryFromApi({
	userId,
	input,
}: Parameters<typeof upsertCategoryFromApiService>[0]) {
	return upsertCategoryFromApiService({ userId, input });
}

export async function updateCategoryFromApi({
	userId,
	categoryId,
	input,
}: Parameters<typeof updateCategoryFromApiService>[0]) {
	return updateCategoryFromApiService({ userId, categoryId, input });
}

export async function deleteCategoryFromApi(
	userId: string,
	categoryId: string,
) {
	return deleteCategoryFromApiService(userId, categoryId);
}
