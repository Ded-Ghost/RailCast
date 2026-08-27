import { useEffect, useState } from "react";
import type { AsyncState, RouteSection } from "@/types";
import type { DelayCauseBreakdown, DelayIntelligenceSummary, DelayTrendPoint } from "@/data";
import { networkService } from "@/services/networkService";

export function useDelayIntelligenceSummary(): AsyncState<DelayIntelligenceSummary> {
  const [data, setData] = useState<DelayIntelligenceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    networkService
      .getDelayIntelligenceSummary()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load delay summary.");
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

export function useDelayCauseBreakdown(): AsyncState<DelayCauseBreakdown[]> {
  const [data, setData] = useState<DelayCauseBreakdown[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    networkService
      .getDelayCauseBreakdown()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load delay causes.");
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

/** Network-wide worst-performing named sections (distinct from the geographic RailwaySection list — see types/route.ts). */
export function useWorstPerformingSections(): AsyncState<RouteSection[]> {
  const [data, setData] = useState<RouteSection[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    networkService
      .getRouteSections()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load section performance.");
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

export function useDelayTrend(): AsyncState<DelayTrendPoint[]> {
  const [data, setData] = useState<DelayTrendPoint[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    networkService
      .getDelayTrend()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load delay trend.");
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
