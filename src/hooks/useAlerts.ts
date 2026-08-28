import type { AlertItem, AsyncState } from "@/types";
import { useNetworkStore } from "@/store/useNetworkStore";

/**
 * Reads the network-wide alert list straight from the store — no fetch here.
 * Population is owned entirely by hooks/useNetworkAlertWatcher, mounted once
 * at the App root, which polls every currently-tracked train and appends a
 * real alert only when its state genuinely crosses a threshold. An earlier
 * version of this hook re-fetched a static (empty) seed list on every mount
 * and overwrote the store with it — which meant simply opening the Alerts
 * page wiped out whatever the watcher had already accumulated.
 */
export function useAlerts(): AsyncState<AlertItem[]> {
  const alerts = useNetworkStore((state) => state.alerts);
  return { data: alerts, isLoading: false, error: null };
}
