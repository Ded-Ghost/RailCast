/**
 * Operational status tiers used across the app. Rigid & semantic —
 * see DESIGN.md. Every place that colors a train, row, badge, or map
 * marker by delay should key off this single type.
 */
export type DelayStatus = "on-time" | "minor" | "significant" | "severe";

/** Real-time / model-driven data as opposed to static/historical data. */
export type LiveStatus = "live" | "predictive";

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
