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
}
