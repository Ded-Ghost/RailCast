export type CongestionLevel = "low" | "medium" | "high";
export type DwellTime = "normal" | "increased";
export type PlaybackSpeed = 1 | 2 | 5;

export interface SimulationState {
  trainId: string;
  targetSpeedKmh: number;
  congestionLevel: CongestionLevel;
  stationDwellTime: DwellTime;
  weatherCondition: string;
  delayInjectionMinutes: number;
  isRunning: boolean;
  playbackSpeed: PlaybackSpeed;
  elapsedLabel: string; // "T+00:15:30"

  // Derived outputs shown in the results row
  simulatedEta: string;
  nextStationCode: string;
  etaImpactMinutes: number;
  bottleneckRiskLevel: number; // 1-5
}
