"use client";

import { RiAttachment2 } from "@remixicon/react";
import { useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import {
	confirmAttachmentUploadAction,
	getPresignedUploadUrlAction,
} from "@/features/transactions/actions/attachments";
import {
	ALLOWED_MIME_TYPES,
	DEFAULT_MAX_FILE_SIZE_MB,
} from "@/features/transactions/lib/attachments-config";
import {
	getFilesFromClipboard,
	isTextEditingTarget,
	validateAttachmentFile,
} from "./attachment-file-utils";

interface AttachmentUploadProps {
	transactionId: string;
	onUploaded: () => void;
	onPendingUpload?: (file: File) => void;
	maxSizeMb?: number;
}

export function AttachmentUpload({
	transactionId,
	onUploaded,
	onPendingUpload,
	maxSizeMb = DEFAULT_MAX_FILE_SIZE_MB,
}: AttachmentUploadProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isPending, startTransition] = useTransition();

	function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!inputRef.current) return;
		inputRef.current.value = "";

		if (!file) return;

		handleFile(file);
	}

	function handleFile(file: File) {
		const validation = validateAttachmentFile(file, maxSizeMb);
		if (!validation.ok) {
			toast.error(validation.error);
			return;
		}

		if (onPendingUpload) {
			onPendingUpload(file);
			return;
		}

		startTransition(async () => {
			const presignResult = await getPresignedUploadUrlAction({
				fileName: file.name,
				mimeType: file.type,
				fileSize: file.size,
				transactionId,
			});

			if (!presignResult.success) {
				toast.error(presignResult.error ?? "Erro ao iniciar upload.");
				return;
			}

			const uploadResponse = await fetch(presignResult.presignedUrl, {
				method: "PUT",
				body: file,
				headers: { "Content-Type": file.type },
			});

			if (!uploadResponse.ok) {
				toast.error("Erro ao enviar o arquivo. Tente novamente.");
				return;
			}

			const confirmResult = await confirmAttachmentUploadAction({
				uploadToken: presignResult.uploadToken,
			});

			if (confirmResult.success) {
				toast.success(confirmResult.message);
				onUploaded();
			} else {
				toast.error(confirmResult.error);
			}
		});
	}

	function handlePaste(event: React.ClipboardEvent<HTMLButtonElement>) {
		const [file] = getFilesFromClipboard(event);
		if (!file) return;

		event.preventDefault();
		handleFile(file);
	}

	useEffect(() => {
		function handleDocumentPaste(event: ClipboardEvent) {
			if (isPending || isTextEditingTarget(event.target)) return;

			const [file] = getFilesFromClipboard(event);
			if (!file) return;

			event.preventDefault();
			handleFile(file);
		}

		document.addEventListener("paste", handleDocumentPaste);
		return () => document.removeEventListener("paste", handleDocumentPaste);
	});

	return (
		<>
			<input
				ref={inputRef}
				type="file"
				className="hidden"
				accept={ALLOWED_MIME_TYPES.join(",")}
				onChange={handleFileChange}
			/>
			<button
				type="button"
				className="flex w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed py-4 text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
				onClick={() => inputRef.current?.click()}
				onPaste={handlePaste}
				disabled={isPending}
			>
				<span className="flex items-center gap-2">
					<RiAttachment2 className="size-4" />
					{isPending ? "Enviando..." : "Adicionar anexo"}
				</span>
				{!isPending && (
					<span className="text-xs">
						PDF, JPEG, PNG ou WebP · cole ou busque o arquivo · máx. {maxSizeMb}{" "}
						MB
					</span>
				)}
			</button>
		</>
	);
}
