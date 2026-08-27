import type { DelayStatus } from "./common";

export interface RouteSection {
  id: string;
  name: string; // "North Corridor (Sec 4)"
  avgDelayMinutes: number;
  affectedTrains: number;
  status: DelayStatus;
}

export interface TrainRoute {
  id: string;
  trainId: string;
  originCode: string;
  destinationCode: string;
  /** Ordered list of station codes along the route. */
  stationCodes: string[];
}

/** Where a station sits relative to the train's current live position. */
export type RouteStopStatus = "passed" | "current" | "upcoming";

export interface RouteStopProgress {
  stationCode: string;
  /** Cumulative distance from the route's origin station, in km. Drives proportional placement in the route diagram. */
  distanceFromOriginKm: number;
  scheduledTime: string;
  predictedTime: string;
  delayMinutes: number;
  status: RouteStopStatus;
}

/** Per-train station-by-station ETA breakdown — powers the Train Details route intelligence visualization. */
export interface TrainRouteProgress {
  trainId: string;
  stops: RouteStopProgress[];
}

/**
 * Section health tiers used by Route Monitor / Delay Intelligence's map
 * overlays. Deliberately a distinct type from `DelayStatus` (which
 * describes a *train's* delay) — a section's congestion status is a
 * property of the track, not of any one train — but it's rendered with
 * the exact same color system via `sectionStatusToDelayStatus()` in
 * lib/status.ts, per the "reuse existing RailCast status colors" rule.
 */
export type CongestionStatus = "healthy" | "moderate" | "congested" | "critical";

/**
 * One real geographic segment of a route between two adjacent stations —
 * distinct from `RouteSection` above (which models the *abstract*
 * network-wide "worst performing sections" list on Delay Intelligence,
 * keyed by name, not by station pair). A `RailwaySection` is always
 * anchored to two real `Station` codes so it can be drawn on a real map.
 */
export interface RailwaySection {
  id: string;
  startStationCode: string;
  endStationCode: string;
  /** Straight-line distance between the two stations, km (see lib/geo.ts). */
  distanceKm: number;
  referenceSpeedKmh: number;
  currentSpeedKmh: number;
  congestionStatus: CongestionStatus;
  /** Typical/observed contribution to overall trip delay from this section, minutes. */
  delayContributionMinutes: number;
}
