import type { Prediction } from "@/types";
import {
  rankedPredictionFactors,
  predictionAccuracyMetrics,
  predictionVsActual,
  type RankedPredictionFactor,
  type PredictionAccuracyMetrics,
  type PredictionVsActualPoint,
} from "@/data";
import { trainService } from "./trainService";
import { resolveAfter } from "./mockDelay";

/**
 * Data-access boundary for ETA predictions. `predictETA` is the one seam a
 * real ML endpoint (e.g. `POST /api/predict-eta`, taking a fuller
 * "trainState" payload — position, speed, section, weather, history) would
 * replace; every page reads predictions through here (or through
 * hooks/useTrainIntelligence's usePrediction, which calls the same
 * trainService method) rather than computing anything ETA-related inline.
 *
 * This is deliberately a DIFFERENT layer from services/etaService.ts:
 * etaService is the baseline calculator — real arithmetic from current
 * delay + route data, with no model behind it. predictionService is where
 * a trained ML model's output would live instead of (or layered on top
 * of) that baseline, once one is actually connected. Today, underneath
 * trainService.getPrediction, the numbers this returns for the live demo
 * train ARE produced by etaService — there's no ML model yet, so the
 * baseline is standing in for it. That's an honest placeholder, not a
 * claim that ML prediction is live.
 */
export const predictionService = {
  async predictETA(trainId: string): Promise<Prediction | null> {
    return trainService.getPrediction(trainId);
  },

  /** Network-wide ranked "what influences ETA" factors, for the Predictions page. */
  async getRankedFactors(): Promise<RankedPredictionFactor[]> {
    return resolveAfter(rankedPredictionFactors);
  },

  /** Mock/demo model-evaluation metrics (MAE, RMSE, within-N-minutes rates). */
  async getAccuracyMetrics(): Promise<PredictionAccuracyMetrics> {
    return resolveAfter(predictionAccuracyMetrics);
  },

  /** Predicted-vs-actual ETA drift series, for the Predictions chart. */
  async getPredictionVsActual(): Promise<PredictionVsActualPoint[]> {
    return resolveAfter(predictionVsActual);
  },
};
