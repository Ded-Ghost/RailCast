import { useEffect, useState } from "react";
import type { AsyncState, Prediction, TrainRouteProgress } from "@/types";
import type { EtaHistoryPoint } from "@/data/etaHistory";
import { trainService } from "@/services/trainService";
import { useTrainSimulation } from "@/store/useSimulationStore";

/**
 * Confidence/range/contributing-factor breakdown for a train's predicted
 * ETA — powers "Why This ETA?".
 *
 * If the train is being simulated, returns live simulation data.
 * Otherwise fetches prediction from the service.
 */
export function usePrediction(trainId: string | undefined): AsyncState<Prediction> {
  const simulationData = useTrainSimulation(trainId ?? "");
  const [data, setData] = useState<Prediction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If this train is being simulated, use simulation data
    if (simulationData) {
      setData(simulationData.prediction);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!trainId) {
      setData(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    trainService
      .getPrediction(trainId)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load prediction data.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [trainId, simulationData]);

  if (simulationData) {
    return { data: simulationData.prediction, isLoading: false, error: null };
  }
  return { data, isLoading, error };
}

/**
 * Station-by-station schedule/prediction breakdown — powers the route
 * intelligence visualization.
 *
 * If the train is being simulated, returns live simulation data.
 * Otherwise fetches route progress from the service.
 */
export function useRouteProgress(trainId: string | undefined): AsyncState<TrainRouteProgress> {
  const simulationData = useTrainSimulation(trainId ?? "");
  const [data, setData] = useState<TrainRouteProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If this train is being simulated, use simulation data
    if (simulationData) {
      setData(simulationData.routeProgress);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!trainId) {
      setData(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    trainService
      .getRouteProgress(trainId)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load route progress.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [trainId, simulationData]);

  if (simulationData) {
    return { data: simulationData.routeProgress, isLoading: false, error: null };
  }
  return { data, isLoading, error };
}

/**
 * Recent prediction drift — powers the ETA Evolution chart.
 *
 * If the train is being simulated, returns live simulation data with
 * a new point appended on every simulation tick.
 * Otherwise fetches ETA history from the service.
 */
export function useEtaHistory(trainId: string | undefined): AsyncState<EtaHistoryPoint[]> {
  const simulationData = useTrainSimulation(trainId ?? "");
  const [data, setData] = useState<EtaHistoryPoint[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If this train is being simulated, use simulation data
    if (simulationData) {
      setData(simulationData.etaHistory);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!trainId) {
      setData(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    trainService
      .getEtaHistory(trainId)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load ETA history.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [trainId, simulationData]);

  if (simulationData) {
    return { data: simulationData.etaHistory, isLoading: false, error: null };
  }
  return { data, isLoading, error };
}
