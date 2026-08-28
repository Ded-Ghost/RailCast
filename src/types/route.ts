import type { DelayStatus, GeoPoint } from "./common";

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

  // ── Live route extensions ───────────────────────────────────────────────────
  // Populated by /api/trains/:id/route. Optional so any consumer built against
  // the original six fields keeps compiling and working.

  /** Station name as published in the timetable — saves a lookup against the station table. */
  stationName?: string;

  /**
   * Real coordinates for this stop, straight from the published route.
   *
   * This is what lets the simulation interpolate a position for *any* train:
   * a static station table can only geocode stations it happens to contain,
   * whereas every stop on a live route arrives already carrying its own
   * position. Consumers should prefer this over a code lookup.
   */
  position?: GeoPoint;

  /** Booked arrival at this stop, "HH:MM" — null at the origin. */
  scheduledArrival?: string | null;
  /** Booked departure from this stop, "HH:MM" — null at the destination. */
  scheduledDeparture?: string | null;
  /** Time the train actually called here, "HH:MM", when the feed reported it. */
  actualTime?: string | null;
  /** The live feed's own wording for this stop's delay, e.g. "13min". */
  delayText?: string | null;

  platform?: string | null;
  /** Booked halt at this stop, minutes. */
  haltMinutes?: number;
  /** Days after departure that this stop falls on; 0 for day one. */
  dayOffset?: number;
  zone?: string | null;
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
