import type { GeoPoint } from "./common";

/**
 * A real live-train position reading, normalized from whatever the
 * configured provider (RailRadar, by default) actually returns. Matches
 * the field list requested for this integration: train number, name,
 * lat/lng, current station/section, next station, speed, timestamp,
 * delay, direction.
 */
export interface LiveTrainSnapshot {
  trainNumber: string;
  trainName: string;
  position: GeoPoint;
  currentStationCode: string | null;
  currentStationName: string | null;
  nextStationCode: string | null;
  nextStationName: string | null;
  speedKmh: number | null;
  delayMinutes: number | null;
  /** Compass bearing in degrees, if the provider supplies it — not all do. */
  directionDegrees: number | null;
  /** ISO timestamp the provider reported this reading for. */
  observedAt: string;
}
