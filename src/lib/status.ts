import type { AlertSeverity, CongestionStatus, DelayStatus } from "@/types";

/**
 * Single source of truth for how a `DelayStatus` maps to color tokens,
 * copy, and thresholds. Components should never hardcode a status color —
 * they should read it from here, so the semantic system (DESIGN.md) stays
 * consistent everywhere (badges, cards, map markers, table rows).
 */
export interface StatusVisual {
  label: string;
  textClass: string;
  bgSoftClass: string; // low-opacity background, e.g. for chips
  borderClass: string;
  dotClass: string; // solid background, e.g. for a status dot
}

const STATUS_VISUALS: Record<DelayStatus, StatusVisual> = {
  "on-time": {
    label: "On Time",
    textClass: "text-rail-green",
    bgSoftClass: "bg-rail-green/10",
    borderClass: "border-rail-green/30",
    dotClass: "bg-rail-green",
  },
  minor: {
    label: "Minor Delay",
    textClass: "text-rail-amber",
    bgSoftClass: "bg-rail-amber/10",
    borderClass: "border-rail-amber/30",
    dotClass: "bg-rail-amber",
  },
  significant: {
    label: "Significant Delay",
    textClass: "text-rail-orange",
    bgSoftClass: "bg-rail-orange/10",
    borderClass: "border-rail-orange/30",
    dotClass: "bg-rail-orange",
  },
  severe: {
    label: "Severe Delay",
    textClass: "text-error",
    bgSoftClass: "bg-error/10",
    borderClass: "border-error/30",
    dotClass: "bg-error",
  },
};

export function getStatusVisual(status: DelayStatus): StatusVisual {
  return STATUS_VISUALS[status];
}

/** Derive a DelayStatus from a raw delay figure in minutes (signed). */
export function delayMinutesToStatus(delayMinutes: number): DelayStatus {
  if (delayMinutes <= 0) return "on-time";
  if (delayMinutes <= 15) return "minor";
  if (delayMinutes <= 30) return "significant";
  return "severe";
}

const ALERT_SEVERITY_VISUALS: Record<
  AlertSeverity,
  Omit<StatusVisual, "label">
> = {
  critical: {
    textClass: "text-error",
    bgSoftClass: "bg-error/5",
    borderClass: "border-error/20",
    dotClass: "bg-error",
  },
  warning: {
    textClass: "text-rail-amber",
    bgSoftClass: "bg-rail-amber/5",
    borderClass: "border-rail-amber/20",
    dotClass: "bg-rail-amber",
  },
  info: {
    textClass: "text-rail-blue",
    bgSoftClass: "bg-rail-blue/5",
    borderClass: "border-rail-blue/20",
    dotClass: "bg-rail-blue",
  },
  success: {
    textClass: "text-rail-green",
    bgSoftClass: "bg-rail-green/5",
    borderClass: "border-rail-green/20",
    dotClass: "bg-rail-green",
  },
};

export function getAlertSeverityVisual(severity: AlertSeverity) {
  return ALERT_SEVERITY_VISUALS[severity];
}

/**
 * Maps a track section's congestion tier onto the existing `DelayStatus`
 * color system (healthy→on-time green, moderate→minor amber,
 * congested→significant orange, critical→severe red), so section health
 * on Route Monitor / Delay Intelligence's map never invents a second
 * color language — it's the same one used for train delay everywhere else.
 */
const CONGESTION_TO_DELAY_STATUS: Record<CongestionStatus, DelayStatus> = {
  healthy: "on-time",
  moderate: "minor",
  congested: "significant",
  critical: "severe",
};

const CONGESTION_LABELS: Record<CongestionStatus, string> = {
  healthy: "Healthy",
  moderate: "Moderate",
  congested: "Congested",
  critical: "Critical",
};

export function getSectionStatusVisual(status: CongestionStatus): StatusVisual {
  return { ...STATUS_VISUALS[CONGESTION_TO_DELAY_STATUS[status]], label: CONGESTION_LABELS[status] };
}

/**
 * Raw hex values for the same status system, for contexts that can't use
 * Tailwind classes — SVG/canvas-based libraries like Leaflet (Polyline
 * `color`, Circle `fillColor`) and Recharts (`stroke`/`fill`). Keep this in
 * sync with the `rail-*` / `error` tokens in tailwind.config.ts.
 */
const STATUS_HEX: Record<DelayStatus, string> = {
  "on-time": "#0b8a00",
  minor: "#d68800",
  significant: "#c2540a",
  severe: "#ba1a1a",
};

export function getStatusHexColor(status: DelayStatus): string {
  return STATUS_HEX[status];
}

export function getSectionStatusHexColor(status: CongestionStatus): string {
  return STATUS_HEX[CONGESTION_TO_DELAY_STATUS[status]];
}
