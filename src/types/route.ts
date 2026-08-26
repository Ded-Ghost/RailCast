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
