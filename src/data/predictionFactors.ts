export interface RankedPredictionFactor {
  label: string;
  /** Relative impact on ETA predictions across the network, 0-100. Not a percentage breakdown (doesn't need to sum to 100) — a feature-importance-style ranking. */
  impactScore: number;
}

/**
 * Network-wide ranking of what most influences the ML model's ETA
 * predictions — distinct from `PredictionFactor` in types/prediction.ts,
 * which is the per-train contributing-factor breakdown shown on Train
 * Details ("Why This ETA?"). This is the aggregate/global view shown on
 * the Predictions page's "What Influences ETA?" panel.
 */
export const rankedPredictionFactors: RankedPredictionFactor[] = [
  { label: "Current Delay", impactScore: 92 },
  { label: "Current Speed", impactScore: 78 },
  { label: "Historical Section Travel Time", impactScore: 61 },
  { label: "Congestion", impactScore: 54 },
  { label: "Station Dwell", impactScore: 39 },
  { label: "Weather", impactScore: 22 },
];

export interface PredictionAccuracyMetrics {
  maeMinutes: number;
  rmseMinutes: number;
  within5MinPercent: number;
  within10MinPercent: number;
}

/**
 * Mock/demo model-performance figures — clearly not measured against real
 * traffic, shown so the Predictions page can demonstrate the reporting
 * surface a real ML evaluation pipeline would fill in later.
 */
export const predictionAccuracyMetrics: PredictionAccuracyMetrics = {
  maeMinutes: 3.8,
  rmseMinutes: 5.2,
  within5MinPercent: 82,
  within10MinPercent: 94,
};
