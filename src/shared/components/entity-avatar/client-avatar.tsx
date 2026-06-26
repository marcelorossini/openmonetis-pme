"use client";

import {
	buildInitials,
	getCategoryBgColorFromName,
	getCategoryColorFromName,
} from "@/shared/utils/category-colors";
import { cn } from "@/shared/utils/ui";

const sizeVariants = {
	xs: 20,
	sm: 24,
	md: 32,
} as const;

type ClientAvatarSize = keyof typeof sizeVariants;

type ClientAvatarProps = {
	name: string;
	size?: ClientAvatarSize;
	className?: string;
};

export function ClientAvatar({
	name,
	size = "md",
	className,
}: ClientAvatarProps) {
	const pixelSize = sizeVariants[size];
	const color = getCategoryColorFromName(name);
	const bgColor = getCategoryBgColorFromName(name);

	return (
		<div
			className={cn(
				"flex shrink-0 items-center justify-center rounded-full font-medium uppercase",
				className,
			)}
			style={{
				width: pixelSize,
				height: pixelSize,
				fontSize: Math.max(10, Math.round(pixelSize * 0.38)),
				backgroundColor: bgColor,
				color,
			}}
			aria-hidden
		>
			{buildInitials(name)}
		</div>
	);
}

type ClientAvatarLabelProps = ClientAvatarProps & {
	labelClassName?: string;
};

export function ClientAvatarLabel({
	name,
	size = "md",
	className,
	labelClassName,
}: ClientAvatarLabelProps) {
	return (
		<span className="inline-flex min-w-0 items-center gap-2">
			<ClientAvatar name={name} size={size} className={className} />
			<span className={cn("min-w-0 truncate", labelClassName)}>{name}</span>
		</span>
	);
}
