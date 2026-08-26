import type { DelayStatus, GeoPoint } from "./common";

export interface Train {
  /** Train number, e.g. "12345" */
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
}
