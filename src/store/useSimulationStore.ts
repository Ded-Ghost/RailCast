import { useMemo } from "react";
import { create } from "zustand";
import type { EtaHistoryPoint } from "@/data/etaHistory";
import type { Prediction, Train, TrainRouteProgress } from "@/types";
import {
  createEngineStateFromTrain,
  deriveLiveData,
  stepEngine,
  needsResync,
  TICK_INTERVAL_MS,
  type SimulationEngineState,
} from "@/simulation/trainSimulationEngine";
import { alertService } from "@/services/alertService";
import { useNetworkStore } from "@/store/useNetworkStore";
import { trainService } from "@/services/trainService";

/**
 * Drives the live feed for whichever train the user is currently looking at.
 *
 * Two clocks run here. Every 5 seconds the engine advances the train a little
 * (see simulation/trainSimulationEngine.ts for why); every 30 seconds the
 * store re-fetches the real status and route from the backend and rebuilds
 * engine state from that, so extrapolation never accumulates for long.
 *
 * It is train-agnostic: `start(train)` takes whichever real Train the page
 * loaded and fetches that train's real route. Nothing here knows or cares
 * which train number it is.
 *
 * Distinct from store/useSimulationLabStore.ts, which runs user-authored
 * what-if scenarios rather than tracking reality.
 */

interface SimulationStoreState {
  /** Train currently being tracked, or null when nothing is. */
  activeTrainId: string | null;

  isRunning: boolean;

  /** Wall-clock ms of the last tick — drives "updated Ns ago" readouts. */
  lastUpdatedAt: number;

  /** Wall-clock ms of the last successful backend resync. */
  lastSyncedAt: number;

  /** True while a resync request is in flight. */
  isSyncing: boolean;

  /** Set when the most recent resync failed; the simulation keeps running regardless. */
  syncError: string | null;

  engineState: SimulationEngineState | null;

  train: Train | null;
  prediction: Prediction | null;
  routeProgress: TrainRouteProgress | null;
  etaHistory: EtaHistoryPoint[];

  /** Begin tracking a real train. Safe to call repeatedly with the same train. */
  start: (train: Train) => void;

  /** Stop tracking and clear state. */
  stop: () => void;

  /** Re-fetch live status + route and rebase the engine on them. */
  resync: () => Promise<void>;

  /** Snapshot for one train, or null when that train is not the active one. */
  getDataForTrain: (trainId: string) => {
    train: Train;
    prediction: Prediction;
    routeProgress: TrainRouteProgress;
    etaHistory: EtaHistoryPoint[];
  } | null;
}

/** The single interval this store ever creates. */
let intervalHandle: ReturnType<typeof setInterval> | null = null;

function clearTicker() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

export const useSimulationStore = create<SimulationStoreState>((set, get) => ({
  activeTrainId: null,
  isRunning: false,
  lastUpdatedAt: Date.now(),
  lastSyncedAt: 0,
  isSyncing: false,
  syncError: null,
  engineState: null,
  train: null,
  prediction: null,
  routeProgress: null,
  etaHistory: [],

  start: (train: Train) => {
    // Re-starting the train already being tracked would throw away its
    // accumulated ETA history and restart the ticker for no reason.
    if (get().activeTrainId === train.id && get().isRunning) return;

    clearTicker();

    // Seed from the train we already have so the page renders immediately;
    // the route arrives a moment later and the engine rebases onto it.
    const engineState = createEngineStateFromTrain(train, null);
    const derived = deriveLiveData(engineState, []);

    set({
      activeTrainId: train.id,
      isRunning: true,
      engineState,
      train: derived.train,
      prediction: derived.prediction,
      routeProgress: derived.routeProgress,
      etaHistory: derived.etaHistory,
      lastUpdatedAt: Date.now(),
      lastSyncedAt: 0,
      syncError: null,
    });

    void get().resync();

    intervalHandle = setInterval(() => {
      const state = get();
      if (!state.engineState || !state.train || !state.isRunning) return;

      if (needsResync(state.engineState)) {
        void state.resync();
        return;
      }

      const previousTrain = state.train;
      const nextEngineState = stepEngine(state.engineState);
      const derived = deriveLiveData(nextEngineState, state.etaHistory);

      const newAlerts = alertService.evaluate({
        trainId: derived.train.id,
        trainName: derived.train.name,
        previous: {
          delayMinutes: previousTrain.delayMinutes,
          delayStatus: previousTrain.delayStatus,
          predictedEta: previousTrain.predictedEta,
          currentSpeedKmh: previousTrain.currentSpeedKmh,
          currentStationName: previousTrain.currentStationName,
        },
        current: {
          delayMinutes: derived.train.delayMinutes,
          delayStatus: derived.train.delayStatus,
          predictedEta: derived.train.predictedEta,
          currentSpeedKmh: derived.train.currentSpeedKmh,
          currentStationName: derived.train.currentStationName,
        },
      });

      if (newAlerts.length > 0) {
        useNetworkStore.getState().prependAlerts(newAlerts);
      }

      set({
        engineState: nextEngineState,
        train: derived.train,
        prediction: derived.prediction,
        routeProgress: derived.routeProgress,
        etaHistory: derived.etaHistory,
        lastUpdatedAt: Date.now(),
      });
    }, TICK_INTERVAL_MS);
  },

  stop: () => {
    clearTicker();
    set({
      activeTrainId: null,
      isRunning: false,
      engineState: null,
      train: null,
      prediction: null,
      routeProgress: null,
      etaHistory: [],
      isSyncing: false,
      syncError: null,
    });
  },

  resync: async () => {
    const { activeTrainId, isSyncing } = get();
    if (!activeTrainId || isSyncing) return;

    set({ isSyncing: true });

    try {
      // Status and route are independent reads; fetching them together keeps
      // the rebase atomic — a position from one refresh is never paired with
      // a route from a different one.
      const [freshTrain, freshRoute] = await Promise.all([
        trainService.getLiveStatus(activeTrainId),
        trainService.getRouteProgress(activeTrainId),
      ]);

      // The user may have navigated to a different train mid-flight.
      if (get().activeTrainId !== activeTrainId) return;

      if (!freshTrain) {
        set({ isSyncing: false, syncError: "Live status unavailable. Continuing from the last known position." });
        return;
      }

      const engineState = createEngineStateFromTrain(freshTrain, freshRoute);
      const derived = deriveLiveData(engineState, get().etaHistory);

      set({
        engineState,
        train: derived.train,
        prediction: derived.prediction,
        routeProgress: derived.routeProgress,
        etaHistory: derived.etaHistory,
        lastUpdatedAt: Date.now(),
        lastSyncedAt: Date.now(),
        isSyncing: false,
        syncError: null,
      });
    } catch {
      // A failed resync is not fatal: the engine keeps extrapolating from the
      // last good fix, which is exactly what it is for.
      set({
        isSyncing: false,
        syncError: "Could not reach the live feed. Showing simulated position.",
      });
    }
  },

  getDataForTrain: (trainId: string) => {
    const state = get();
    if (state.activeTrainId !== trainId || !state.train || !state.prediction || !state.routeProgress) {
      return null;
    }
    return {
      train: state.train,
      prediction: state.prediction,
      routeProgress: state.routeProgress,
      etaHistory: state.etaHistory,
    };
  },
}));

/**
 * Simulation snapshot for a train, or null when it is not the tracked one.
 *
 * Each field is selected separately and reassembled in a memo rather than
 * selected as one object. Zustand compares a selector's result by reference,
 * so a selector that builds a fresh object every call never compares equal —
 * which makes the component re-render on every store change and trips React's
 * "getSnapshot should be cached" warning under useSyncExternalStore. The
 * individual fields are stable references set by the store, so this form
 * re-renders only when something actually changed.
 */
export function useTrainSimulation(trainId: string) {
  const isActive = useSimulationStore((state) => state.activeTrainId === trainId);
  const train = useSimulationStore((state) => state.train);
  const prediction = useSimulationStore((state) => state.prediction);
  const routeProgress = useSimulationStore((state) => state.routeProgress);
  const etaHistory = useSimulationStore((state) => state.etaHistory);

  return useMemo(() => {
    if (!isActive || !train || !prediction || !routeProgress) return null;
    return { train, prediction, routeProgress, etaHistory };
  }, [isActive, train, prediction, routeProgress, etaHistory]);
}

/** Whether a given train is the one currently being tracked. */
export function useIsTrainSimulated(trainId: string) {
  return useSimulationStore((state) => state.activeTrainId === trainId && state.isRunning);
}
