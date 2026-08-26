import { cn } from "@/lib/cn";

export interface SkeletonProps {
  className?: string;
}

/** Base shimmer block — compose into layout-specific skeletons below. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded bg-surface-container-high", className)}
      aria-hidden="true"
    />
  );
}

/** Skeleton matching MetricCard's dimensions, for KPI-row loading states. */
export function MetricCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4 shadow-card">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

/** Skeleton matching a table row, for lists loading state (Priority Trains, etc.). */
export function RowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-4 w-12" />
    </div>
  );
}

/** Full-card skeleton for whole panels while their data resolves. */
export function CardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4 shadow-card">
      <Skeleton className="h-5 w-40" />
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-4 w-full" />
      ))}
    </div>
  );
}
