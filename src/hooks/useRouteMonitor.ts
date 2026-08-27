import { useEffect, useState } from "react";
import type { AsyncState, RailwaySection, Station } from "@/types";
import { routeService } from "@/services/routeService";

/** Ordered real stations along the Bhubaneswar → New Delhi corridor. */
export function useCorridorStations(): AsyncState<Station[]> {
  const [data, setData] = useState<Station[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    routeService
      .getCorridorStations()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load route stations.");
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

/** Section-by-section health (congestion, speed, delay contribution) for the corridor. */
export function useRailwaySections(): AsyncState<RailwaySection[]> {
  const [data, setData] = useState<RailwaySection[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    routeService
      .getRailwaySections()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load section health.");
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
