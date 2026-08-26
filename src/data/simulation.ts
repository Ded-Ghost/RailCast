import type { SimulationState } from "@/types";
import { PRIMARY_DEMO_TRAIN_ID } from "./trains";

export const defaultSimulationState: SimulationState = {
  trainId: PRIMARY_DEMO_TRAIN_ID,
  targetSpeedKmh: 110,
  congestionLevel: "low",
  stationDwellTime: "normal",
  weatherCondition: "Clear",
  delayInjectionMinutes: 5,
  isRunning: true,
  playbackSpeed: 1,
  elapsedLabel: "T+00:15:30",
  simulatedEta: "14:42",
  nextStationCode: "KOTA",
  etaImpactMinutes: 12,
  bottleneckRiskLevel: 4,
};
