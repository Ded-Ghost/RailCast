import { addMinutesToTime, clamp } from "@/lib/timeMath";

/**
 * The baseline (non-ML) ETA calculator: real arithmetic from actual
 * current state and route data, never a hardcoded number. This is
 * deliberately the ONLY place this math lives — trainSimulationEngine.ts
 * calls through here for confidence/range/station-propagation rather than
 * duplicating the formulas inline (which is how it worked before this
 * file existed). See predictionService.ts for where an eventual ML model
 * (`POST /api/predict-eta`) would plug in as a replacement or overlay —
 * that's a genuinely different concern from this: this file answers "what
 * does the current state literally imply", not "what does a trained model
 * think will happen".
 */

export interface TrainState {
  /** "HH:MM" — the original timetabled arrival at the final destination. */
  scheduledEta: string;
  /** Current accumulated delay in minutes; positive = running late, negative = running early. */
  currentDelayMinutes: number;
}

export interface RouteStopInput {
  stationCode: string;
  distanceFromOriginKm: number;
  scheduledTime: string;
}

export interface RouteState {
  /** Ordered ascending by distanceFromOriginKm. */
  stops: RouteStopInput[];
  /** Index into `stops` of the train's current position. */
  currentStopIndex: number;
}

export interface StationEtaEstimate {
  stationCode: string;
  scheduledTime: string;
  predictedTime: string;
  delayMinutes: number;
}

export interface EtaCalculationResult {
  predictedArrivalTime: string;
  predictedDelayMinutes: number;
  confidence: number; // 0-100
  rangeStartTime: string;
  rangeEndTime: string;
  /** Every station from the current position to the destination — the "station-level ETA estimates" the propagation needs. */
  stationEstimates: StationEtaEstimate[];
}

export const etaService = {
  /**
   * Confidence degrades with delay magnitude — a badly-delayed train is
   * harder to predict precisely than one running to schedule. Calibrated
   * so 11 minutes of delay (the original approved demo's seed value)
   * produces 87% confidence, matching that mockup exactly. Deliberately
   * NOT `Math.abs(delayMinutes)`: an early-running train (negative delay)
   * clamps straight to the 98% ceiling here, same as the original
   * hand-written formula this replaces — changing that would be a
   * behavior change nobody asked for, not just a refactor.
   */
  confidenceFromDelay(delayMinutes: number): number {
    return Math.round(clamp(98 - delayMinutes, 55, 98));
  },

  /** Uncertainty widens as confidence drops. */
  rangeFromConfidence(predictedEta: string, confidence: number): { rangeStartTime: string; rangeEndTime: string } {
    const spreadMinutes = Math.round(clamp((100 - confidence) / 3, 2, 8));
    return {
      rangeStartTime: addMinutesToTime(predictedEta, -spreadMinutes),
      rangeEndTime: addMinutesToTime(predictedEta, spreadMinutes),
    };
  },

  /**
   * Full baseline calculation: destination arrival, confidence/range, and
   * a station-by-station propagation of the current delay downstream
   * (stations already passed keep their scheduled time and zero delay;
   * everything from the current position onward shifts by the current
   * delay). Callers with a richer per-section model (see
   * simulation/simulationLabEngine.ts's what-if scenarios) compute their
   * own station estimates instead — this is the baseline for "just
   * project today's delay forward", not a replacement for a model that
   * knows about per-section speed differences.
   */
  calculateETA(trainState: TrainState, routeState: RouteState): EtaCalculationResult {
    const delayMinutes = Math.round(trainState.currentDelayMinutes);
    const predictedArrivalTime = addMinutesToTime(trainState.scheduledEta, delayMinutes);
    const confidence = etaService.confidenceFromDelay(delayMinutes);
    const { rangeStartTime, rangeEndTime } = etaService.rangeFromConfidence(predictedArrivalTime, confidence);

    const stationEstimates: StationEtaEstimate[] = routeState.stops.map((stop, index) => {
      const isPassed = index < routeState.currentStopIndex;
      return {
        stationCode: stop.stationCode,
        scheduledTime: stop.scheduledTime,
        predictedTime: isPassed ? stop.scheduledTime : addMinutesToTime(stop.scheduledTime, delayMinutes),
        delayMinutes: isPassed ? 0 : delayMinutes,
      };
    });

    return {
      predictedArrivalTime,
      predictedDelayMinutes: delayMinutes,
      confidence,
      rangeStartTime,
      rangeEndTime,
      stationEstimates,
    };
  },
};
