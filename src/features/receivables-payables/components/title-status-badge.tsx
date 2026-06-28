"use client";

import type { FinancialTitleComputedStatus } from "@/features/receivables-payables/types";
import { Badge } from "@/shared/components/ui/badge";

const STATUS_LABELS: Record<FinancialTitleComputedStatus, string> = {
	pending: "Pendente",
	overdue: "Atrasado",
	settled: "Baixado",
	cancelled: "Cancelado",
};

const STATUS_VARIANTS: Record<
	FinancialTitleComputedStatus,
	"destructive" | "info" | "success" | "secondary"
> = {
	pending: "info",
	overdue: "destructive",
	settled: "success",
	cancelled: "secondary",
};

export function TitleStatusBadge({
	status,
}: {
	status: FinancialTitleComputedStatus;
}) {
	return (
		<Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
	);
}
