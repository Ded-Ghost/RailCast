import { useEffect, useRef, useState } from "react";
import type { DataSourceStatus, LiveTrainSnapshot } from "@/types";
import { liveTrainService } from "@/services/liveTrainService";

const POLL_INTERVAL_MS = 15000;

export interface UseLiveTrainFeedResult {
  data: LiveTrainSnapshot | null;
  status: DataSourceStatus;
  /** Human-readable reason for a non-"live" status — e.g. "not configured on this deployment", "Train 98765 isn't currently tracked live". */
  message: string | null;
}

/**
 * Real live position for one train number, via our backend proxy (see
 * services/liveTrainService.ts and api/trains/[number]/live.js) — never
 * fabricated. Reports "offline" until a backend + provider key exist,
 * "unavailable" if the provider doesn't track this specific train,
 * "stale" if a previously-successful reading is aging past a missed
 * poll, and "live" only when a poll just succeeded.
 */
export function useLiveTrainFeed(trainNumber: string | null): UseLiveTrainFeedResult {
  const [data, setData] = useState<LiveTrainSnapshot | null>(null);
  const [status, setStatus] = useState<DataSourceStatus>("offline");
  const [message, setMessage] = useState<string | null>(null);
  const hasReceivedDataRef = useRef(false);

  useEffect(() => {
    if (!trainNumber) {
      setData(null);
      setStatus("offline");
      setMessage(null);
      hasReceivedDataRef.current = false;
      return;
    }

    let cancelled = false;

    async function poll() {
      const result = await liveTrainService.getLiveTrain(trainNumber as string);
      if (cancelled) return;

      if (result.kind === "success") {
        setData(result.data);
        setStatus("live");
        setMessage(null);
        hasReceivedDataRef.current = true;
        return;
      }
      if (result.kind === "not_configured") {
        setStatus("offline");
        setMessage("Live position isn't configured on this deployment yet.");
        return;
      }
      if (result.kind === "not_found") {
        setStatus("unavailable");
        setMessage(`Train ${trainNumber} isn't currently tracked live.`);
        return;
      }
      setStatus(hasReceivedDataRef.current ? "stale" : "offline");
      setMessage(result.message);
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [trainNumber]);

  return { data, status, message };
}
