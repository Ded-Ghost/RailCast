import { Radio, TestTube2, Clock, WifiOff, HelpCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import type { DataSourceStatus } from "@/types";

export interface LiveIndicatorProps {
  label?: string;
  className?: string;
}

/**
 * The pure "this is genuinely real-time" dot — blue pulsing indicator per
 * DESIGN.md's "Live/Predictive (Blue)" spec (previously implemented in
 * error-red, which was a bug against the approved design, fixed here).
 * Use this ONLY when the data behind it truly is live (e.g. the Open-Meteo
 * weather readout). For anything else — simulated, stale, or offline data —
 * use `DataSourceBadge` below instead of reaching for this component.
 */
export function LiveIndicator({ label = "Live", className }: LiveIndicatorProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rail-blue opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-rail-blue" />
      </span>
      <span className="text-body-sm font-semibold uppercase tracking-widest text-rail-blue">{label}</span>
    </span>
  );
}

const STATUS_CONFIG: Record<
  DataSourceStatus,
  { label: string; icon: typeof Radio; textClass: string; bgClass: string; pulse: boolean }
> = {
  live: { label: "LIVE", icon: Radio, textClass: "text-rail-blue", bgClass: "bg-rail-blue text-white", pulse: true },
  demo: {
    label: "DEMO SIMULATION",
    icon: TestTube2,
    textClass: "text-on-surface-variant",
    bgClass: "bg-surface-container-high text-on-surface-variant",
    pulse: false,
  },
  stale: {
    label: "STALE",
    icon: Clock,
    textClass: "text-rail-amber",
    bgClass: "bg-rail-amber text-white",
    pulse: false,
  },
  offline: {
    label: "OFFLINE",
    icon: WifiOff,
    textClass: "text-error",
    bgClass: "bg-surface-container-high text-error",
    pulse: false,
  },
  unavailable: {
    label: "UNAVAILABLE",
    icon: HelpCircle,
    textClass: "text-on-surface-variant",
    bgClass: "bg-surface-container-high text-on-surface-variant",
    pulse: false,
  },
};

export interface DataSourceBadgeProps {
  status: DataSourceStatus;
  /** e.g. "Updated 12 sec ago", "Last update 2 min ago", "Live source unavailable", "Scripted for demonstration — no live feed connected" */
  detail?: string;
  /** "inline" (default) is the small label used in card headers. "button" is the full-width sidebar affordance previously hardcoded to always say "Network Live". */
  variant?: "inline" | "button";
  /** Overrides the status's default label — e.g. the sidebar's "Demo Network" instead of "DEMO SIMULATION". */
  label?: string;
  className?: string;
}

/**
 * The honest replacement for scattering ad-hoc "LIVE" labels around the
 * app. Every module that shows current/real-time-looking data must render
 * one of these, with the status that's actually true — never "live" for
 * anything that isn't genuinely sourced from a live feed. See
 * types/common.ts's DataSourceStatus for what each value means.
 */
export function DataSourceBadge({ status, detail, variant = "inline", label, className }: DataSourceBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const displayLabel = label ?? config.label;

  if (variant === "button") {
    return (
      <button
        type="button"
        className={cn(
          "mb-2 flex w-full items-center justify-center gap-2 rounded px-4 py-2 text-label-md font-semibold transition-colors hover:opacity-90",
          config.bgClass,
          className,
        )}
      >
        <Icon size={16} strokeWidth={2.5} />
        {displayLabel}
      </button>
    );
  }

  return (
    <span className={cn("inline-flex flex-col items-start gap-0.5", className)}>
      <span className="inline-flex items-center gap-1.5">
        {config.pulse ? (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rail-blue opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rail-blue" />
          </span>
        ) : (
          <Icon size={12} className={config.textClass} />
        )}
        <span className={cn("text-body-sm font-semibold uppercase tracking-widest", config.textClass)}>
          {displayLabel}
        </span>
      </span>
      {detail && <span className="text-[11px] text-on-surface-variant">{detail}</span>}
    </span>
  );
}
