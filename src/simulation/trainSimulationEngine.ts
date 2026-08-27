import type { EtaHistoryPoint } from "@/data/etaHistory";
import {
  PRIMARY_DEMO_TRAIN_ID,
  getPredictionForTrain,
  getRouteProgressForTrain,
  getStationByCode,
  getTrainById,
} from "@/data";
import { delayMinutesToStatus } from "@/lib/status";
import { clamp, formatMinutesToTime, parseTimeToMinutes } from "@/lib/timeMath";
import { etaService } from "@/services/etaService";
import type { Prediction, RouteStopProgress, Train, TrainRouteProgress } from "@/types";

/**
 * Deterministic, client-side simulation of the live feed for the primary
 * demo train (12345). No randomness anywhere — every quantity is a pure
 * function of how many ticks have elapsed, so the feed is reproducible and
 * always tells the same believable operational story:
 *
 *   cruise -> enters a reduced-speed section (matches the existing
 *   "Potential Delay Detected... Cuttack and Jajpur" mock alert) -> a
 *   signal/congestion hold -> a faster recovery run that claws the time
 *   back -> cruise again -> repeat.
 *
 * One tick = TICK_SIM_MINUTES of *simulated* schedule time, fired every
 * TICK_INTERVAL_MS of *real* time — a controlled interval, not a per-frame
 * loop. Everything below is a pure function: `stepEngine` advances the
 * small internal state by one tick, `deriveLiveData` maps that state onto
 * the same Train/Prediction/TrainRouteProgress/EtaHistoryPoint shapes the
 * rest of the app already renders, so no UI component needs to know a
 * simulation exists.
 */

// --- Tunable constants -----------------------------------------------------

/** Real-world milliseconds between ticks — the "controlled interval". */
export const TICK_INTERVAL_MS = 5000;

/** Simulated schedule-minutes each tick represents. */
const TICK_SIM_MINUTES = 5;

/** The route's nominal/scheduled running speed — the baseline delay is measured against. Exported for reuse by simulationLabEngine's what-if scenarios, which model the same corridor. */
export const SCHEDULED_SPEED_KMH = 78;

const HOURS_PER_TICK = TICK_SIM_MINUTES / 60;
const SCHEDULED_DISTANCE_PER_TICK_KM = SCHEDULED_SPEED_KMH * HOURS_PER_TICK;

/**
 * BBS→CTC distance (km) and the CTC→NDLS loop length (km) — matches the
 * distanceFromOriginKm values in data/routeProgress.ts for train 12345.
 * The simulated position loops the CTC→NDLS leg indefinitely so the demo
 * feed never goes stale; see `deriveLiveData` for how that loop is applied.
 */
const STARTING_DISTANCE_KM = 28;
const TRIP_LENGTH_KM = 318;

/**
 * Deterministic speed profile: a repeating sequence of {ticks, speedKmh}
 * segments. Chosen so the delay added while slow exactly cancels the delay
 * removed while recovering (verify: 4*2.5 + 2*5 == 10*2), so the feed
 * oscillates indefinitely instead of drifting to a ceiling.
 */
const SPEED_PROFILE: { ticks: number; speedKmh: number }[] = [
  { ticks: 4, speedKmh: 78 }, // steady cruise
  { ticks: 4, speedKmh: 52 }, // reduced-speed section enforcement (Cuttack–Jajpur)
  { ticks: 2, speedKmh: 39 }, // congestion / signal hold
  { ticks: 10, speedKmh: 130 }, // recovery run, faster than scheduled to claw back time
  { ticks: 4, speedKmh: 78 }, // back to steady cruise
];

const FLAT_SPEED_PROFILE: number[] = SPEED_PROFILE.flatMap((segment) =>
  Array<number>(segment.ticks).fill(segment.speedKmh),
);

function getSpeedForTick(tickIndex: number): number {
  return FLAT_SPEED_PROFILE[tickIndex % FLAT_SPEED_PROFILE.length];
}

// --- Time-of-day helpers now live in lib/timeMath.ts (shared with simulationLabEngine) ---

// --- Engine state ------------------------------------------------------------

export interface EngineState {
  tickIndex: number;
  /** Unrounded cumulative delay (minutes) — rounded only when displayed. */
  delayMinutes: number;
  /** Unbounded cumulative distance actually covered since the engine started. */
  cumulativeDistanceCoveredKm: number;
  /** Simulated wall-clock, minutes-of-day — stamps ETA Evolution history points. */
  clockMinutes: number;
}

export function createInitialEngineState(): EngineState {
  return {
    tickIndex: 0,
    // Matches the original static mock exactly, so the very first render
    // (before any tick fires) looks identical to the pre-simulation UI.
    delayMinutes: 11,
    cumulativeDistanceCoveredKm: 0,
    clockMinutes: parseTimeToMinutes("17:05"),
  };
}

/** Advances the simulation by exactly one tick. Pure — same input always produces the same output. */
export function stepEngine(previous: EngineState): EngineState {
  const tickIndex = previous.tickIndex + 1;
  const speedKmh = getSpeedForTick(tickIndex);
  const actualDistanceKm = speedKmh * HOURS_PER_TICK;

  // How long would it take, at the *current* speed, to cover the distance
  // the schedule expects to be covered in one tick? That difference from
  // TICK_SIM_MINUTES is exactly how much delay this tick adds or removes.
  const scheduledMinutesAtCurrentSpeed = (SCHEDULED_DISTANCE_PER_TICK_KM / speedKmh) * 60;
  const delayDeltaMinutes = scheduledMinutesAtCurrentSpeed - TICK_SIM_MINUTES;

  return {
    tickIndex,
    delayMinutes: clamp(previous.delayMinutes + delayDeltaMinutes, 0, 45),
    cumulativeDistanceCoveredKm: previous.cumulativeDistanceCoveredKm + actualDistanceKm,
    clockMinutes: (previous.clockMinutes + TICK_SIM_MINUTES) % 1440,
  };
}

// --- Deriving public (Train/Prediction/RouteProgress/History) data --------

export interface LiveDerivedData {
  train: Train;
  prediction: Prediction;
  routeProgress: TrainRouteProgress;
  etaHistory: EtaHistoryPoint[];
}

/** Maps engine state onto the exact shapes the rest of the app already renders. */
export function deriveLiveData(state: EngineState, previousEtaHistory: EtaHistoryPoint[]): LiveDerivedData {
  const baseTrain = getTrainById(PRIMARY_DEMO_TRAIN_ID);
  const baseRouteProgress = getRouteProgressForTrain(PRIMARY_DEMO_TRAIN_ID);
  const basePrediction = getPredictionForTrain(PRIMARY_DEMO_TRAIN_ID);

  if (!baseTrain || !baseRouteProgress || !basePrediction) {
    throw new Error("Primary demo train mock data is missing — cannot run the simulation.");
  }

  const stops = baseRouteProgress.stops;
  const destinationKm = stops[stops.length - 1].distanceFromOriginKm;
  const distanceTraveledFromOriginKm =
    STARTING_DISTANCE_KM + (state.cumulativeDistanceCoveredKm % TRIP_LENGTH_KM);
  const speedKmh = getSpeedForTick(state.tickIndex);
  const roundedDelay = Math.round(state.delayMinutes);

  let currentStopIndex = 0;
  for (let i = 0; i < stops.length; i++) {
    if (stops[i].distanceFromOriginKm <= distanceTraveledFromOriginKm) {
      currentStopIndex = i;
    } else {
      break;
    }
  }
  const currentStop = stops[currentStopIndex];
  const nextStop = stops[Math.min(currentStopIndex + 1, stops.length - 1)];
  const currentStation = getStationByCode(currentStop.stationCode);
  const nextStation = getStationByCode(nextStop.stationCode);

  const legLengthKm = nextStop.distanceFromOriginKm - currentStop.distanceFromOriginKm;
  const legProgress =
    legLengthKm > 0
      ? clamp((distanceTraveledFromOriginKm - currentStop.distanceFromOriginKm) / legLengthKm, 0, 1)
      : 0;
  const position =
    currentStation && nextStation
      ? {
          lat: currentStation.position.lat + (nextStation.position.lat - currentStation.position.lat) * legProgress,
          lng: currentStation.position.lng + (nextStation.position.lng - currentStation.position.lng) * legProgress,
        }
      : baseTrain.position;

  // The real baseline calculation lives in etaService — this engine only
  // supplies the current state (delay so far, current position) and route
  // data; it doesn't compute confidence/range/station-propagation itself.
  const etaResult = etaService.calculateETA(
    { scheduledEta: baseTrain.scheduledEta, currentDelayMinutes: roundedDelay },
    {
      stops: stops.map((stop) => ({
        stationCode: stop.stationCode,
        distanceFromOriginKm: stop.distanceFromOriginKm,
        scheduledTime: stop.scheduledTime,
      })),
      currentStopIndex,
    },
  );
  const predictedEta = etaResult.predictedArrivalTime;
  const confidence = etaResult.confidence;
  const predictedEtaRangeStart = etaResult.rangeStartTime;
  const predictedEtaRangeEnd = etaResult.rangeEndTime;

  const train: Train = {
    ...baseTrain,
    currentStationCode: currentStop.stationCode,
    currentStationName: currentStation?.name ?? baseTrain.currentStationName,
    nextStationCode: nextStop.stationCode,
    nextStationName: nextStation?.name ?? baseTrain.nextStationName,
    currentSpeedKmh: speedKmh,
    distanceRemainingKm: Math.max(0, Math.round(destinationKm - distanceTraveledFromOriginKm)),
    position,
    predictedEta,
    delayMinutes: roundedDelay,
    delayStatus: delayMinutesToStatus(roundedDelay),
    predictionConfidence: confidence,
    predictedEtaRangeStart,
    predictedEtaRangeEnd,
    updatedAt: new Date().toISOString(),
  };

  // Keep the original three factor labels, but recompute their share of the
  // *current* delay using the same ratio as the original static mock
  // (6:3:2, which summed to the original 11-minute delay).
  const [labelA, labelB, labelC] = basePrediction.factors.map((factor) => factor.label);
  const impactA = Math.round((roundedDelay * 6) / 11);
  const impactB = Math.round((roundedDelay * 3) / 11);
  const impactC = Math.max(0, roundedDelay - impactA - impactB);

  const prediction: Prediction = {
    trainId: PRIMARY_DEMO_TRAIN_ID,
    predictedEta,
    confidence,
    rangeStart: predictedEtaRangeStart,
    rangeEnd: predictedEtaRangeEnd,
    modelVersion: basePrediction.modelVersion,
    factors: [
      { label: labelA, impactMinutes: impactA },
      { label: labelB, impactMinutes: impactB },
      { label: labelC, impactMinutes: impactC },
    ],
  };

  const routeProgress: TrainRouteProgress = {
    trainId: PRIMARY_DEMO_TRAIN_ID,
    stops: stops.map((stop, index): RouteStopProgress => {
      const estimate = etaResult.stationEstimates[index];
      const status: RouteStopProgress["status"] =
        index < currentStopIndex ? "passed" : index === currentStopIndex ? "current" : "upcoming";
      return { ...stop, status, delayMinutes: estimate.delayMinutes, predictedTime: estimate.predictedTime };
    }),
  };

  const historyPoint: EtaHistoryPoint = {
    time: formatMinutesToTime(state.clockMinutes),
    predictedEta,
    delayMinutes: roundedDelay,
  };
  // Rolling window — keeps the ETA Evolution chart readable indefinitely.
  const etaHistory = [...previousEtaHistory, historyPoint].slice(-14);

  return { train, prediction, routeProgress, etaHistory };
}
