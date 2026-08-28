import { useCallback, useEffect, useRef, useState } from "react";
import type { AsyncState, Train } from "@/types";
import { trainService } from "@/services/trainService";
import { useNetworkStore } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";

/**
 * Async state plus refresh bookkeeping.
 *
 * `isLoading` is true only on the very first load, when there is genuinely
 * nothing to show. Subsequent polls set `isRefreshing` instead and leave the
 * previous data in place — swapping a populated dashboard for skeletons every
 * thirty seconds makes a working feed look broken.
 */
export interface LiveAsyncState<T> extends AsyncState<T> {
  isRefreshing: boolean;
  /** Wall-clock ms of the last successful load, or null before the first one. */
  lastUpdatedAt: number | null;
  refresh: () => void;
}

/**
 * Shared polling machinery.
 *
 * Overlapping requests are the thing to avoid here: a slow backend plus a
 * fixed interval will otherwise stack requests until each poll is racing
 * several of its predecessors, and whichever resolves last wins regardless of
 * how stale it is. A single in-flight flag means a tick that arrives while a
 * request is outstanding is simply skipped.
 */
function usePolledResource<T>(
  load: () => Promise<T>,
  isEmpty: (value: T) => boolean,
  deps: unknown[],
): LiveAsyncState<T> & { data: T | null } {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const isMounted = useRef(true);
  const inFlight = useRef(false);
  const hasData = useRef(false);
  const loadRef = useRef(load);
  loadRef.current = load;
  // Read once per effect run rather than subscribing — a mid-poll interval
  // change takes effect on the next mount/dep-change, not by tearing down an
  // in-flight request.
  const refreshIntervalSeconds = useSettingsStore((s) => s.refreshIntervalSeconds);

  const run = useCallback(async () => {
    if (inFlight.current) return; // a poll is already outstanding — skip this tick
    inFlight.current = true;

    if (hasData.current) setIsRefreshing(true);

    try {
      const result = await loadRef.current();
      if (!isMounted.current) return;

      if (isEmpty(result)) {
        // Keep whatever is on screen; an empty response is usually the backend
        // being unreachable, not the network genuinely having no trains.
        setError(hasData.current ? "Live refresh failed — showing the last known data." : "No live train data available.");
      } else {
        setData(result);
        hasData.current = true;
        setLastUpdatedAt(Date.now());
        setError(null);
      }
    } catch {
      if (isMounted.current) {
        setError(hasData.current ? "Live refresh failed — showing the last known data." : "Unable to load train data.");
      }
    } finally {
      inFlight.current = false;
      if (isMounted.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
    // isEmpty is a stable predicate supplied by each caller below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    isMounted.current = true;
    void run(); // fetch immediately on mount, then settle into the interval
    const interval = setInterval(() => void run(), refreshIntervalSeconds * 1000);
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, refreshIntervalSeconds]);

  return { data, isLoading, isRefreshing, error, lastUpdatedAt, refresh: () => void run() };
}

/**
 * The browse list of trains, refreshed every 30 seconds from the backend.
 * Results are mirrored into the network store so the map and side panels all
 * read one copy.
 */
export function useTrains(): LiveAsyncState<Train[]> {
  const trains = useNetworkStore((state) => state.trains);
  const setTrains = useNetworkStore((state) => state.setTrains);

  const state = usePolledResource<Train[]>(
    async () => {
      const result = await trainService.listTrains();
      if (result.length > 0) setTrains(result);
      return result;
    },
    (value) => value.length === 0,
    [setTrains],
  );

  // The store is the source of truth for the list so that a selection made on
  // one page is still valid on the next.
  return { ...state, data: trains ?? state.data };
}

/** The N trains running latest, refreshed on the same cadence. */
export function usePriorityTrains(limit = 4): LiveAsyncState<Train[]> {
  return usePolledResource<Train[]>(
    () => trainService.getPriorityTrains(limit),
    (value) => value.length === 0,
    [limit],
  );
}

/**
 * A single train's live status, polled every 30 seconds.
 *
 * Between polls, Train Details reads the simulation store instead — that is
 * what advances the position every five seconds. This hook supplies the
 * ground truth the simulation is periodically rebased onto.
 */
export function useTrain(trainId: string | undefined): LiveAsyncState<Train> {
  return usePolledResource<Train | null>(
    () => (trainId ? trainService.getLiveStatus(trainId) : Promise.resolve(null)),
    (value) => value === null,
    [trainId],
  ) as LiveAsyncState<Train>;
}
