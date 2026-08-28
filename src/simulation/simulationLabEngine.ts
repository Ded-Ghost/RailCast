import { addMinutesToTime, clamp } from "@/lib/timeMath";
import { computeBearingDegrees } from "@/lib/geo";
import { delayMinutesToStatus } from "@/lib/status";
import {
  dwellMinutesFor,
  interpolate,
  legMinutesBetween,
  positionOf,
} from "@/simulation/trainSimulationEngine";
import type {
  CongestionLevel,
  DelayStatus,
  DwellTime,
  GeoPoint,
  RouteStopProgress,
  StationForecastPoint,
  Train,
  WeatherCondition,
} from "@/types";

/**
 * Deterministic what-if engine for Simulation Lab.
 *
 * No randomness: every output is a pure function of the scenario controls and
 * the train's real route. Nothing is looked up in a table here — the caller
 * passes in the route it fetched from the backend, which is what lets the lab
 * run against any train number the user types rather than one pre-baked
 * corridor.
 *
 * The baseline it measures against is the train's *own published timetable*,
 * not a nominal line speed: "ETA impact" answers "how much later than booked
 * would this train arrive under these conditions", and the booked time for a
 * leg through the ghats is legitimately slower than one across the plains.
 * The scenario is additionally compared against the train's real current
 * delay, so the user can see whether their scenario is better or worse than
 * what is actually happening right now.
 */

/** Top achievable speed under a congestion tier — a target above this is simply not deliverable. */
const CONGESTION_SPEED_CAP_KMH: Record<CongestionLevel, number> = {
  low: 130,
  medium: 90,
  high: 55,
};

/** Top achievable speed under a weather condition. */
const WEATHER_SPEED_CAP_KMH: Record<WeatherCondition, number> = {
  Clear: 130,
  Rain: 95,
  Fog: 65,
};

/** Extra dwell minutes added at every downstream station when dwell is "increased". */
const DWELL_EXTRA_MINUTES_PER_STATION: Record<DwellTime, number> = {
  normal: 0,
  increased: 4,
};

/**
 * The most of a leg's booked running time a scenario may recover, as a
 * fraction of that time.
 *
 * Without this bound the model treats the target-speed slider as if a train
 * could hold that speed continuously between stops, and reports absurdities —
 * a long-distance express nominally arriving twenty hours early because 110
 * km/h beats its booked average. Booked running times are not a soft target:
 * they already reflect line speed, gradients, curvature and permanent speed
 * restrictions, and the only genuine slack in them is the recovery margin
 * timetable planners build in, which is a few percent rather than a multiple.
 *
 * So going faster can claw back the margin and no more, while congestion,
 * weather and a low target speed slow the train down without limit. That
 * asymmetry is the real one.
 */
const MAX_RECOVERY_FRACTION = 0.15;

/** The real train and route a scenario is run against. */
export interface ScenarioRoute {
  trainId: string;
  trainLabel: string;
  category: string;
  /** Booked arrival at the destination, "HH:MM". */
  scheduledEta: string;
  /** The train's actual delay right now, from the live feed — the comparison baseline. */
  baselineDelayMinutes: number;
  /** Where the train actually is, as a distance from origin in km. */
  baselineDistanceKm: number;
  stops: RouteStopProgress[];
  /** Fallback position for the marker before playback moves. */
  fallbackPosition: GeoPoint;
}

export interface ScenarioInput {
  targetSpeedKmh: number;
  congestionLevel: CongestionLevel;
  stationDwellTime: DwellTime;
  weatherCondition: WeatherCondition;
  delayInjectionMinutes: number;
  /** Playback position along the route, km from origin. */
  distanceTraveledKm: number;
  /** Null until a train has been loaded. */
  route: ScenarioRoute | null;
}

export interface ScenarioOutput {
  effectiveSpeedKmh: number;
  currentStationCode: string;
  nextStationCode: string;
  simulatedEta: string;
  /** Total lateness against the booked arrival, minutes. */
  etaImpactMinutes: number;
  /** Difference between this scenario and the train's real current delay. Negative = better than reality. */
  deltaVsLiveMinutes: number;
  /** The train's real delay right now, echoed for display. */
  baselineDelayMinutes: number;
  /** Where the train is really predicted to arrive, from the live feed. */
  baselineEta: string;
  delayStatus: DelayStatus;
  bottleneckRiskLevel: number; // 1-5
  stationForecast: StationForecastPoint[];
  corridorTotalKm: number;
  distanceTraveledKm: number;
  position: GeoPoint | null;
  /** Compass bearing (0-360) of the current leg — points the map marker the direction the train is actually heading. Null when there's no leg to point along (e.g. at the final stop). */
  headingDegrees: number | null;
  /** True when no train has been loaded yet — the UI shows an empty state. */
  isEmpty: boolean;
}

/** The output shape used before any train is loaded. */
export const EMPTY_SCENARIO_OUTPUT: ScenarioOutput = {
  effectiveSpeedKmh: 0,
  currentStationCode: "—",
  nextStationCode: "—",
  simulatedEta: "—",
  etaImpactMinutes: 0,
  deltaVsLiveMinutes: 0,
  baselineDelayMinutes: 0,
  baselineEta: "—",
  delayStatus: "on-time",
  bottleneckRiskLevel: 1,
  stationForecast: [],
  corridorTotalKm: 0,
  distanceTraveledKm: 0,
  position: null,
  headingDegrees: null,
  isEmpty: true,
};

/** Congestion and weather act as speed *caps*, not discounts — raising the target does nothing once a cap binds. */
export function computeEffectiveSpeedKmh(
  input: Pick<ScenarioInput, "targetSpeedKmh" | "congestionLevel" | "weatherCondition">,
): number {
  return Math.min(
    input.targetSpeedKmh,
    CONGESTION_SPEED_CAP_KMH[input.congestionLevel],
    WEATHER_SPEED_CAP_KMH[input.weatherCondition],
  );
}

/** Builds the scenario route from a real train and its real route stops. */
export function buildScenarioRoute(train: Train, stops: RouteStopProgress[]): ScenarioRoute | null {
  if (!train || stops.length < 2) return null;
  return {
    trainId: train.id,
    trainLabel: `${train.id} · ${train.name}`,
    category: train.category,
    scheduledEta: train.scheduledEta,
    baselineDelayMinutes: train.delayMinutes ?? 0,
    baselineDistanceKm: train.distanceCoveredKm ?? 0,
    stops,
    fallbackPosition: train.position,
  };
}

export function runScenario(input: ScenarioInput): ScenarioOutput {
  const route = input.route;
  if (!route || route.stops.length < 2) return EMPTY_SCENARIO_OUTPUT;

  const stops = route.stops;
  const corridorTotalKm = stops[stops.length - 1].distanceFromOriginKm;
  const effectiveSpeedKmh = computeEffectiveSpeedKmh(input);
  const dwellExtraMinutes = DWELL_EXTRA_MINUTES_PER_STATION[input.stationDwellTime];

  // Locate the playback position along the route.
  let currentIndex = 0;
  for (let i = 0; i < stops.length; i++) {
    if (stops[i].distanceFromOriginKm <= input.distanceTraveledKm) currentIndex = i;
    else break;
  }
  const nextIndex = Math.min(currentIndex + 1, stops.length - 1);
  const currentStop = stops[currentIndex];
  const nextStop = stops[nextIndex];

  const legLengthKm = nextStop.distanceFromOriginKm - currentStop.distanceFromOriginKm;
  const legProgress =
    legLengthKm > 0
      ? clamp((input.distanceTraveledKm - currentStop.distanceFromOriginKm) / legLengthKm, 0, 1)
      : 0;

  const currentPos = positionOf(currentStop);
  const nextPos = positionOf(nextStop);
  const position = interpolate(currentPos, nextPos, legProgress) ?? route.fallbackPosition;
  const headingDegrees =
    currentPos && nextPos && currentIndex !== nextIndex ? computeBearingDegrees(currentPos, nextPos) : null;

  // Walk downstream to the destination, accumulating the difference between
  // what the scenario delivers and what the timetable books for each leg.
  let cumulativeDelay = route.baselineDelayMinutes + input.delayInjectionMinutes;
  const stationForecast: StationForecastPoint[] = [];

  for (let i = currentIndex; i < stops.length - 1; i++) {
    const from = stops[i];
    const to = stops[i + 1];
    const legKm = to.distanceFromOriginKm - from.distanceFromOriginKm;

    const bookedMinutes = legMinutesBetween(from, to);
    const rawScenarioMinutes = effectiveSpeedKmh > 0 ? (legKm / effectiveSpeedKmh) * 60 : bookedMinutes;
    // Slower than booked is always possible; faster only up to the recovery margin.
    const scenarioMinutes = Math.max(rawScenarioMinutes, bookedMinutes * (1 - MAX_RECOVERY_FRACTION));

    // Extra dwell only applies at stops that actually have a booked halt —
    // holding longer at a station the train runs straight through is not a
    // thing that can happen.
    const dwellPenalty = dwellMinutesFor(to) > 0 ? dwellExtraMinutes : 0;

    cumulativeDelay += scenarioMinutes - bookedMinutes + dwellPenalty;
    stationForecast.push({
      stationCode: to.stationCode,
      etaImpactMinutes: Math.round(cumulativeDelay),
    });
  }

  const finalDelayMinutes = Math.round(cumulativeDelay);
  const simulatedEta = addMinutesToTime(route.scheduledEta, finalDelayMinutes);
  const baselineEta = addMinutesToTime(route.scheduledEta, route.baselineDelayMinutes);

  // Bottleneck risk: how far short of the route's own booked pace the scenario
  // runs, plus how much of that shortfall is externally imposed rather than a
  // deliberately slow target speed.
  const bookedPaceKmh = computeBookedPaceKmh(stops, currentIndex);
  const speedDeficitRatio = bookedPaceKmh > 0 ? clamp(1 - effectiveSpeedKmh / bookedPaceKmh, 0, 1) : 0;
  const congestionScore = { low: 0, medium: 1, high: 2 }[input.congestionLevel];
  const weatherScore = { Clear: 0, Rain: 1, Fog: 2 }[input.weatherCondition];
  const dwellScore = input.stationDwellTime === "increased" ? 1 : 0;
  const riskRaw = speedDeficitRatio * 4 + congestionScore * 0.8 + weatherScore * 0.6 + dwellScore * 0.4;
  const bottleneckRiskLevel = clamp(Math.round(riskRaw / 1.6) + 1, 1, 5);

  return {
    effectiveSpeedKmh: Math.round(effectiveSpeedKmh),
    currentStationCode: currentStop.stationCode,
    nextStationCode: nextStop.stationCode,
    simulatedEta,
    etaImpactMinutes: finalDelayMinutes,
    deltaVsLiveMinutes: finalDelayMinutes - route.baselineDelayMinutes,
    baselineDelayMinutes: route.baselineDelayMinutes,
    baselineEta,
    delayStatus: delayMinutesToStatus(finalDelayMinutes),
    bottleneckRiskLevel,
    stationForecast,
    corridorTotalKm,
    distanceTraveledKm: input.distanceTraveledKm,
    position,
    headingDegrees,
    isEmpty: false,
  };
}

/** The route's own average booked pace from a point onwards, km/h. */
function computeBookedPaceKmh(stops: RouteStopProgress[], fromIndex: number): number {
  let km = 0;
  let minutes = 0;
  for (let i = fromIndex; i < stops.length - 1; i++) {
    km += stops[i + 1].distanceFromOriginKm - stops[i].distanceFromOriginKm;
    minutes += legMinutesBetween(stops[i], stops[i + 1]);
  }
  return minutes > 0 ? (km / minutes) * 60 : 0;
}

/** Advances playback by however much ground the effective speed covers, clamped at the route's end. */
export function advancePlaybackKm(
  distanceTraveledKm: number,
  effectiveSpeedKmh: number,
  simMinutesElapsed: number,
  corridorTotalKm: number,
): number {
  const deltaKm = effectiveSpeedKmh * (simMinutesElapsed / 60);
  return clamp(distanceTraveledKm + deltaKm, 0, corridorTotalKm);
}

/** Total route length, km — the point at which playback stops. */
export function getCorridorTotalKm(route: ScenarioRoute | null): number {
  if (!route || route.stops.length === 0) return 0;
  return route.stops[route.stops.length - 1].distanceFromOriginKm;
}

/**
 * Wraps the scenario in a Train-shaped object purely so it can be handed to
 * `<TrainMarker>`, which only knows how to render a Train. Identity comes from
 * the real train; everything positional or temporal comes from the scenario.
 */
export function buildScenarioTrainMarker(
  output: ScenarioOutput,
  baseTrain: Train | null,
  route: ScenarioRoute | null,
): Train | null {
  if (!baseTrain || output.isEmpty) return null;

  const nameFor = (code: string) =>
    route?.stops.find((stop) => stop.stationCode === code)?.stationName ?? code;

  return {
    ...baseTrain,
    currentStationCode: output.currentStationCode,
    currentStationName: nameFor(output.currentStationCode),
    nextStationCode: output.nextStationCode,
    nextStationName: nameFor(output.nextStationCode),
    currentSpeedKmh: output.effectiveSpeedKmh,
    distanceRemainingKm: Math.max(0, Math.round(output.corridorTotalKm - output.distanceTraveledKm)),
    distanceCoveredKm: Math.round(output.distanceTraveledKm),
    position: output.position ?? baseTrain.position,
    predictedEta: output.simulatedEta,
    delayMinutes: output.etaImpactMinutes,
    delayStatus: output.delayStatus,
    dataSource: "simulation",
  };
}
