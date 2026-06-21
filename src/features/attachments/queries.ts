import { and, desc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import {
	attachments,
	categories,
	payers,
	transactionAttachments,
	transactions,
} from "@/db/schema";
import { db } from "@/shared/lib/db";
import { getAdminPayerId } from "@/shared/lib/payers/get-admin-id";

export type AttachmentForPeriod = {
	attachmentId: string;
	fileName: string;
	fileSize: number;
	mimeType: string;
	transactionId: string;
	transactionName: string;
	transactionAmount: string;
	transactionPeriod: string;
	purchaseDate: Date;
	categoryName: string | null;
	categoryIcon: string | null;
	payerId: string;
	payerName: string;
	payerAvatarUrl: string | null;
};

export type AttachmentsPageData = {
	attachments: AttachmentForPeriod[];
	adminPayerId: string;
};

export async function fetchAttachmentsForPeriod(
	userId: string,
	period: string,
	payerScope?: string | "all",
): Promise<AttachmentForPeriod[]> {
	"use cache";
	cacheTag(`dashboard-${userId}`);
	cacheLife({ revalidate: 3 });

	const adminPayerId = await getAdminPayerId(userId);
	if (!adminPayerId) return [];
	const payerId = payerScope ?? adminPayerId;

	const rows = await db
		.select({
			attachmentId: attachments.id,
			fileName: attachments.fileName,
			fileSize: attachments.fileSize,
			mimeType: attachments.mimeType,
			transactionId: transactions.id,
			transactionName: transactions.name,
			transactionAmount: transactions.amount,
			transactionPeriod: transactions.period,
			purchaseDate: transactions.purchaseDate,
			categoryName: categories.name,
			categoryIcon: categories.icon,
			payerId: payers.id,
			payerName: payers.name,
			payerAvatarUrl: payers.avatarUrl,
		})
		.from(transactionAttachments)
		.innerJoin(
			attachments,
			and(
				eq(transactionAttachments.attachmentId, attachments.id),
				eq(attachments.userId, userId),
			),
		)
		.innerJoin(
			transactions,
			and(
				eq(transactionAttachments.transactionId, transactions.id),
				eq(transactions.userId, userId),
				eq(transactions.period, period),
				payerId === "all" ? undefined : eq(transactions.payerId, payerId),
			),
		)
		.innerJoin(
			payers,
			and(eq(transactions.payerId, payers.id), eq(payers.userId, userId)),
		)
		.leftJoin(
			categories,
			and(
				eq(transactions.categoryId, categories.id),
				eq(categories.userId, userId),
			),
		)
		.orderBy(desc(transactions.purchaseDate), desc(attachments.id));

	return rows;
}

export async function fetchAttachmentsPageData(
	userId: string,
	period: string,
): Promise<AttachmentsPageData | null> {
	const adminPayerId = await getAdminPayerId(userId);
	if (!adminPayerId) return null;
	const rows = await fetchAttachmentsForPeriod(userId, period, "all");
	return { attachments: rows, adminPayerId };
}
