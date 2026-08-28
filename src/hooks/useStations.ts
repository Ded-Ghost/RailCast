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

let allStationsCache: Promise<Station[]> | null = null;

/**
 * Every station in the database (~1,100), fetched once per page session and
 * shared across every caller — this is what lets a real map reveal more
 * stations as the user zooms in without a network round-trip per zoom step.
 * Deliberately module-level (not component state): Dashboard and Live
 * Network both want this list, and there is exactly one real answer to
 * "every station" regardless of which page asked first.
 */
export function useAllStations(): AsyncState<Station[]> {
  const [data, setData] = useState<Station[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!allStationsCache) allStationsCache = networkService.getAllStations();

    allStationsCache
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load the full station list.");
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
