import { CheckCircle2, Clock, TriangleAlert, OctagonAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getSectionStatusVisual } from "@/lib/status";
import type { CongestionStatus } from "@/types";
import { cn } from "@/lib/cn";

const STATUS_ICONS: Record<CongestionStatus, LucideIcon> = {
  healthy: CheckCircle2,
  moderate: Clock,
  congested: TriangleAlert,
  critical: OctagonAlert,
};

export interface SectionStatusBadgeProps {
  status: CongestionStatus;
  showIcon?: boolean;
  className?: string;
}

/** Pill-shaped section health indicator — same visual language as StatusBadge, keyed by track congestion instead of train delay. */
export function SectionStatusBadge({ status, showIcon = true, className }: SectionStatusBadgeProps) {
  const visual = getSectionStatusVisual(status);
  const Icon = STATUS_ICONS[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        visual.textClass,
        visual.bgSoftClass,
        visual.borderClass,
        className,
      )}
    >
      {showIcon && <Icon size={12} strokeWidth={2.5} />}
      {visual.label}
    </span>
  );
}
