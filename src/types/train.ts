import type { DelayStatus, GeoPoint } from "./common";

export interface Train {
  /** Train number, e.g. "12301" */
  id: string;
  /** Full name, e.g. "Rajdhani Express" */
  name: string;
  /** Short display name, e.g. "Rajdhani Exp" */
  shortName: string;
  /** Service category, e.g. "Express Passenger" */
  category: string;

  originCode: string;
  originName: string;
  destinationCode: string;
  destinationName: string;

  currentStationCode: string;
  currentStationName: string;
  nextStationCode: string;
  nextStationName: string;

  currentSpeedKmh: number;
  distanceRemainingKm: number;
  position: GeoPoint;

  scheduledEta: string; // "14:30"
  predictedEta: string; // "14:41"
  delayMinutes: number; // signed, minutes (+11 late, -4 early)
  delayStatus: DelayStatus;

  predictionConfidence: number; // 0-100
  predictedEtaRangeStart: string;
  predictedEtaRangeEnd: string;

  updatedAt: string; // ISO timestamp of last telemetry update

  // ── Live-feed extensions ────────────────────────────────────────────────────
  // All optional: a Train produced by the client-side simulation carries most
  // of these, one straight off /api/trains carries all of them, and nothing in
  // the UI may assume any of them are present.

  /**
   * Provenance of this record. The UI must key its "LIVE" badge off this and
   * never off the mere presence of data — see DataSourceStatus in common.ts.
   *   "live"        fresh join of timetable + running-status feeds
   *   "live-cached" same, served from the backend's 3-minute cache
   *   "schedule"    timetable only; the running-status feed failed
   *   "simulation"  advanced client-side between backend refreshes
   *   "unavailable" neither feed answered
   */
  dataSource?: "live" | "live-cached" | "schedule" | "simulation" | "unavailable";

  /** Human sentence describing what the train is doing right now. */
  liveStatusText?: string;

  /** Whether the train is currently mid-journey (not yet departed / finished are both false). */
  liveRunning?: boolean;

  /** Where this run sits in its journey — drives "not yet departed" vs "arrived" messaging. */
  journeyPhase?: "running" | "not-started" | "completed" | "unknown";

  /** Distance already covered from the origin, km. */
  distanceCoveredKm?: number;
  /** Total route length, km. */
  totalDistanceKm?: number;

  /** Index into the route's stop list of the train's current position. */
  currentStopIndex?: number;
  /** Progress along the leg between the current stop and the next one, 0-1. */
  legProgress?: number;

  /** Days of the week this service runs, e.g. ["Mon","Tue"]. */
  runsOnDays?: string[];
  /** Booked journey time, e.g. "17h 15m". */
  durationLabel?: string;
  /** Scheduled departure from the origin, "HH:MM". */
  scheduledDeparture?: string;
  /** The upstream feed's own freshness note, e.g. "Updated 12min ago". */
  feedUpdatedLabel?: string | null;
  /**
   * True when the live running-status feed's own timestamp is old enough
   * (20+ minutes) that its delay figures are treated as a possibly-outdated
   * last-known reading rather than a current one — most commonly seen as a
   * flat "On Time" the upstream source hasn't actually rechecked recently.
   * `dataSource` already reflects this (drops to "live-cached"); this flag
   * exists so the UI can say specifically why, rather than just "not fully live".
   */
  liveFeedStale?: boolean;
}
