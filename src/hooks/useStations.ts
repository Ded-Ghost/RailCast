import { useEffect, useState } from "react";
import type { AsyncState, Station } from "@/types";
import { networkService } from "@/services/networkService";

/** Loads station master data — powers map station markers/labels. */
export function useStations(): AsyncState<Station[]> {
  const [data, setData] = useState<Station[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    networkService
      .getStations()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load station data.");
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
