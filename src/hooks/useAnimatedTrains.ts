import { useEffect, useMemo, useRef, useState } from "react";
import type { Train, TrainRouteProgress } from "@/types";
import { trainService } from "@/services/trainService";
import {
  createEngineStateFromTrain,
  deriveLiveData,
  stepEngine,
  TICK_INTERVAL_MS,
  type SimulationEngineState,
} from "@/simulation/trainSimulationEngine";

/**
 * Keeps a whole list of trains moving on the map between backend refreshes.
 *
 * The backend places each train correctly, but the list is only re-fetched
 * every 30 seconds — long enough that markers would visibly jump rather than
 * travel. This runs one simulation engine per train and steps them all every
 * 5 seconds, so the map animates continuously while remaining anchored to real
 * data: each poll re-seeds every engine from the freshly fetched train, so
 * extrapolation is discarded rather than compounded.
 *
 * Where store/useSimulationStore.ts tracks the single train a user has opened
 * (and carries prediction, route and ETA history with it), this is the
 * lightweight many-train version used purely for marker positions.
 */
export function useAnimatedTrains(trains: Train[]): Train[] {
  const engines = useRef(new Map<string, SimulationEngineState>());

  /**
   * Routes are fetched once per train and kept for the life of the page.
   * A published timetable does not change between two polls thirty seconds
   * apart, so re-fetching one per train per poll would be pure waste.
   */
  const routes = useRef(new Map<string, TrainRouteProgress | null>());

  // Bumped whenever positions change, to drive a re-render. The engine states
  // live in refs because they are stepped in place; this counter is what tells
  // React that the derived output is now different.
  const [tick, setTick] = useState(0);

  // Re-seed every engine whenever a fresh batch of trains arrives.
  useEffect(() => {
    if (trains.length === 0) return;
    let cancelled = false;

    void (async () => {
      for (const train of trains) {
        let route = routes.current.get(train.id);
        if (route === undefined) {
          route = await trainService.getRouteProgress(train.id);
          if (cancelled) return;
          routes.current.set(train.id, route);
        }
        engines.current.set(train.id, createEngineStateFromTrain(train, route));
      }

      // Drop engines for trains no longer in the list, so a long session does
      // not accumulate state for trains nobody is looking at.
      const live = new Set(trains.map((train) => train.id));
      for (const id of engines.current.keys()) {
        if (!live.has(id)) engines.current.delete(id);
      }

      if (!cancelled) setTick((value) => value + 1);
    })();

    return () => {
      cancelled = true;
    };
  }, [trains]);

  // Advance every engine on the shared 5-second cadence.
  useEffect(() => {
    const interval = setInterval(() => {
      if (engines.current.size === 0) return;
      for (const [id, state] of engines.current) {
        engines.current.set(id, stepEngine(state));
      }
      setTick((value) => value + 1);
    }, TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return useMemo(
    () =>
      trains.map((train) => {
        const state = engines.current.get(train.id);
        // No engine yet (route still loading) — show the backend's own
        // position rather than hiding the train.
        if (!state) return train;
        return deriveLiveData(state, []).train;
      }),
    // `tick` is the signal that the engines have moved; it is intentionally
    // the only other dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trains, tick],
  );
}
