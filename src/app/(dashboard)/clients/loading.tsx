import { Card, CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

export default function ClientsLoading() {
	return (
		<main className="flex flex-col items-start gap-6">
			<div className="w-full space-y-6">
				<div className="flex items-center justify-between">
					<Skeleton className="h-10 w-36 rounded-md bg-foreground/10" />
				</div>

				<div className="space-y-4">
					<div className="flex gap-2 border-b">
						{Array.from({ length: 2 }).map((_, index) => (
							<Skeleton
								key={index}
								className="h-10 w-24 rounded-t-md bg-foreground/10"
							/>
						))}
					</div>

					<Card className="py-2">
						<CardContent className="px-2 py-4 sm:px-4">
							<div className="space-y-0">
								<div className="flex items-center gap-4 border-b px-2 pb-3">
									<Skeleton className="h-4 w-28 rounded bg-foreground/10" />
									<Skeleton className="h-4 w-32 rounded bg-foreground/10" />
									<div className="flex-1" />
									<Skeleton className="h-4 w-14 rounded bg-foreground/10" />
								</div>

								{Array.from({ length: 6 }).map((_, index) => (
									<div
										key={index}
										className="flex items-center gap-4 border-b border-dashed px-2 py-3 last:border-b-0"
									>
										<Skeleton
											className="h-4 rounded bg-foreground/10"
											style={{ width: `${110 + (index % 3) * 36}px` }}
										/>
										<Skeleton className="h-4 w-48 rounded bg-foreground/10" />
										<div className="flex-1" />
										<div className="flex items-center gap-3">
											<Skeleton className="h-4 w-14 rounded bg-foreground/10" />
											<Skeleton className="h-4 w-16 rounded bg-foreground/10" />
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</main>
	);
}
