"use client";

import { RiAttachment2, RiCloseLine } from "@remixicon/react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
	ALLOWED_MIME_TYPES,
	DEFAULT_MAX_FILE_SIZE_MB,
} from "@/features/transactions/lib/attachments-config";
import { Button } from "@/shared/components/ui/button";
import {
	getFilesFromClipboard,
	isTextEditingTarget,
	validateAttachmentFile,
} from "./attachment-file-utils";

interface AttachmentFilePickerProps {
	files: File[];
	onAdd: (file: File) => void;
	onRemove: (file: File) => void;
	maxSizeMb?: number;
}

export function AttachmentFilePicker({
	files,
	onAdd,
	onRemove,
	maxSizeMb = DEFAULT_MAX_FILE_SIZE_MB,
}: AttachmentFilePickerProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	function addFile(file: File) {
		const validation = validateAttachmentFile(file, maxSizeMb);
		if (!validation.ok) {
			toast.error(validation.error);
			return;
		}

		onAdd(file);
	}

	function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const selected = e.target.files?.[0];
		if (inputRef.current) inputRef.current.value = "";

		if (!selected) return;

		addFile(selected);
	}

	function handlePaste(event: React.ClipboardEvent<HTMLButtonElement>) {
		const pastedFiles = getFilesFromClipboard(event);
		if (pastedFiles.length === 0) return;

		event.preventDefault();
		for (const file of pastedFiles) {
			addFile(file);
		}
	}

	useEffect(() => {
		function handleDocumentPaste(event: ClipboardEvent) {
			if (isTextEditingTarget(event.target)) return;

			const pastedFiles = getFilesFromClipboard(event);
			if (pastedFiles.length === 0) return;

			event.preventDefault();
			for (const file of pastedFiles) {
				addFile(file);
			}
		}

		document.addEventListener("paste", handleDocumentPaste);
		return () => document.removeEventListener("paste", handleDocumentPaste);
	});

	return (
		<div className="space-y-1.5">
			<p className="text-xs font-medium">Anexos</p>
			<input
				ref={inputRef}
				type="file"
				className="hidden"
				accept={ALLOWED_MIME_TYPES.join(",")}
				onChange={handleFileChange}
			/>

			{files.length > 0 && (
				<div className="space-y-1.5">
					{files.map((file) => (
						<div
							key={`${file.name}-${file.size}-${file.lastModified}`}
							className="flex min-w-0 items-center gap-2 overflow-hidden rounded-md border px-3 py-2 text-sm"
						>
							<RiAttachment2 className="size-4 shrink-0 text-muted-foreground" />
							<span className="min-w-0 flex-1 truncate" title={file.name}>
								{file.name}
							</span>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="size-6 shrink-0"
								onClick={() => onRemove(file)}
							>
								<RiCloseLine className="size-4" />
							</Button>
						</div>
					))}
				</div>
			)}

			<button
				type="button"
				className="flex w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed py-4 text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
				onClick={() => inputRef.current?.click()}
				onPaste={handlePaste}
			>
				<span className="flex items-center gap-2">
					<RiAttachment2 className="size-4" />
					Adicionar anexo
				</span>
				<span className="text-xs">
					PDF, JPEG, PNG ou WebP · cole ou busque o arquivo · máx. {maxSizeMb}{" "}
					MB
				</span>
			</button>
		</div>
	);
}
