import { PRIMARY_DEMO_TRAIN_ID, getRouteProgressForTrain, getStationByCode, getTrainById } from "@/data";
import { addMinutesToTime, clamp } from "@/lib/timeMath";
import { delayMinutesToStatus } from "@/lib/status";
import { SCHEDULED_SPEED_KMH } from "@/simulation/trainSimulationEngine";
import type { CongestionLevel, DelayStatus, DwellTime, GeoPoint, StationForecastPoint, Train, WeatherCondition } from "@/types";

/**
 * Deterministic what-if scenario engine for Simulation Lab. No randomness
 * anywhere: every output is a pure function of the scenario controls plus
 * where the simulated train currently sits along the corridor. Isolated
 * from the UI entirely so a future backend (`POST /api/simulate`) could
 * replace `runScenario` without any page needing to change — it already
 * only ever calls this one function.
 *
 * Physics mirror trainSimulationEngine's live feed for consistency: delay
 * accrues when effective speed falls short of the route's scheduled pace
 * (SCHEDULED_SPEED_KMH), and recovers when it exceeds it.
 */

/** Top achievable speed under a congestion tier — a target speed above this is simply not deliverable, same as a real speed-restricted section. */
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

/** Extra dwell minutes added at every downstream station when dwell time is "increased". */
const DWELL_EXTRA_MINUTES_PER_STATION: Record<DwellTime, number> = {
  normal: 0,
  increased: 4,
};

export interface ScenarioInput {
  targetSpeedKmh: number;
  congestionLevel: CongestionLevel;
  stationDwellTime: DwellTime;
  weatherCondition: WeatherCondition;
  delayInjectionMinutes: number;
  /** Current playback position along the corridor, km (same scale as routeProgress's distanceFromOriginKm). */
  distanceTraveledKm: number;
}

export interface ScenarioOutput {
  effectiveSpeedKmh: number;
  currentStationCode: string;
  nextStationCode: string;
  simulatedEta: string;
  etaImpactMinutes: number;
  delayStatus: DelayStatus;
  bottleneckRiskLevel: number; // 1-5
  stationForecast: StationForecastPoint[];
  corridorTotalKm: number;
  /** Echoes the input for convenience — lets buildScenarioTrainMarker compute distance remaining without re-deriving it. */
  distanceTraveledKm: number;
  /** Interpolated real-world position for the scenario's train marker. */
  position: GeoPoint;
}

/** Congestion/weather act as speed *caps*, not discounts — dialing the target speed up does nothing once a cap is binding, same as a real speed restriction. */
export function computeEffectiveSpeedKmh(
  input: Pick<ScenarioInput, "targetSpeedKmh" | "congestionLevel" | "weatherCondition">,
): number {
  return Math.min(
    input.targetSpeedKmh,
    CONGESTION_SPEED_CAP_KMH[input.congestionLevel],
    WEATHER_SPEED_CAP_KMH[input.weatherCondition],
  );
}

export function runScenario(input: ScenarioInput): ScenarioOutput {
  const baseTrain = getTrainById(PRIMARY_DEMO_TRAIN_ID);
  const routeProgress = getRouteProgressForTrain(PRIMARY_DEMO_TRAIN_ID);
  if (!baseTrain || !routeProgress) {
    throw new Error("Primary demo train mock data is missing — cannot run the scenario.");
  }
  const stops = routeProgress.stops;
  const corridorTotalKm = stops[stops.length - 1].distanceFromOriginKm;
  const effectiveSpeedKmh = computeEffectiveSpeedKmh(input);
  const dwellExtraMinutes = DWELL_EXTRA_MINUTES_PER_STATION[input.stationDwellTime];

  let currentIndex = 0;
  for (let i = 0; i < stops.length; i++) {
    if (stops[i].distanceFromOriginKm <= input.distanceTraveledKm) {
      currentIndex = i;
    } else {
      break;
    }
  }
  const nextIndex = Math.min(currentIndex + 1, stops.length - 1);
  const currentStop = stops[currentIndex];
  const nextStop = stops[nextIndex];
  const currentStation = getStationByCode(currentStop.stationCode);
  const nextStation = getStationByCode(nextStop.stationCode);
  const legLengthKm = nextStop.distanceFromOriginKm - currentStop.distanceFromOriginKm;
  const legProgress =
    legLengthKm > 0 ? clamp((input.distanceTraveledKm - currentStop.distanceFromOriginKm) / legLengthKm, 0, 1) : 0;
  const position: GeoPoint =
    currentStation && nextStation
      ? {
          lat: currentStation.position.lat + (nextStation.position.lat - currentStation.position.lat) * legProgress,
          lng: currentStation.position.lng + (nextStation.position.lng - currentStation.position.lng) * legProgress,
        }
      : baseTrain.position;

  // Walk downstream from the current position to the destination,
  // accumulating delay leg by leg — this produces the station-by-station
  // "downstream effects" timeline the UI shows.
  let cumulativeDelay = input.delayInjectionMinutes;
  const stationForecast: StationForecastPoint[] = [];
  for (let i = currentIndex; i < stops.length - 1; i++) {
    const legKm = stops[i + 1].distanceFromOriginKm - stops[i].distanceFromOriginKm;
    const scheduledMinutesAtEffectiveSpeed = (legKm / effectiveSpeedKmh) * 60;
    const scheduledMinutesAtBaseline = (legKm / SCHEDULED_SPEED_KMH) * 60;
    cumulativeDelay += scheduledMinutesAtEffectiveSpeed - scheduledMinutesAtBaseline + dwellExtraMinutes;
    stationForecast.push({
      stationCode: stops[i + 1].stationCode,
      etaImpactMinutes: Math.round(cumulativeDelay),
    });
  }

  const finalDelayMinutes = Math.round(cumulativeDelay);
  const simulatedEta = addMinutesToTime(baseTrain.scheduledEta, finalDelayMinutes);

  // Bottleneck risk: how far short of the scheduled pace the train is
  // running, plus how much of that shortfall is externally imposed
  // (congestion/weather/dwell) rather than a deliberate slow target speed.
  const speedDeficitRatio = clamp(1 - effectiveSpeedKmh / SCHEDULED_SPEED_KMH, 0, 1);
  const congestionScore = { low: 0, medium: 1, high: 2 }[input.congestionLevel];
  const weatherScore = { Clear: 0, Rain: 1, Fog: 2 }[input.weatherCondition];
  const dwellScore = input.stationDwellTime === "increased" ? 1 : 0;
  const riskRaw = speedDeficitRatio * 4 + congestionScore * 0.8 + weatherScore * 0.6 + dwellScore * 0.4;
  const bottleneckRiskLevel = clamp(Math.round(riskRaw / 1.6) + 1, 1, 5);

  return {
    effectiveSpeedKmh: Math.round(effectiveSpeedKmh),
    currentStationCode: stops[currentIndex].stationCode,
    nextStationCode: stops[nextIndex].stationCode,
    simulatedEta,
    etaImpactMinutes: finalDelayMinutes,
    delayStatus: delayMinutesToStatus(finalDelayMinutes),
    bottleneckRiskLevel,
    stationForecast,
    corridorTotalKm,
    distanceTraveledKm: input.distanceTraveledKm,
    position,
  };
}

/** Advances playback position by however much ground the effective speed covers in `simMinutesElapsed`, clamped at the corridor's end. */
export function advancePlaybackKm(
  distanceTraveledKm: number,
  effectiveSpeedKmh: number,
  simMinutesElapsed: number,
  corridorTotalKm: number,
): number {
  const deltaKm = effectiveSpeedKmh * (simMinutesElapsed / 60);
  return clamp(distanceTraveledKm + deltaKm, 0, corridorTotalKm);
}

/** Total corridor length, km (same scale as routeProgress's distanceFromOriginKm) — the point at which playback should stop. */
export function getCorridorTotalKm(): number {
  const routeProgress = getRouteProgressForTrain(PRIMARY_DEMO_TRAIN_ID);
  if (!routeProgress) return 0;
  const stops = routeProgress.stops;
  return stops[stops.length - 1].distanceFromOriginKm;
}

/**
 * Builds a full Train-shaped object representing the scenario's current
 * state, purely so it can be dropped straight into `<TrainMarker>` —
 * which only knows how to render a `Train`, not a bespoke scenario shape.
 * Static fields (name, category, origin/destination) come from the base
 * mock train; everything positional/temporal comes from the scenario.
 */
export function buildScenarioTrainMarker(output: ScenarioOutput): Train | null {
  const baseTrain = getTrainById(PRIMARY_DEMO_TRAIN_ID);
  if (!baseTrain) return null;
  const currentStation = getStationByCode(output.currentStationCode);
  const nextStation = getStationByCode(output.nextStationCode);
  return {
    ...baseTrain,
    currentStationCode: output.currentStationCode,
    currentStationName: currentStation?.name ?? baseTrain.currentStationName,
    nextStationCode: output.nextStationCode,
    nextStationName: nextStation?.name ?? baseTrain.nextStationName,
    currentSpeedKmh: output.effectiveSpeedKmh,
    distanceRemainingKm: Math.max(0, Math.round(output.corridorTotalKm - output.distanceTraveledKm)),
    position: output.position,
    predictedEta: output.simulatedEta,
    delayMinutes: output.etaImpactMinutes,
    delayStatus: output.delayStatus,
  };
}
