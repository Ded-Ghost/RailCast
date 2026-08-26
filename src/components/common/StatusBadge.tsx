import { CheckCircle2, Clock, TriangleAlert, OctagonAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getStatusVisual } from "@/lib/status";
import type { DelayStatus } from "@/types";
import { cn } from "@/lib/cn";

const STATUS_ICONS: Record<DelayStatus, LucideIcon> = {
  "on-time": CheckCircle2,
  minor: Clock,
  significant: TriangleAlert,
  severe: OctagonAlert,
};

export interface StatusBadgeProps {
  status: DelayStatus;
  /** Override the default status label, e.g. show "+11 min" instead of "Minor Delay". */
  label?: string;
  showIcon?: boolean;
  className?: string;
}

/** Pill-shaped status indicator used across tables, cards, and lists. */
export function StatusBadge({ status, label, showIcon = true, className }: StatusBadgeProps) {
  const visual = getStatusVisual(status);
  const Icon = STATUS_ICONS[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-body-sm font-semibold",
        visual.textClass,
        visual.bgSoftClass,
        className,
      )}
    >
      {showIcon && <Icon size={12} strokeWidth={2.5} />}
      {label ?? visual.label}
    </span>
  );
}
