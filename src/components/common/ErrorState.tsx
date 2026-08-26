import { CircleAlert, RotateCw } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/cn";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

/** Shown when a fetch fails. Distinct from EmptyState (no-data-yet vs. failed). */
export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this data. Please try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-error/10 text-error">
        <CircleAlert size={20} />
      </div>
      <p className="text-body-md font-semibold text-on-background">{title}</p>
      <p className="max-w-xs text-body-sm text-on-surface-variant">{description}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-2">
          <RotateCw size={14} />
          Retry
        </Button>
      )}
    </div>
  );
}
