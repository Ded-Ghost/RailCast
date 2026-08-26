import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaTone?: "positive" | "negative" | "neutral";
  icon?: LucideIcon;
  /** Optional left accent bar + icon tint color, e.g. "rail-green". Pass a Tailwind color token name. */
  accentColorClass?: string;
  className?: string;
}

const DELTA_TONE_CLASSES: Record<NonNullable<MetricCardProps["deltaTone"]>, string> = {
  positive: "text-rail-green",
  negative: "text-error",
  neutral: "text-on-surface-variant",
};

/**
 * Compact KPI card used in dashboard/analytics rows: big number, label,
 * optional delta line, optional icon, optional left accent bar for status
 * color-coding (see Dashboard's Active/On Time/Delayed/Critical row).
 */
export function MetricCard({
  label,
  value,
  delta,
  deltaTone = "neutral",
  icon: Icon,
  accentColorClass,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-2 overflow-hidden rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4 shadow-card",
        className,
      )}
    >
      {accentColorClass && (
        <div className={cn("absolute bottom-0 left-0 top-0 w-1", accentColorClass)} />
      )}
      <div
        className={cn(
          "flex items-center justify-between text-on-surface-variant",
          accentColorClass && "pl-2",
        )}
      >
        <span className="text-label-md font-semibold uppercase tracking-wider">{label}</span>
        {Icon && <Icon size={18} />}
      </div>
      <div className={cn("flex items-baseline gap-2", accentColorClass && "pl-2")}>
        <span className="font-display text-display-lg text-on-background">{value}</span>
        {delta && (
          <span className={cn("text-body-sm font-medium", DELTA_TONE_CLASSES[deltaTone])}>
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}
