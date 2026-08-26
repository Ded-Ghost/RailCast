import { useEffect, useState } from "react";

/**
 * Re-renders once a second so a "last updated" display stays fresh, without
 * the caller needing its own interval. Returns whole seconds elapsed since
 * `timestampMs` (a real `Date.now()` value, e.g. the simulation store's
 * `lastUpdatedAt`).
 */
export function useElapsedSeconds(timestampMs: number): number {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return Math.max(0, Math.round((Date.now() - timestampMs) / 1000));
}
