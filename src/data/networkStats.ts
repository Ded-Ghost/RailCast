export interface NetworkSummary {
  activeTrains: number;
  activeTrainsDeltaLastHour: number;
  onTimeCount: number;
  onTimePercent: number;
  delayedCount: number;
  delayedPercent: number;
  criticalCount: number;
  criticalPercent: number;
}

export const networkSummary: NetworkSummary = {
  activeTrains: 1248,
  activeTrainsDeltaLastHour: 12,
  onTimeCount: 936,
  onTimePercent: 75,
  delayedCount: 281,
  delayedPercent: 22.5,
  criticalCount: 31,
  criticalPercent: 2.5,
};

export interface DelayIntelligenceSummary {
  averageDelayMinutes: number;
  averageDelayDeltaFromYesterday: number;
  maxDelayMinutes: number;
  maxDelayTrainId: string;
  maxDelaySection: string;
  recoveryRatePerSector: number;
  predictionAccuracyPercent: number;
}

export const delayIntelligenceSummary: DelayIntelligenceSummary = {
  averageDelayMinutes: 8.7,
  averageDelayDeltaFromYesterday: 1.2,
  maxDelayMinutes: 47,
  maxDelayTrainId: "IC-492",
  maxDelaySection: "North Sector",
  recoveryRatePerSector: 3.1,
  predictionAccuracyPercent: 92.4,
};

export interface DelayCauseBreakdown {
  label: string;
  percent: number;
}

export const delayCauseBreakdown: DelayCauseBreakdown[] = [
  { label: "Congestion", percent: 42 },
  { label: "Weather", percent: 28 },
  { label: "Technical", percent: 15 },
  { label: "Other", percent: 15 },
];
