"use client";

import {
	RiImageEditLine,
	RiRefreshLine,
	RiUploadCloud2Line,
} from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
	resetBrandingLogoAction,
	saveBrandingLogoAction,
	updateBrandingColorAction,
} from "@/features/settings/actions";
import { Logo } from "@/shared/components/brand/logo";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Separator } from "@/shared/components/ui/separator";
import { DEFAULT_PRIMARY_COLOR_HEX } from "@/shared/lib/branding/color";

const LOGO_ACCEPT = "image/png,image/jpeg,image/webp";
const LOGO_MAX_FILE_SIZE = 2 * 1024 * 1024;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

type CustomizationFormProps = {
	primaryColorHex: string;
	logoUrl: string | null;
	logoFileName: string | null;
};

function normalizeHexInput(value: string) {
	const trimmed = value.trim();
	if (!trimmed) return "";
	return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function validateLogoFile(file: File) {
	if (!LOGO_ACCEPT.split(",").includes(file.type)) {
		return "Tipo de arquivo não suportado. Use PNG, JPEG ou WebP.";
	}

	if (file.size > LOGO_MAX_FILE_SIZE) {
		return "Logo deve ter no máximo 2 MB.";
	}

	return null;
}

export function CustomizationForm({
	primaryColorHex,
	logoUrl,
	logoFileName,
}: CustomizationFormProps) {
	const router = useRouter();
	const inputRef = useRef<HTMLInputElement>(null);
	const [isPending, startTransition] = useTransition();
	const [colorHex, setColorHex] = useState(primaryColorHex);
	const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
	const [selectedLogoPreview, setSelectedLogoPreview] = useState<string | null>(
		null,
	);

	useEffect(() => {
		if (!selectedLogo) {
			setSelectedLogoPreview(null);
			return;
		}

		const objectUrl = URL.createObjectURL(selectedLogo);
		setSelectedLogoPreview(objectUrl);

		return () => URL.revokeObjectURL(objectUrl);
	}, [selectedLogo]);

	function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0] ?? null;
		if (inputRef.current) inputRef.current.value = "";
		if (!file) return;

		const error = validateLogoFile(file);
		if (error) {
			toast.error(error);
			return;
		}

		setSelectedLogo(file);
	}

	function handleUploadLogo() {
		if (!selectedLogo) return;

		startTransition(async () => {
			const formData = new FormData();
			formData.set("logo", selectedLogo);
			const result = await saveBrandingLogoAction(formData);

			if (!result.success) {
				toast.error(result.error);
				return;
			}

			toast.success(result.message);
			setSelectedLogo(null);
			router.refresh();
		});
	}

	function handleResetLogo() {
		startTransition(async () => {
			const result = await resetBrandingLogoAction();

			if (!result.success) {
				toast.error(result.error);
				return;
			}

			toast.success(result.message);
			setSelectedLogo(null);
			router.refresh();
		});
	}

	function handleSaveColor(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const normalized = normalizeHexInput(colorHex);

		if (!HEX_COLOR_PATTERN.test(normalized)) {
			toast.error("Informe uma cor no formato #RRGGBB.");
			return;
		}

		startTransition(async () => {
			const result = await updateBrandingColorAction({
				primaryColorHex: normalized,
			});

			if (!result.success) {
				toast.error(result.error);
				return;
			}

			toast.success(result.message);
			setColorHex(result.data?.primaryColorHex ?? normalized);
			router.refresh();
		});
	}

	function handleResetColor() {
		startTransition(async () => {
			const result = await updateBrandingColorAction({ primaryColorHex: null });

			if (!result.success) {
				toast.error(result.error);
				return;
			}

			toast.success(result.message);
			setColorHex(DEFAULT_PRIMARY_COLOR_HEX);
			router.refresh();
		});
	}

	const previewUrl = selectedLogoPreview ?? logoUrl;
	const previewLabel = selectedLogo?.name ?? logoFileName;

	return (
		<div className="flex flex-col gap-8">
			<section className="space-y-4">
				<div>
					<h3 className="text-base font-semibold">Logo da header</h3>
					<p className="text-sm text-muted-foreground">
						Use uma imagem horizontal ou compacta para substituir a marca nas
						headers do app.
					</p>
				</div>

				<div className="flex flex-col gap-4 md:max-w-xl">
					<div className="flex min-h-20 items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3">
						<div className="flex min-w-0 flex-col gap-1">
							<span className="text-sm font-medium">Prévia</span>
							<span className="truncate text-sm text-muted-foreground">
								{previewLabel ?? "Logo padrão do OpenMonetis"}
							</span>
						</div>
						<div className="flex h-12 min-w-36 items-center justify-end rounded-md bg-primary px-3">
							{previewUrl ? (
								<img
									src={previewUrl}
									alt={previewLabel ?? "Logo personalizada"}
									className="max-h-9 max-w-32 object-contain"
								/>
							) : (
								<Logo
									variant="compact"
									iconClassName="dark:brightness-100 dark:saturate-100"
								/>
							)}
						</div>
					</div>

					<input
						ref={inputRef}
						type="file"
						accept={LOGO_ACCEPT}
						className="hidden"
						onChange={handleLogoChange}
					/>

					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => inputRef.current?.click()}
							disabled={isPending}
						>
							<RiImageEditLine className="size-4" />
							Escolher logo
						</Button>
						<Button
							type="button"
							onClick={handleUploadLogo}
							disabled={!selectedLogo || isPending}
						>
							<RiUploadCloud2Line className="size-4" />
							Salvar logo
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={handleResetLogo}
							disabled={isPending || (!logoUrl && !selectedLogo)}
						>
							<RiRefreshLine className="size-4" />
							Restaurar padrão
						</Button>
					</div>

					<p className="text-sm text-muted-foreground">
						Formatos aceitos: PNG, JPEG ou WebP. Tamanho máximo: 2 MB.
					</p>
				</div>
			</section>

			<Separator />

			<form onSubmit={handleSaveColor} className="space-y-4">
				<div>
					<h3 className="text-base font-semibold">Cor principal</h3>
					<p className="text-sm text-muted-foreground">
						Essa cor guia botões, seleção, foco, navbar e destaques globais.
					</p>
				</div>

				<div className="flex flex-col gap-4 md:max-w-xl">
					<div className="flex flex-wrap items-end gap-3">
						<div className="space-y-2">
							<Label htmlFor="primary-color-picker">Cor</Label>
							<input
								id="primary-color-picker"
								type="color"
								value={normalizeHexInput(colorHex) || DEFAULT_PRIMARY_COLOR_HEX}
								onChange={(event) => setColorHex(event.target.value)}
								disabled={isPending}
								className="h-9 w-14 rounded-md border border-input bg-transparent p-1"
							/>
						</div>

						<div className="min-w-40 flex-1 space-y-2">
							<Label htmlFor="primary-color-hex">Hexadecimal</Label>
							<Input
								id="primary-color-hex"
								value={colorHex}
								onChange={(event) => setColorHex(event.target.value)}
								placeholder="#FF7733"
								disabled={isPending}
								maxLength={7}
							/>
						</div>

						<Button type="submit" disabled={isPending}>
							Salvar cor
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={handleResetColor}
							disabled={isPending}
						>
							<RiRefreshLine className="size-4" />
							Restaurar padrão
						</Button>
					</div>
				</div>
			</form>
		</div>
	);
}
