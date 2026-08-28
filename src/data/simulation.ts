import type { SimulationState } from "@/types";

/**
 * Default scenario CONTROL values for Simulation Lab — matches the
 * original Stitch mockup's pre-filled sliders (target speed 110, low
 * congestion, normal dwell, clear weather, +5min injected delay).
 *
 * The *derived* fields on `SimulationState` (simulatedEta,
 * etaImpactMinutes, bottleneckRiskLevel, stationForecast, elapsedLabel,
 * nextStationCode) are intentionally NOT set here — they're computed by
 * simulation/simulationLabEngine.ts from these controls, at store init and
 * on every playback tick, so there's exactly one place that can produce
 * them and they can never drift out of sync with the scenario logic.
 */
export const defaultSimulationControls: Pick<
  SimulationState,
  | "trainId"
  | "targetSpeedKmh"
  | "congestionLevel"
  | "stationDwellTime"
  | "weatherCondition"
  | "delayInjectionMinutes"
  | "isRunning"
  | "playbackSpeed"
> = {
  // Seed train NUMBER only — Simulation Lab fetches this train's real route,
  // timings and current delay on mount, exactly as it does for any number the
  // user types afterwards. Nothing about this train is written down here.
  trainId: "12301",
  targetSpeedKmh: 110,
  congestionLevel: "low",
  stationDwellTime: "normal",
  weatherCondition: "Clear",
  delayInjectionMinutes: 5,
  isRunning: true,
  playbackSpeed: 1,
};
