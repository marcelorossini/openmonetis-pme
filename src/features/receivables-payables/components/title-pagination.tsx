import {
	RiArrowLeftDoubleLine,
	RiArrowLeftSLine,
	RiArrowRightDoubleLine,
	RiArrowRightSLine,
} from "@remixicon/react";
import { Button } from "@/shared/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";

type TitlePaginationProps = {
	totalRows: number;
	currentPage: number;
	currentPageSize: number;
	totalPages: number;
	canPreviousPage: boolean;
	canNextPage: boolean;
	onPageChange: (page: number) => void;
	onPageSizeChange: (size: number) => void;
};

export function TitlePagination({
	totalRows,
	currentPage,
	currentPageSize,
	totalPages,
	canPreviousPage,
	canNextPage,
	onPageChange,
	onPageSizeChange,
}: TitlePaginationProps) {
	return (
		<div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div className="flex items-center gap-2">
				<span className="text-sm text-muted-foreground">
					{totalRows} títulos
				</span>
				<Select
					value={currentPageSize.toString()}
					onValueChange={(value) => onPageSizeChange(Number(value))}
				>
					<SelectTrigger className="w-max">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="5">5 linhas</SelectItem>
						<SelectItem value="10">10 linhas</SelectItem>
						<SelectItem value="20">20 linhas</SelectItem>
						<SelectItem value="30">30 linhas</SelectItem>
						<SelectItem value="40">40 linhas</SelectItem>
						<SelectItem value="50">50 linhas</SelectItem>
						<SelectItem value="100">100 linhas</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<div className="flex items-center gap-2">
				<span className="text-sm text-muted-foreground">
					Página {currentPage} de {totalPages}
				</span>
				<div className="flex items-center gap-1">
					<Button
						variant="outline"
						size="icon-sm"
						onClick={() => onPageChange(1)}
						disabled={!canPreviousPage}
						aria-label="Primeira página"
					>
						<RiArrowLeftDoubleLine className="size-4" />
					</Button>
					<Button
						variant="outline"
						size="icon-sm"
						onClick={() => onPageChange(currentPage - 1)}
						disabled={!canPreviousPage}
						aria-label="Página anterior"
					>
						<RiArrowLeftSLine className="size-4" />
					</Button>
					<Button
						variant="outline"
						size="icon-sm"
						onClick={() => onPageChange(currentPage + 1)}
						disabled={!canNextPage}
						aria-label="Próxima página"
					>
						<RiArrowRightSLine className="size-4" />
					</Button>
					<Button
						variant="outline"
						size="icon-sm"
						onClick={() => onPageChange(totalPages)}
						disabled={!canNextPage}
						aria-label="Última página"
					>
						<RiArrowRightDoubleLine className="size-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}
