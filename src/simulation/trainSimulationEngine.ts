import type { EtaHistoryPoint } from "@/data/etaHistory";
import { getStationByCode } from "@/data/stations";
import { delayMinutesToStatus } from "@/lib/status";
import { clamp, formatMinutesToTime, parseTimeToMinutes } from "@/lib/timeMath";
import { etaService } from "@/services/etaService";
import type { GeoPoint, Prediction, RouteStopProgress, Train, TrainRouteProgress } from "@/types";

/**
 * Client-side motion for a real train.
 *
 * The backend already places the train correctly — it joins the published
 * timetable to the live running-status feed and interpolates a position. But
 * it can only be asked so often: the live feed refreshes every few minutes and
 * polling it every five seconds would be both rude and pointless.
 *
 * So this engine fills the gap. It takes the backend's answer as ground truth
 * and advances the train forward between refreshes, so the map moves smoothly
 * instead of teleporting once every thirty seconds. Every tick is arithmetic
 * on real inputs — the actual delay, the actual booked times between the
 * actual stops, the actual distances — and the whole thing is overwritten by
 * reality on the next resync.
 *
 * It works for any train number, because everything it needs (stop list,
 * coordinates, distances, booked times) arrives with the route rather than
 * being looked up in a table that would have to contain every train in India.
 */

// --- Constants ---------------------------------------------------------------

/** Real milliseconds between simulation ticks. */
export const TICK_INTERVAL_MS = 5000;

/** Real milliseconds between backend resyncs — the point at which reality wins. */
export const RESYNC_INTERVAL_MS = 30000;

/**
 * How much simulated time one tick represents. 1:1 with the wall clock: the
 * train on screen should move at the speed the real train is moving, not a
 * demo-friendly multiple of it.
 */
const TICK_SIM_MINUTES = TICK_INTERVAL_MS / 60000;

/** Fallback pace used for ETA baselines when a route has no usable timings. */
export const SCHEDULED_SPEED_KMH = 90;

/** Ceiling speeds by service class (km/h), used to bound timetable-derived pace. */
const SPEED_CEILING_KMH: Record<string, number> = {
  vandebharat: 160,
  rajdhani: 130,
  shatabdi: 130,
  tejas: 130,
  duronto: 130,
  garibrath: 120,
  humsafar: 110,
  superfast: 110,
  express: 110,
  mail: 100,
  passenger: 70,
  memu: 70,
  demu: 70,
};
const DEFAULT_SPEED_CEILING_KMH = 110;

/** Fraction of a leg spent accelerating away from / braking into a stop. */
const ACCELERATION_FRACTION = 0.12;
const BRAKING_FRACTION = 0.12;
/** Speed leaving or entering a platform, as a fraction of cruise speed. */
const TERMINAL_SPEED_FRACTION = 0.25;

/** Dwell times by station importance, minutes — only used when the timetable has none. */
const DWELL_FALLBACK_MINUTES = {
  junction: 5,
  major: 3,
  regular: 2,
  halt: 1,
} as const;

export function speedCeilingFor(category: string): number {
  const key = category.toLowerCase().replace(/[^a-z]/g, "");
  for (const candidate of Object.keys(SPEED_CEILING_KMH)) {
    if (key.includes(candidate)) return SPEED_CEILING_KMH[candidate];
  }
  return DEFAULT_SPEED_CEILING_KMH;
}

/**
 * Booked dwell at a stop. The timetable value is authoritative when present;
 * the name-based guess only covers routes that omit halts entirely.
 */
export function dwellMinutesFor(stop: RouteStopProgress | undefined): number {
  if (!stop) return DWELL_FALLBACK_MINUTES.regular;
  if (typeof stop.haltMinutes === "number" && stop.haltMinutes > 0) return stop.haltMinutes;

  const name = (stop.stationName ?? "").toLowerCase();
  if (/\b(jn|junction)\b/.test(name)) return DWELL_FALLBACK_MINUTES.junction;
  if (/\b(central|terminus|cantt|city)\b/.test(name)) return DWELL_FALLBACK_MINUTES.major;
  if (/\b(halt|ph)\b/.test(name)) return DWELL_FALLBACK_MINUTES.halt;
  return DWELL_FALLBACK_MINUTES.regular;
}

/** Booked running time between two stops, minutes. Falls back to distance ÷ nominal pace. */
export function legMinutesBetween(from: RouteStopProgress, to: RouteStopProgress): number {
  const departure = parseTimeToMinutes(from.scheduledDeparture ?? from.scheduledTime);
  const arrival = parseTimeToMinutes(to.scheduledArrival ?? to.scheduledTime);

  if (Number.isFinite(departure) && Number.isFinite(arrival)) {
    // Wrap past midnight rather than producing a negative leg.
    const raw = arrival - departure;
    const minutes = raw >= 0 ? raw : raw + 1440;
    if (minutes > 0 && minutes < 1440) return minutes;
  }

  const km = Math.max(0, to.distanceFromOriginKm - from.distanceFromOriginKm);
  return km > 0 ? (km / SCHEDULED_SPEED_KMH) * 60 : 1;
}

/**
 * Instantaneous speed along a leg, shaped as accelerate → cruise → brake.
 * Cruise is derived from the leg's own booked pace, so a slow ghat section
 * stays slow and a fast trunk section stays fast.
 */
function speedAtProgress(
  from: RouteStopProgress,
  to: RouteStopProgress,
  progress: number,
  ceilingKmh: number,
): number {
  const km = to.distanceFromOriginKm - from.distanceFromOriginKm;
  const minutes = legMinutesBetween(from, to);
  if (km <= 0 || minutes <= 0) return 0;

  const averageKmh = (km / minutes) * 60;
  // Cruise must exceed the average by exactly what the end ramps give away,
  // otherwise the train quietly arrives late relative to its own timetable.
  const rampCost = ((ACCELERATION_FRACTION + BRAKING_FRACTION) * (1 - TERMINAL_SPEED_FRACTION)) / 2;
  const cruiseKmh = clamp(averageKmh / Math.max(0.5, 1 - rampCost), 20, ceilingKmh);

  if (progress < ACCELERATION_FRACTION) {
    const t = progress / ACCELERATION_FRACTION;
    return cruiseKmh * (TERMINAL_SPEED_FRACTION + (1 - TERMINAL_SPEED_FRACTION) * t);
  }
  if (progress > 1 - BRAKING_FRACTION) {
    const t = (1 - progress) / BRAKING_FRACTION;
    return cruiseKmh * (TERMINAL_SPEED_FRACTION + (1 - TERMINAL_SPEED_FRACTION) * t);
  }
  return cruiseKmh;
}

/**
 * Coordinates for a stop. The route's own position is preferred — it is
 * published with the route and therefore exists for every stop of every train,
 * including ones absent from the station table.
 */
export function positionOf(stop: RouteStopProgress | undefined): GeoPoint | null {
  if (!stop) return null;
  if (stop.position) return stop.position;
  return getStationByCode(stop.stationCode)?.position ?? null;
}

export function interpolate(from: GeoPoint | null, to: GeoPoint | null, progress: number): GeoPoint | null {
  if (from && to) {
    return {
      lat: from.lat + (to.lat - from.lat) * progress,
      lng: from.lng + (to.lng - from.lng) * progress,
    };
  }
  return from ?? to;
}

// --- Engine state ------------------------------------------------------------

export interface SimulationEngineState {
  trainId: string;
  tickIndex: number;

  /** Current delay in minutes, signed. Carried forward from the last resync. */
  currentDelayMinutes: number;

  /** Distance covered from the origin, km. */
  distanceCoveredKm: number;

  /** Index of the stop the train has most recently left (or is standing at). */
  currentStopIndex: number;

  /** Progress along the leg to the next stop, 0-1. */
  legProgress: number;

  /** Current speed, km/h. */
  currentSpeedKmh: number;

  /** Simulated clock, minutes of day. */
  clockMinutes: number;

  /** Wall-clock ms of the last backend resync. */
  lastSyncTimestamp: number;

  /** The train as the backend last described it — the base every tick builds on. */
  baseTrainData: Train;

  /** The route the train is running, with per-stop coordinates. */
  routeProgress: TrainRouteProgress | null;

  /** True while standing at a platform. */
  isDwelling: boolean;

  /** Remaining booked dwell, minutes. */
  dwellTimeRemaining: number;

  /** True once the train has reached its final stop — ticking stops having an effect. */
  hasArrived: boolean;
}

/**
 * Seed engine state from a real train and its real route.
 *
 * The backend already computed `currentStopIndex` and `legProgress`; using
 * them means the simulation starts exactly where reality left off rather than
 * snapping the train back to its last station.
 */
export function createEngineStateFromTrain(
  train: Train,
  routeProgress?: TrainRouteProgress | null,
): SimulationEngineState {
  const stops = routeProgress?.stops ?? [];

  const indexFromStatus = stops.findIndex((stop) => stop.status === "current");
  const currentStopIndex = clamp(
    train.currentStopIndex ?? (indexFromStatus >= 0 ? indexFromStatus : 0),
    0,
    Math.max(0, stops.length - 1),
  );

  const legProgress = clamp(train.legProgress ?? 0, 0, 1);
  const currentStop = stops[currentStopIndex];
  const nextStop = stops[currentStopIndex + 1];

  const distanceCoveredKm =
    train.distanceCoveredKm ??
    (currentStop && nextStop
      ? currentStop.distanceFromOriginKm +
        (nextStop.distanceFromOriginKm - currentStop.distanceFromOriginKm) * legProgress
      : (currentStop?.distanceFromOriginKm ?? 0));

  const hasArrived = train.journeyPhase === "completed" || (stops.length > 0 && currentStopIndex >= stops.length - 1);
  const notStarted = train.journeyPhase === "not-started";

  const now = new Date();
  return {
    trainId: train.id,
    tickIndex: 0,
    currentDelayMinutes: train.delayMinutes ?? 0,
    distanceCoveredKm,
    currentStopIndex,
    legProgress,
    currentSpeedKmh: train.currentSpeedKmh ?? 0,
    clockMinutes: now.getHours() * 60 + now.getMinutes(),
    lastSyncTimestamp: Date.now(),
    baseTrainData: train,
    routeProgress: routeProgress ?? null,
    // A train sitting at a platform (or not yet away) is dwelling; one already
    // between stops is not, regardless of what its speed happens to read.
    isDwelling: !hasArrived && (notStarted || legProgress <= 0),
    dwellTimeRemaining: legProgress <= 0 ? dwellMinutesFor(currentStop) : 0,
    hasArrived,
  };
}

/** Advance the simulation by one tick. */
export function stepEngine(previous: SimulationEngineState): SimulationEngineState {
  const stops = previous.routeProgress?.stops ?? [];

  // Nothing to advance: no route, or the journey is over.
  if (stops.length < 2 || previous.hasArrived || previous.currentStopIndex >= stops.length - 1) {
    return { ...previous, tickIndex: previous.tickIndex + 1, currentSpeedKmh: 0, hasArrived: true };
  }

  // A train that has not yet departed does not creep forward; it waits.
  if (previous.baseTrainData.journeyPhase === "not-started") {
    return { ...previous, tickIndex: previous.tickIndex + 1, currentSpeedKmh: 0 };
  }

  const currentStop = stops[previous.currentStopIndex];
  const nextStop = stops[previous.currentStopIndex + 1];
  const clockMinutes = (previous.clockMinutes + TICK_SIM_MINUTES) % 1440;

  // Standing at a platform: burn down the booked halt, then pull away.
  if (previous.isDwelling) {
    const remaining = previous.dwellTimeRemaining - TICK_SIM_MINUTES;
    if (remaining > 0) {
      return {
        ...previous,
        tickIndex: previous.tickIndex + 1,
        dwellTimeRemaining: remaining,
        currentSpeedKmh: 0,
        clockMinutes,
      };
    }
    return {
      ...previous,
      tickIndex: previous.tickIndex + 1,
      isDwelling: false,
      dwellTimeRemaining: 0,
      legProgress: 0,
      currentSpeedKmh: 0,
      clockMinutes,
    };
  }

  const ceilingKmh = speedCeilingFor(previous.baseTrainData.category ?? "Express");
  const speedKmh = speedAtProgress(currentStop, nextStop, previous.legProgress, ceilingKmh);
  const legKm = Math.max(0, nextStop.distanceFromOriginKm - currentStop.distanceFromOriginKm);
  const distanceThisTickKm = speedKmh * (TICK_SIM_MINUTES / 60);

  const legProgress = legKm > 0 ? previous.legProgress + distanceThisTickKm / legKm : 1;

  // Reached the next stop — arrive, and start its booked dwell.
  if (legProgress >= 1) {
    const arrivedIndex = previous.currentStopIndex + 1;
    const isFinalStop = arrivedIndex >= stops.length - 1;
    return {
      ...previous,
      tickIndex: previous.tickIndex + 1,
      currentStopIndex: arrivedIndex,
      distanceCoveredKm: nextStop.distanceFromOriginKm,
      legProgress: 0,
      currentSpeedKmh: 0,
      isDwelling: !isFinalStop,
      dwellTimeRemaining: isFinalStop ? 0 : dwellMinutesFor(stops[arrivedIndex]),
      hasArrived: isFinalStop,
      clockMinutes,
    };
  }

  return {
    ...previous,
    tickIndex: previous.tickIndex + 1,
    legProgress,
    distanceCoveredKm: currentStop.distanceFromOriginKm + legKm * legProgress,
    currentSpeedKmh: speedKmh,
    clockMinutes,
  };
}

/** Whether the engine is due a backend resync. */
export function needsResync(state: SimulationEngineState): boolean {
  return Date.now() - state.lastSyncTimestamp >= RESYNC_INTERVAL_MS;
}

// --- Derived view data -------------------------------------------------------

export interface LiveDerivedData {
  train: Train;
  prediction: Prediction;
  routeProgress: TrainRouteProgress;
  etaHistory: EtaHistoryPoint[];
}

/**
 * Project engine state into the shapes the UI renders. Pure: the same state
 * always produces the same view, which is what lets Train Details, the map and
 * the ETA chart all read from one store without disagreeing.
 */
export function deriveLiveData(
  state: SimulationEngineState,
  previousEtaHistory: EtaHistoryPoint[],
): LiveDerivedData {
  const stops = state.routeProgress?.stops ?? [];

  if (stops.length === 0) {
    // No route: pass the backend's train through untouched rather than
    // inventing a position for it.
    return {
      train: state.baseTrainData,
      prediction: {
        trainId: state.trainId,
        predictedEta: state.baseTrainData.predictedEta ?? "—",
        confidence: state.baseTrainData.predictionConfidence ?? 0,
        rangeStart: state.baseTrainData.predictedEtaRangeStart ?? "—",
        rangeEnd: state.baseTrainData.predictedEtaRangeEnd ?? "—",
        modelVersion: "baseline-v2",
        factors: [],
      },
      routeProgress: { trainId: state.trainId, stops: [] },
      etaHistory: previousEtaHistory,
    };
  }

  const lastIndex = stops.length - 1;
  const currentIndex = clamp(state.currentStopIndex, 0, lastIndex);
  const currentStop = stops[currentIndex];
  const nextStop = stops[Math.min(currentIndex + 1, lastIndex)];
  const destinationStop = stops[lastIndex];
  const isAtDestination = currentIndex >= lastIndex;

  const position =
    !isAtDestination && !state.isDwelling && state.legProgress > 0
      ? interpolate(positionOf(currentStop), positionOf(nextStop), state.legProgress)
      : positionOf(currentStop);

  const remainingKm = Math.max(0, destinationStop.distanceFromOriginKm - state.distanceCoveredKm);

  const etaResult = etaService.calculateETA(
    {
      scheduledEta: state.baseTrainData.scheduledEta ?? "—",
      currentDelayMinutes: state.currentDelayMinutes,
    },
    {
      stops: stops.map((stop) => ({
        stationCode: stop.stationCode,
        distanceFromOriginKm: stop.distanceFromOriginKm,
        scheduledTime: stop.scheduledTime,
      })),
      currentStopIndex: currentIndex,
    },
  );

  const delayMinutes = Math.round(state.currentDelayMinutes);

  const train: Train = {
    ...state.baseTrainData,
    currentStationCode: currentStop.stationCode,
    currentStationName: currentStop.stationName ?? getStationByCode(currentStop.stationCode)?.name ?? currentStop.stationCode,
    nextStationCode: isAtDestination ? currentStop.stationCode : nextStop.stationCode,
    nextStationName: isAtDestination
      ? (currentStop.stationName ?? currentStop.stationCode)
      : (nextStop.stationName ?? getStationByCode(nextStop.stationCode)?.name ?? nextStop.stationCode),
    currentSpeedKmh: Math.round(state.currentSpeedKmh),
    distanceRemainingKm: Math.round(remainingKm),
    distanceCoveredKm: Math.round(state.distanceCoveredKm),
    position: position ?? state.baseTrainData.position,
    predictedEta: etaResult.predictedArrivalTime,
    delayMinutes,
    delayStatus: delayMinutesToStatus(delayMinutes),
    predictionConfidence: etaResult.confidence,
    predictedEtaRangeStart: etaResult.rangeStartTime,
    predictedEtaRangeEnd: etaResult.rangeEndTime,
    currentStopIndex: currentIndex,
    legProgress: state.legProgress,
    updatedAt: new Date().toISOString(),
    // Ticks between resyncs are extrapolation, and the badge must say so.
    // Only the resync itself may restore a "live" provenance.
    dataSource: state.tickIndex === 0 ? state.baseTrainData.dataSource : "simulation",
  };

  const prediction: Prediction = {
    trainId: state.trainId,
    predictedEta: etaResult.predictedArrivalTime,
    confidence: etaResult.confidence,
    rangeStart: etaResult.rangeStartTime,
    rangeEnd: etaResult.rangeEndTime,
    modelVersion: "baseline-v2",
    factors: buildDelayFactors(delayMinutes, state, stops, currentIndex),
  };

  const routeProgress: TrainRouteProgress = {
    trainId: state.trainId,
    stops: stops.map((stop, index): RouteStopProgress => {
      const estimate = etaResult.stationEstimates[index];
      const status: RouteStopProgress["status"] =
        index < currentIndex ? "passed" : index === currentIndex ? "current" : "upcoming";

      // Stops already called at keep what actually happened there; only the
      // ones ahead get re-projected from the current delay.
      if (status === "passed") return { ...stop, status };

      return {
        ...stop,
        status,
        delayMinutes: estimate?.delayMinutes ?? stop.delayMinutes,
        predictedTime: estimate?.predictedTime ?? stop.predictedTime,
      };
    }),
  };

  const historyPoint: EtaHistoryPoint = {
    time: formatMinutesToTime(state.clockMinutes),
    predictedEta: etaResult.predictedArrivalTime,
    delayMinutes,
  };

  // One point per minute of simulated time, capped — appending on every tick
  // would push twelve identical points a minute into the chart.
  const lastPoint = previousEtaHistory[previousEtaHistory.length - 1];
  const etaHistory =
    lastPoint && lastPoint.time === historyPoint.time
      ? [...previousEtaHistory.slice(0, -1), historyPoint]
      : [...previousEtaHistory, historyPoint].slice(-20);

  return { train, prediction, routeProgress, etaHistory };
}

/**
 * Attribute the current delay across plausible causes.
 *
 * This is a decomposition of a real measured delay, not a prediction: the
 * split is weighted by how much of the route has been covered and how much
 * dwell time remains ahead, so it shifts as the journey progresses instead of
 * being a fixed ratio.
 */
function buildDelayFactors(
  delayMinutes: number,
  state: SimulationEngineState,
  stops: RouteStopProgress[],
  currentIndex: number,
): Prediction["factors"] {
  if (delayMinutes === 0) return [];

  const remainingStops = Math.max(0, stops.length - 1 - currentIndex);
  const dwellAhead = stops.slice(currentIndex + 1).reduce((total, stop) => total + dwellMinutesFor(stop), 0);
  const totalKm = stops[stops.length - 1]?.distanceFromOriginKm || 1;
  const coveredFraction = clamp(state.distanceCoveredKm / totalKm, 0, 1);

  // Delay accrued so far scales with ground covered; what is still to come is
  // dominated by the dwell and congestion still ahead.
  const accrued = Math.round(delayMinutes * clamp(coveredFraction, 0.2, 0.8));
  const dwellShare = Math.round((delayMinutes - accrued) * (remainingStops > 0 ? Math.min(0.6, dwellAhead / 60) : 0));
  const sectionShare = delayMinutes - accrued - dwellShare;

  return [
    { label: "Accrued en route", impactMinutes: accrued },
    { label: "Section congestion", impactMinutes: sectionShare },
    { label: "Station dwell ahead", impactMinutes: dwellShare },
  ].filter((factor) => factor.impactMinutes !== 0);
}
