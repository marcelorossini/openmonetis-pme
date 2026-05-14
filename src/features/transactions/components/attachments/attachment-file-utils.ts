import {
	ALLOWED_MIME_TYPES,
	DEFAULT_MAX_FILE_SIZE_MB,
} from "@/features/transactions/lib/attachments-config";

type AttachmentValidationResult = { ok: true } | { ok: false; error: string };

export function validateAttachmentFile(
	file: File,
	maxSizeMb = DEFAULT_MAX_FILE_SIZE_MB,
): AttachmentValidationResult {
	if (
		!ALLOWED_MIME_TYPES.includes(
			file.type as (typeof ALLOWED_MIME_TYPES)[number],
		)
	) {
		return {
			ok: false,
			error:
				"Tipo de arquivo não suportado. Use PDF ou imagem (JPEG, PNG, WebP).",
		};
	}

	const maxFileSizeBytes = maxSizeMb * 1024 * 1024;
	if (file.size > maxFileSizeBytes) {
		return { ok: false, error: `O arquivo deve ter no máximo ${maxSizeMb}MB.` };
	}

	return { ok: true };
}

type ClipboardLikeEvent = ClipboardEvent | React.ClipboardEvent;

export function getFilesFromClipboard(event: ClipboardLikeEvent): File[] {
	const files = Array.from(event.clipboardData?.files ?? []);
	if (files.length > 0) return files;

	return Array.from(event.clipboardData?.items ?? [])
		.filter((item) => item.kind === "file")
		.map((item) => item.getAsFile())
		.filter((file): file is File => Boolean(file));
}

export function isTextEditingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;

	const tagName = target.tagName.toLowerCase();
	return (
		tagName === "input" ||
		tagName === "textarea" ||
		target.isContentEditable ||
		target.closest('[contenteditable="true"]') !== null
	);
}
