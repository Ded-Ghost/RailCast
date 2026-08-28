import { create } from "zustand";
import { defaultSimulationControls } from "@/data";
import { formatElapsedLabel } from "@/lib/timeMath";
import { trainService } from "@/services/trainService";
import {
  advancePlaybackKm,
  buildScenarioRoute,
  computeEffectiveSpeedKmh,
  getCorridorTotalKm,
  runScenario,
  type ScenarioInput,
  type ScenarioRoute,
} from "@/simulation/simulationLabEngine";
import type {
  CongestionLevel,
  DwellTime,
  PlaybackSpeed,
  SimulationState,
  Train,
  WeatherCondition,
} from "@/types";

/**
 * Drives Simulation Lab's interactive what-if scenario.
 *
 * The user picks a real train number; the store fetches that train's live
 * status and published route from the backend and hands both to the scenario
 * engine. Control changes and playback ticks recompute the derived outputs
 * deterministically, so the panel can never drift out of step with the map.
 *
 * Distinct from store/useSimulationStore.ts, which tracks reality for Train
 * Details. This one only advances while the user presses Play, and its whole
 * purpose is to show a *counterfactual* — which is why every result is
 * reported alongside the train's real current delay.
 */

/** Real ms between playback ticks. */
const REAL_TICK_INTERVAL_MS = 1000;
/** Simulated schedule-minutes advanced per tick at 1x, scaled by playbackSpeed. */
const BASE_SIM_MINUTES_PER_TICK = 0.5;

type DerivedFields = Pick<
  SimulationState,
  | "simulatedEta"
  | "nextStationCode"
  | "etaImpactMinutes"
  | "bottleneckRiskLevel"
  | "stationForecast"
  | "elapsedLabel"
  | "baselineDelayMinutes"
  | "baselineEta"
  | "deltaVsLiveMinutes"
>;

function computeDerived(controls: ScenarioInput, elapsedSeconds: number): DerivedFields {
  const result = runScenario(controls);
  return {
    simulatedEta: result.simulatedEta,
    nextStationCode: result.nextStationCode,
    etaImpactMinutes: result.etaImpactMinutes,
    bottleneckRiskLevel: result.bottleneckRiskLevel,
    stationForecast: result.stationForecast,
    baselineDelayMinutes: result.baselineDelayMinutes,
    baselineEta: result.baselineEta,
    deltaVsLiveMinutes: result.deltaVsLiveMinutes,
    elapsedLabel: formatElapsedLabel(elapsedSeconds),
  };
}

/** Pulls the current scenario inputs out of the store state. */
function toScenarioInput(state: SimulationLabStoreState, overrides: Partial<ScenarioInput> = {}): ScenarioInput {
  return {
    targetSpeedKmh: state.targetSpeedKmh,
    congestionLevel: state.congestionLevel,
    stationDwellTime: state.stationDwellTime,
    weatherCondition: state.weatherCondition,
    delayInjectionMinutes: state.delayInjectionMinutes,
    distanceTraveledKm: state.distanceTraveledKm,
    route: state.route,
    ...overrides,
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
    route: null,
  };

  return {
    ...defaultSimulationControls,
    // Playback never starts on its own: with a real train involved, autoplaying
    // before the route has loaded would run a scenario against nothing.
    isRunning: false,
    elapsedSeconds: 0,
    distanceTraveledKm: 0,
    trainLabel: "",
    routeLabel: "",
    isLoadingTrain: false,
    trainError: null,
    ...computeDerived(controls, 0),
  };
}

interface SimulationLabStoreState extends SimulationState {
  /** The real train the scenario runs against, once loaded. */
  route: ScenarioRoute | null;
  /** The live Train record behind `route` — used for the map marker. */
  baseTrain: Train | null;

  /** Load any real train number and rebuild the scenario around it. */
  loadTrain: (trainId: string) => Promise<void>;

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

/** The only interval Simulation Lab ever creates. */
let intervalHandle: ReturnType<typeof setInterval> | null = null;
/** Guards against a slow lookup for train A landing after the user has asked for train B. */
let loadToken = 0;

function stopInterval() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

export const useSimulationLabStore = create<SimulationLabStoreState>((set, get) => ({
  ...buildInitialState(),
  route: null,
  baseTrain: null,

  loadTrain: async (trainId: string) => {
    const id = trainId.trim();
    if (!/^\d{4,5}$/.test(id)) {
      set({ trainError: "Enter a 4 or 5 digit train number.", isLoadingTrain: false });
      return;
    }

    const token = ++loadToken;
    stopInterval();
    set({ isLoadingTrain: true, trainError: null, isRunning: false });

    const [train, routeProgress] = await Promise.all([
      trainService.getLiveStatus(id),
      trainService.getRouteProgress(id),
    ]);

    if (token !== loadToken) return; // a newer request has superseded this one

    if (!train || !routeProgress || routeProgress.stops.length < 2) {
      set({
        isLoadingTrain: false,
        trainError: `No route could be loaded for train ${id}. Check the number and try again.`,
        route: null,
        baseTrain: null,
      });
      return;
    }

    const route = buildScenarioRoute(train, routeProgress.stops);
    if (!route) {
      set({ isLoadingTrain: false, trainError: `Train ${id} has no usable route data.`, route: null, baseTrain: null });
      return;
    }

    // Start playback where the train actually is, so the scenario projects
    // forward from reality rather than replaying the whole journey.
    const distanceTraveledKm = route.baselineDistanceKm;
    const controls: ScenarioInput = {
      targetSpeedKmh: get().targetSpeedKmh,
      congestionLevel: get().congestionLevel,
      stationDwellTime: get().stationDwellTime,
      weatherCondition: get().weatherCondition,
      delayInjectionMinutes: get().delayInjectionMinutes,
      distanceTraveledKm,
      route,
    };

    set({
      trainId: id,
      route,
      baseTrain: train,
      trainLabel: route.trainLabel,
      routeLabel: `${train.originName} → ${train.destinationName}`,
      distanceTraveledKm,
      elapsedSeconds: 0,
      isLoadingTrain: false,
      trainError: null,
      isRunning: false,
      ...computeDerived(controls, 0),
    });
  },

  setTargetSpeed: (kmh) =>
    set((state) => ({
      targetSpeedKmh: kmh,
      ...computeDerived(toScenarioInput(state, { targetSpeedKmh: kmh }), state.elapsedSeconds),
    })),

  setCongestionLevel: (level) =>
    set((state) => ({
      congestionLevel: level,
      ...computeDerived(toScenarioInput(state, { congestionLevel: level }), state.elapsedSeconds),
    })),

  setStationDwellTime: (dwell) =>
    set((state) => ({
      stationDwellTime: dwell,
      ...computeDerived(toScenarioInput(state, { stationDwellTime: dwell }), state.elapsedSeconds),
    })),

  setWeatherCondition: (weather) =>
    set((state) => ({
      weatherCondition: weather,
      ...computeDerived(toScenarioInput(state, { weatherCondition: weather }), state.elapsedSeconds),
    })),

  setDelayInjection: (minutes) =>
    set((state) => ({
      delayInjectionMinutes: minutes,
      ...computeDerived(toScenarioInput(state, { delayInjectionMinutes: minutes }), state.elapsedSeconds),
    })),

  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  play: () => {
    if (intervalHandle) return;
    if (!get().route) return; // nothing to play against yet

    set({ isRunning: true });
    intervalHandle = setInterval(() => {
      const state = get();
      const effectiveSpeedKmh = computeEffectiveSpeedKmh(state);
      const simMinutesElapsed = BASE_SIM_MINUTES_PER_TICK * state.playbackSpeed;
      const corridorTotalKm = getCorridorTotalKm(state.route);
      const nextDistanceKm = advancePlaybackKm(
        state.distanceTraveledKm,
        effectiveSpeedKmh,
        simMinutesElapsed,
        corridorTotalKm,
      );
      const nextElapsedSeconds = state.elapsedSeconds + REAL_TICK_INTERVAL_MS / 1000;
      const reachedDestination = corridorTotalKm > 0 && nextDistanceKm >= corridorTotalKm;

      set({
        distanceTraveledKm: nextDistanceKm,
        elapsedSeconds: nextElapsedSeconds,
        isRunning: !reachedDestination,
        ...computeDerived(toScenarioInput(state, { distanceTraveledKm: nextDistanceKm }), nextElapsedSeconds),
      });

      if (reachedDestination) stopInterval();
    }, REAL_TICK_INTERVAL_MS);
  },

  pause: () => {
    stopInterval();
    set({ isRunning: false });
  },

  /** Returns the scenario to its starting point, keeping the loaded train. */
  reset: () => {
    stopInterval();
    const state = get();
    const initial = buildInitialState();
    const distanceTraveledKm = state.route?.baselineDistanceKm ?? 0;
    const controls = toScenarioInput(
      { ...state, ...initial, route: state.route } as SimulationLabStoreState,
      { distanceTraveledKm },
    );

    set({
      ...initial,
      trainId: state.trainId,
      route: state.route,
      baseTrain: state.baseTrain,
      trainLabel: state.trainLabel,
      routeLabel: state.routeLabel,
      distanceTraveledKm,
      isRunning: false,
      ...computeDerived(controls, 0),
    });
  },
}));
