import { useEffect, useState } from "react";
import type { AsyncState, Train } from "@/types";
import { trainService } from "@/services/trainService";
import { useNetworkStore } from "@/store/useNetworkStore";
import { useSimulationStore } from "@/store/useSimulationStore";
import { PRIMARY_DEMO_TRAIN_ID } from "@/data";

/**
 * Loads the full live train list into the network store, then swaps the
 * primary demo train's entry for its live simulated state — see
 * store/useSimulationStore.ts. Every other train stays as static mock data.
 */
export function useTrains(): AsyncState<Train[]> {
  const trains = useNetworkStore((state) => state.trains);
  const setTrains = useNetworkStore((state) => state.setTrains);
  const liveTrain = useSimulationStore((state) => state.train);
  const startSimulation = useSimulationStore((state) => state.start);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startSimulation();
  }, [startSimulation]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    trainService
      .listTrains()
      .then((data) => {
        if (cancelled) return;
        setTrains(data);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load live train data.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setTrains]);

  const mergedTrains = trains.map((train) => (train.id === PRIMARY_DEMO_TRAIN_ID ? liveTrain : train));

  return { data: mergedTrains, isLoading, error };
}

/**
 * Loads the top-N priority (highest-delay) trains for dashboard widgets.
 * If the primary demo train is among them, its entry is kept live too.
 */
export function usePriorityTrains(limit = 4): AsyncState<Train[]> {
  const liveTrain = useSimulationStore((state) => state.train);
  const startSimulation = useSimulationStore((state) => state.start);
  const [data, setData] = useState<Train[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startSimulation();
  }, [startSimulation]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    trainService
      .getPriorityTrains(limit)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load priority trains.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [limit]);

  const mergedData = data?.map((train) => (train.id === PRIMARY_DEMO_TRAIN_ID ? liveTrain : train)) ?? null;

  return { data: mergedData, isLoading, error };
}

/**
 * Loads a single train by id — powers Train Details / Train Search. For
 * the primary demo train, this subscribes to the live simulation instead
 * of the one-shot mock fetch, so the UI updates on every simulation tick.
 */
export function useTrain(trainId: string | undefined): AsyncState<Train> {
  const isLiveDemo = trainId === PRIMARY_DEMO_TRAIN_ID;
  const liveTrain = useSimulationStore((state) => state.train);
  const startSimulation = useSimulationStore((state) => state.start);

  const [data, setData] = useState<Train | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLiveDemo) {
      startSimulation();
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
      .getTrain(trainId)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(result ? null : "Train not found.");
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load train details.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trainId, isLiveDemo, startSimulation]);

  if (isLiveDemo) {
    return { data: liveTrain, isLoading: false, error: null };
  }
  return { data, isLoading, error };
}
