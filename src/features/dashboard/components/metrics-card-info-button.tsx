"use client";

import { RiInformationLine } from "@remixicon/react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/shared/components/ui/tooltip";

type MetricsCardInfoButtonProps = {
	label: string;
	helpTitle: string;
	helpLines: readonly string[];
};

export function MetricsCardInfoButton({
	label,
	helpTitle,
	helpLines,
}: MetricsCardInfoButtonProps) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					className="inline-flex items-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
					aria-label={`Entenda como ${label.toLowerCase()} é calculado`}
				>
					<RiInformationLine className="size-4" aria-hidden />
				</button>
			</TooltipTrigger>
			<TooltipContent
				align="start"
				side="bottom"
				sideOffset={8}
				className="max-w-80 space-y-3 p-3 text-left"
			>
				<div className="space-y-1">
					<p className="text-sm font-medium text-background">{helpTitle}</p>
				</div>
				<ul className="space-y-2 text-xs text-background/80">
					{helpLines.map((line) => (
						<li key={`${label}-${line}`}>{line}</li>
					))}
				</ul>
			</TooltipContent>
		</Tooltip>
	);
}
