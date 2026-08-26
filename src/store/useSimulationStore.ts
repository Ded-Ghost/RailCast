import { create } from "zustand";
import type { EtaHistoryPoint } from "@/data/etaHistory";
import { PRIMARY_DEMO_TRAIN_ID, getEtaHistoryForTrain } from "@/data";
import type { Prediction, Train, TrainRouteProgress } from "@/types";
import {
  createInitialEngineState,
  deriveLiveData,
  stepEngine,
  TICK_INTERVAL_MS,
  type EngineState,
} from "@/simulation/trainSimulationEngine";

interface SimulationStoreState {
  isRunning: boolean;
  /** Real wall-clock ms of the last tick — powers the "Updated Xs ago" indicator. */
  lastUpdatedAt: number;
  engineState: EngineState;
  train: Train;
  prediction: Prediction;
  routeProgress: TrainRouteProgress;
  etaHistory: EtaHistoryPoint[];
  /** Idempotent — safe to call from every consumer's mount effect. */
  start: () => void;
  stop: () => void;
}

// A single module-level interval handle, deliberately kept outside React
// state/lifecycle. This is the one and only place a `setInterval` for the
// simulation exists — no page or component ever sets one up directly.
let intervalHandle: ReturnType<typeof setInterval> | null = null;

const initialEngineState = createInitialEngineState();
const initialDerived = deriveLiveData(initialEngineState, getEtaHistoryForTrain(PRIMARY_DEMO_TRAIN_ID));

/**
 * Drives the live simulated feed for the primary demo train (12345).
 * Any hook or component can subscribe to `train` / `prediction` /
 * `routeProgress` / `etaHistory` and re-render automatically as the engine
 * ticks — see hooks/useTrains.ts and hooks/useTrainIntelligence.ts, which
 * swap in this store's data in place of the static mock service for that
 * one train id. Nothing about the store depends on any particular page
 * being mounted; call `start()` once from anywhere and the feed runs for
 * the lifetime of the app.
 */
export const useSimulationStore = create<SimulationStoreState>((set, get) => ({
  isRunning: false,
  lastUpdatedAt: Date.now(),
  engineState: initialEngineState,
  train: initialDerived.train,
  prediction: initialDerived.prediction,
  routeProgress: initialDerived.routeProgress,
  etaHistory: initialDerived.etaHistory,

  start: () => {
    if (intervalHandle) return;
    set({ isRunning: true });
    intervalHandle = setInterval(() => {
      const nextEngineState = stepEngine(get().engineState);
      const derived = deriveLiveData(nextEngineState, get().etaHistory);
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
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
    set({ isRunning: false });
  },
}));
