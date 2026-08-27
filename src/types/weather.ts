import type { WeatherCondition } from "./simulation";

export interface WeatherSnapshot {
  /** The real-world point this reading is for. */
  stationCode: string;
  stationName: string;
  temperatureCelsius: number;
  precipitationMm: number;
  windSpeedKmh: number;
  /** WMO weather code as returned by the provider — kept for debugging/transparency. */
  weatherCode: number;
  /** Human-readable condition, e.g. "Overcast", "Light rain", "Fog". */
  conditionLabel: string;
  /** Coarse bucket matching Simulation Lab's scenario control, so real conditions can be cross-referenced against a what-if choice. */
  condition: WeatherCondition;
  /** ISO timestamp the provider reported this reading for. */
  observedAt: string;
}
