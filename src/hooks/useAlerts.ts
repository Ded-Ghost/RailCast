import { useEffect, useState } from "react";
import type { AlertItem, AsyncState } from "@/types";
import { alertService } from "@/services/alertService";
import { useNetworkStore } from "@/store/useNetworkStore";

/** Loads all alerts into the network store — powers Alerts page + dashboard panel. */
export function useAlerts(): AsyncState<AlertItem[]> {
  const alerts = useNetworkStore((state) => state.alerts);
  const setAlerts = useNetworkStore((state) => state.setAlerts);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    alertService
      .listAlerts()
      .then((data) => {
        if (cancelled) return;
        setAlerts(data);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load alerts.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setAlerts]);

  return { data: alerts, isLoading, error };
}
