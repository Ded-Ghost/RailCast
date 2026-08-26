import { Radio } from "lucide-react";
import { cn } from "@/lib/cn";

export interface LiveIndicatorProps {
  variant?: "dot" | "button";
  label?: string;
  className?: string;
}

/**
 * Communicates "this is real-time, not historical" data — the Blue
 * Live/Predictive status from DESIGN.md. `variant="dot"` is the small
 * pulsing marker used in card headers ("Live Network Snapshot • LIVE").
 * `variant="button"` is the full-width sidebar "Network Live" affordance.
 */
export function LiveIndicator({ variant = "dot", label = "Live", className }: LiveIndicatorProps) {
  if (variant === "button") {
    return (
      <button
        type="button"
        className={cn(
          "mb-2 flex w-full items-center justify-center gap-2 rounded bg-primary px-4 py-2 text-label-md font-semibold text-on-primary transition-colors hover:bg-primary-container",
          className,
        )}
      >
        <Radio size={16} strokeWidth={2.5} />
        Network Live
      </button>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-error" />
      </span>
      <span className="text-body-sm font-semibold uppercase tracking-widest text-error">
        {label}
      </span>
    </span>
  );
}
