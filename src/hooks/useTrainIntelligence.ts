import { useEffect, useState } from "react";
import type { AsyncState, Prediction, TrainRouteProgress } from "@/types";
import type { EtaHistoryPoint } from "@/data/etaHistory";
import { PRIMARY_DEMO_TRAIN_ID } from "@/data";
import { trainService } from "@/services/trainService";
import { useSimulationStore } from "@/store/useSimulationStore";

/**
 * Confidence/range/contributing-factor breakdown for a train's predicted
 * ETA — powers "Why This ETA?". For the primary demo train this subscribes
 * to the live simulation instead of a one-shot fetch.
 */
export function usePrediction(trainId: string | undefined): AsyncState<Prediction> {
  const isLiveDemo = trainId === PRIMARY_DEMO_TRAIN_ID;
  const livePrediction = useSimulationStore((state) => state.prediction);
  const startSimulation = useSimulationStore((state) => state.start);

  const [data, setData] = useState<Prediction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLiveDemo) {
      startSimulation();
      setData(null);
      setIsLoading(false);
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
  }, [trainId, isLiveDemo, startSimulation]);

  if (isLiveDemo) {
    return { data: livePrediction, isLoading: false, error: null };
  }
  return { data, isLoading, error };
}

/**
 * Station-by-station schedule/prediction breakdown — powers the route
 * intelligence visualization. Live for the primary demo train.
 */
export function useRouteProgress(trainId: string | undefined): AsyncState<TrainRouteProgress> {
  const isLiveDemo = trainId === PRIMARY_DEMO_TRAIN_ID;
  const liveRouteProgress = useSimulationStore((state) => state.routeProgress);
  const startSimulation = useSimulationStore((state) => state.start);

  const [data, setData] = useState<TrainRouteProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLiveDemo) {
      startSimulation();
      setData(null);
      setIsLoading(false);
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
  }, [trainId, isLiveDemo, startSimulation]);

  if (isLiveDemo) {
    return { data: liveRouteProgress, isLoading: false, error: null };
  }
  return { data, isLoading, error };
}

/**
 * Recent prediction drift — powers the ETA Evolution chart. Live for the
 * primary demo train: a new point is appended on every simulation tick.
 */
export function useEtaHistory(trainId: string | undefined): AsyncState<EtaHistoryPoint[]> {
  const isLiveDemo = trainId === PRIMARY_DEMO_TRAIN_ID;
  const liveEtaHistory = useSimulationStore((state) => state.etaHistory);
  const startSimulation = useSimulationStore((state) => state.start);

  const [data, setData] = useState<EtaHistoryPoint[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLiveDemo) {
      startSimulation();
      setData(null);
      setIsLoading(false);
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
  }, [trainId, isLiveDemo, startSimulation]);

  if (isLiveDemo) {
    return { data: liveEtaHistory, isLoading: false, error: null };
  }
  return { data, isLoading, error };
}
