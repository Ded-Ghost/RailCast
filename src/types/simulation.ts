export type CongestionLevel = "low" | "medium" | "high";
export type DwellTime = "normal" | "increased";
export type PlaybackSpeed = 1 | 2 | 5;
export type WeatherCondition = "Clear" | "Rain" | "Fog";

/** One downstream station's projected delay shift under the current scenario — the "downstream effects" timeline. */
export interface StationForecastPoint {
  stationCode: string;
  etaImpactMinutes: number;
}

export interface SimulationState {
  trainId: string;
  targetSpeedKmh: number;
  congestionLevel: CongestionLevel;
  stationDwellTime: DwellTime;
  weatherCondition: WeatherCondition;
  delayInjectionMinutes: number;
  isRunning: boolean;
  playbackSpeed: PlaybackSpeed;
  elapsedLabel: string; // "T+00:15:30"
  /** Real seconds of playback since the last reset — `elapsedLabel` is formatted from this. */
  elapsedSeconds: number;
  /** Distance covered along the corridor since the last reset, km (same scale as routeProgress's distanceFromOriginKm). */
  distanceTraveledKm: number;

  // Derived outputs shown in the results row
  simulatedEta: string;
  nextStationCode: string;
  etaImpactMinutes: number;
  bottleneckRiskLevel: number; // 1-5
  stationForecast: StationForecastPoint[];

  // ── Real-train binding ──────────────────────────────────────────────────────
  // Simulation Lab runs against a real train fetched from the backend, so the
  // scenario can be compared against what that train is actually doing.

  /** "12301 · Rajdhani Express" — resolved from the live lookup, not typed by the user. */
  trainLabel: string;
  /** Route origin and destination, for the map card heading. */
  routeLabel: string;
  /** The train's real delay right now, minutes. */
  baselineDelayMinutes: number;
  /** The train's real predicted arrival right now, "HH:MM". */
  baselineEta: string;
  /** Scenario minus reality: negative means the scenario beats today's actual running. */
  deltaVsLiveMinutes: number;

  /** True while a train's status and route are being fetched. */
  isLoadingTrain: boolean;
  /** Set when the entered train number could not be resolved. */
  trainError: string | null;
}
