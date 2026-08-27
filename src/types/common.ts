/**
 * Operational status tiers used across the app. Rigid & semantic —
 * see DESIGN.md. Every place that colors a train, row, badge, or map
 * marker by delay should key off this single type.
 */
export type DelayStatus = "on-time" | "minor" | "significant" | "severe";

/** Real-time / model-driven data as opposed to static/historical data. */
export type LiveStatus = "live" | "predictive";

/**
 * Honest data-provenance state for any module that could be mistaken for
 * live telemetry. Every place that shows something claiming to be
 * current/real-time must pick one of these — never hardcode a "LIVE"
 * label independent of this type. See components/common/LiveIndicator.tsx.
 */
export type DataSourceStatus = "live" | "demo" | "stale" | "offline" | "unavailable";

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Generic async resource shape used by hooks/services (mock today, API later). */
export interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}
