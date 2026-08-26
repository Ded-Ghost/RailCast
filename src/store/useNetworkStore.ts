import { create } from "zustand";
import type { AlertItem, Train } from "@/types";

interface NetworkStoreState {
  trains: Train[];
  alerts: AlertItem[];
  isLiveMode: boolean;
  selectedTrainId: string | null;

  setTrains: (trains: Train[]) => void;
  setAlerts: (alerts: AlertItem[]) => void;
  selectTrain: (trainId: string | null) => void;
  toggleLiveMode: () => void;
  markAlertRead: (alertId: string) => void;
  markAllAlertsRead: () => void;
}

/**
 * Holds cross-page network state (live trains, alerts) so pages like
 * Dashboard, Live Network, and Alerts stay in sync without prop drilling.
 * Populated via the service layer (see hooks/useTrains, hooks/useAlerts) —
 * this store never fetches data itself.
 */
export const useNetworkStore = create<NetworkStoreState>((set) => ({
  trains: [],
  alerts: [],
  isLiveMode: true,
  selectedTrainId: null,

  setTrains: (trains) => set({ trains }),
  setAlerts: (alerts) => set({ alerts }),
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
