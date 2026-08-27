import { useEffect, useState } from "react";
import type { DataSourceStatus, WeatherSnapshot } from "@/types";
import { weatherService, type WeatherFetchTarget } from "@/services/weatherService";

const POLL_INTERVAL_MS = 10 * 60 * 1000; // weather doesn't need second-by-second polling
const STALE_AFTER_MS = 20 * 60 * 1000; // two missed refreshes before calling it stale

export interface UseCurrentWeatherResult {
  data: WeatherSnapshot | null;
  status: DataSourceStatus;
  isLoading: boolean;
}

/**
 * Genuinely live weather for one point on the corridor, via the real
 * Open-Meteo API (see services/weatherService.ts) — polled periodically,
 * not faked. Reports "offline" if the first fetch never succeeds, "stale"
 * if a previously-successful reading is aging past two poll cycles, and
 * "live" otherwise. Never reports "live" without an actual successful
 * response backing it.
 */
export function useCurrentWeather(target: WeatherFetchTarget | null): UseCurrentWeatherResult {
  const [data, setData] = useState<WeatherSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [lastFetchFailed, setLastFetchFailed] = useState(false);

  useEffect(() => {
    if (!target) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;

    function fetchWeather() {
      setIsLoading(true);
      weatherService
        .getCurrentWeather(target as WeatherFetchTarget)
        .then((result) => {
          if (cancelled) return;
          setData(result);
          setLastFetchedAt(Date.now());
          setLastFetchFailed(false);
        })
        .catch(() => {
          if (!cancelled) setLastFetchFailed(true);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }

    fetchWeather();
    const interval = setInterval(fetchWeather, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.stationCode, target?.position.lat, target?.position.lng]);

  let status: DataSourceStatus;
  if (!data || lastFetchedAt === null) {
    status = "offline";
  } else if (lastFetchFailed) {
    status = "stale";
  } else {
    status = Date.now() - lastFetchedAt > STALE_AFTER_MS ? "stale" : "live";
  }

  return { data, status, isLoading };
}
