import { useEffect, useState } from "react";
import type { AsyncState } from "@/types";
import type {
  PredictionAccuracyMetrics,
  PredictionVsActualPoint,
  RankedPredictionFactor,
} from "@/data";
import { predictionService } from "@/services/predictionService";

export function useRankedFactors(): AsyncState<RankedPredictionFactor[]> {
  const [data, setData] = useState<RankedPredictionFactor[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    predictionService
      .getRankedFactors()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load prediction factors.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading, error };
}

export function useAccuracyMetrics(): AsyncState<PredictionAccuracyMetrics> {
  const [data, setData] = useState<PredictionAccuracyMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    predictionService
      .getAccuracyMetrics()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load accuracy metrics.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading, error };
}

export function usePredictionVsActual(): AsyncState<PredictionVsActualPoint[]> {
  const [data, setData] = useState<PredictionVsActualPoint[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    predictionService
      .getPredictionVsActual()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load prediction history.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading, error };
}
