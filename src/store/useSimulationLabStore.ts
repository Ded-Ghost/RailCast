import { create } from "zustand";
import { defaultSimulationControls } from "@/data";
import { formatElapsedLabel } from "@/lib/timeMath";
import {
  advancePlaybackKm,
  computeEffectiveSpeedKmh,
  getCorridorTotalKm,
  runScenario,
  type ScenarioInput,
} from "@/simulation/simulationLabEngine";
import type {
  CongestionLevel,
  DwellTime,
  PlaybackSpeed,
  SimulationState,
  WeatherCondition,
} from "@/types";

/** Real ms between playback ticks — the "controlled interval" for Simulation Lab, independent of the live Train Details feed's own interval. */
const REAL_TICK_INTERVAL_MS = 1000;
/** Simulated schedule-minutes advanced per tick at 1x playback speed; scaled by the playbackSpeed control (1x/2x/5x). */
const BASE_SIM_MINUTES_PER_TICK = 0.5;

type DerivedFields = Pick<
  SimulationState,
  "simulatedEta" | "nextStationCode" | "etaImpactMinutes" | "bottleneckRiskLevel" | "stationForecast" | "elapsedLabel"
>;

function computeDerived(controls: ScenarioInput, elapsedSeconds: number): DerivedFields {
  const result = runScenario(controls);
  return {
    simulatedEta: result.simulatedEta,
    nextStationCode: result.nextStationCode,
    etaImpactMinutes: result.etaImpactMinutes,
    bottleneckRiskLevel: result.bottleneckRiskLevel,
    stationForecast: result.stationForecast,
    elapsedLabel: formatElapsedLabel(elapsedSeconds),
  };
}

function buildInitialState(): SimulationState {
  const controls: ScenarioInput = {
    targetSpeedKmh: defaultSimulationControls.targetSpeedKmh,
    congestionLevel: defaultSimulationControls.congestionLevel,
    stationDwellTime: defaultSimulationControls.stationDwellTime,
    weatherCondition: defaultSimulationControls.weatherCondition,
    delayInjectionMinutes: defaultSimulationControls.delayInjectionMinutes,
    distanceTraveledKm: 0,
  };
  // isRunning always starts false here regardless of defaultSimulationControls —
  // nothing is actually ticking until something calls play(). The Simulation
  // Lab page calls play() once on mount to reproduce the "already running"
  // demo feel from the original mockup, the same way Train Details' mount
  // effect starts the live feed (see hooks/useTrains.ts's useTrain).
  return {
    ...defaultSimulationControls,
    isRunning: false,
    elapsedSeconds: 0,
    distanceTraveledKm: 0,
    ...computeDerived(controls, 0),
  };
}

interface SimulationLabStoreState extends SimulationState {
  setTargetSpeed: (kmh: number) => void;
  setCongestionLevel: (level: CongestionLevel) => void;
  setStationDwellTime: (dwell: DwellTime) => void;
  setWeatherCondition: (weather: WeatherCondition) => void;
  setDelayInjection: (minutes: number) => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  play: () => void;
  pause: () => void;
  reset: () => void;
}

// Module-level interval handle — the only setInterval Simulation Lab ever
// creates, entirely independent of the page's lifecycle. play()/pause()
// are idempotent-safe: calling play() twice never spawns a second interval.
let intervalHandle: ReturnType<typeof setInterval> | null = null;

function stopInterval() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

/**
 * Drives Simulation Lab's interactive what-if scenario: holds the control
 * inputs (target speed, congestion, dwell, weather, injected delay,
 * playback speed) and the derived outputs (simulated ETA, ETA impact,
 * bottleneck risk, per-station forecast), recalculating the derived side
 * deterministically — via simulation/simulationLabEngine — every time a
 * control changes AND on every playback tick. Distinct from
 * store/useSimulationStore.ts, which drives the always-on live feed for
 * Train Details; this one only advances while the user presses Play.
 */
export const useSimulationLabStore = create<SimulationLabStoreState>((set, get) => ({
  ...buildInitialState(),

  setTargetSpeed: (kmh) =>
    set((state) => ({ targetSpeedKmh: kmh, ...computeDerived({ ...state, targetSpeedKmh: kmh }, state.elapsedSeconds) })),

  setCongestionLevel: (level) =>
    set((state) => ({
      congestionLevel: level,
      ...computeDerived({ ...state, congestionLevel: level }, state.elapsedSeconds),
    })),

  setStationDwellTime: (dwell) =>
    set((state) => ({
      stationDwellTime: dwell,
      ...computeDerived({ ...state, stationDwellTime: dwell }, state.elapsedSeconds),
    })),

  setWeatherCondition: (weather) =>
    set((state) => ({
      weatherCondition: weather,
      ...computeDerived({ ...state, weatherCondition: weather }, state.elapsedSeconds),
    })),

  setDelayInjection: (minutes) =>
    set((state) => ({
      delayInjectionMinutes: minutes,
      ...computeDerived({ ...state, delayInjectionMinutes: minutes }, state.elapsedSeconds),
    })),

  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  play: () => {
    if (intervalHandle) return;
    set({ isRunning: true });
    intervalHandle = setInterval(() => {
      const state = get();
      const effectiveSpeedKmh = computeEffectiveSpeedKmh(state);
      const simMinutesElapsed = BASE_SIM_MINUTES_PER_TICK * state.playbackSpeed;
      const corridorTotalKm = getCorridorTotalKm();
      const nextDistanceKm = advancePlaybackKm(state.distanceTraveledKm, effectiveSpeedKmh, simMinutesElapsed, corridorTotalKm);
      const nextElapsedSeconds = state.elapsedSeconds + REAL_TICK_INTERVAL_MS / 1000;
      const reachedDestination = nextDistanceKm >= corridorTotalKm;

      set({
        distanceTraveledKm: nextDistanceKm,
        elapsedSeconds: nextElapsedSeconds,
        isRunning: !reachedDestination,
        ...computeDerived({ ...state, distanceTraveledKm: nextDistanceKm }, nextElapsedSeconds),
      });

      if (reachedDestination) stopInterval();
    }, REAL_TICK_INTERVAL_MS);
  },

  pause: () => {
    stopInterval();
    set({ isRunning: false });
  },

  reset: () => {
    stopInterval();
    set({ ...buildInitialState(), isRunning: false });
  },
}));
