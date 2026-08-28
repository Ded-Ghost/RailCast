import { create } from "zustand";
import type { AlertItem, Train } from "@/types";

const MAX_ALERTS = 30;
/** ~40 min of history at the default 30s poll cadence — enough for a trend line without growing unboundedly across a long session. */
const MAX_TREND_POINTS = 80;

export interface NetworkDelayTrendPoint {
  time: string; // "HH:MM:SS"
  avgDelayMinutes: number;
  trackedTrains: number;
}

interface NetworkStoreState {
  trains: Train[];
  alerts: AlertItem[];
  isLiveMode: boolean;
  selectedTrainId: string | null;
  /**
   * Real network-average-delay samples, accumulated one per successful poll
   * of the network-wide alert watcher (see hooks/useNetworkAlertWatcher).
   * Starts empty and grows as the session runs — there is no historical
   * network-wide series to seed it with, matching the same honest pattern
   * used by a single train's ETA history.
   */
  delayTrendHistory: NetworkDelayTrendPoint[];

  setTrains: (trains: Train[]) => void;
  /** Adds newly-generated alerts (see alertService.evaluate) to the front of the list, capped so a long-running demo session doesn't grow this unboundedly. */
  prependAlerts: (alerts: AlertItem[]) => void;
  pushDelayTrendPoint: (point: NetworkDelayTrendPoint) => void;
  selectTrain: (trainId: string | null) => void;
  toggleLiveMode: () => void;
  markAlertRead: (alertId: string) => void;
  markAllAlertsRead: () => void;
}

/**
 * Holds cross-page network state (live trains, alerts) so pages like
 * Dashboard, Live Network, and Alerts stay in sync without prop drilling.
 * `trains` is populated by hooks/useTrains's polling; `alerts` and
 * `delayTrendHistory` are populated by hooks/useNetworkAlertWatcher (mounted
 * once at the App root) and store/useSimulationStore's tick loop — this
 * store never fetches or evaluates anything itself.
 */
export const useNetworkStore = create<NetworkStoreState>((set) => ({
  trains: [],
  alerts: [],
  isLiveMode: true,
  selectedTrainId: null,
  delayTrendHistory: [],

  setTrains: (trains) => set({ trains }),
  prependAlerts: (newAlerts) =>
    set((state) => ({
      alerts: newAlerts.length ? [...newAlerts, ...state.alerts].slice(0, MAX_ALERTS) : state.alerts,
    })),
  pushDelayTrendPoint: (point) =>
    set((state) => ({
      delayTrendHistory: [...state.delayTrendHistory, point].slice(-MAX_TREND_POINTS),
    })),
  selectTrain: (trainId) => set({ selectedTrainId: trainId }),
  toggleLiveMode: () => set((state) => ({ isLiveMode: !state.isLiveMode })),
  markAlertRead: (alertId) =>
    set((state) => ({
      alerts: state.alerts.map((alert) =>
        alert.id === alertId ? { ...alert, read: true } : alert,
      ),
    })),
  markAllAlertsRead: () =>
    set((state) => ({
      alerts: state.alerts.map((alert) => ({ ...alert, read: true })),
    })),
}));
