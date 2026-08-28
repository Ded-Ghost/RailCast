import type { CongestionStatus, RailwaySection, RouteStopProgress, Train } from "@/types";
import { getOperationalRiskFactors } from "@/data/operationalRiskFactors";
import { legMinutesBetween } from "@/simulation/trainSimulationEngine";

/**
 * routeService.ts — real, per-leg section health, computed from whichever
 * train's route was actually loaded.
 *
 * This used to model exactly one hardcoded corridor (Bhubaneswar → New
 * Delhi) with hand-picked "current speed" and "congestion" figures. That
 * corridor is gone: every train's route now comes from the live backend, and
 * the section health below it is computed from that same train's own real
 * data rather than looked up from a fixed table — sections and congestion
 * differ from train to train because they ARE different: an express and a
 * passenger service cover the same km at different booked paces, and only
 * one of them has actually reported a delay on any given leg.
 *
 * What "current speed" and "congestion" mean here, honestly:
 *
 *   - A leg the train has already run: reconstructed from the REAL delay
 *     figures the live feed reported at each end of it (both come from
 *     trainComposer.js on the backend, which records the feed's per-stop
 *     reading, not a copy of the train's current headline delay). The
 *     difference in delay between the two stops is exactly how much extra
 *     time that specific leg cost, which converts directly to an actual pace.
 *   - The leg the train is on right now: uses its live composed speed
 *     directly — the single most current number available.
 *   - A leg not yet run: there is no observation to report. It only moves
 *     off "healthy" when a known, real structural bottleneck (see
 *     data/operationalRiskFactors.ts) sits at one of its endpoints; the
 *     booked pace stands in as the neutral, unmeasured baseline otherwise.
 */

/** Delay-delta magnitude, minutes, at which a leg crosses into the next congestion tier. */
const CONGESTION_THRESHOLDS: { max: number; tier: CongestionStatus }[] = [
  { max: 2, tier: "healthy" },
  { max: 8, tier: "moderate" },
  { max: 20, tier: "congested" },
  { max: Infinity, tier: "critical" },
];

function tierFromDeltaMinutes(deltaMinutes: number): CongestionStatus {
  const magnitude = Math.abs(deltaMinutes);
  return CONGESTION_THRESHOLDS.find((bucket) => magnitude <= bucket.max)!.tier;
}

/** A known bottleneck's typical impact, halved — the same "typical, not certain" weighting used in predictionEngine.ts. */
function structuralEstimateMinutes(min: number, max: number): number {
  return Math.round(((min + max) / 2) * 0.5);
}

/**
 * Real per-leg section health for a train's actual route. Returns one
 * `RailwaySection` per consecutive stop pair, in route order — the same
 * shape `<RouteOverlay>`'s `sections` prop already expects, keyed the same
 * way (`${startCode}-${endCode}` pairs matched to consecutive stations), so
 * this drops straight into the existing map/chart components.
 */
export function computeRealRouteSections(train: Train | null, stops: RouteStopProgress[]): RailwaySection[] {
  if (!train || stops.length < 2) return [];

  const riskByStation = new Map(getOperationalRiskFactors(stops).map((risk) => [risk.stationCode, risk]));

  const sections: RailwaySection[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i];
    const to = stops[i + 1];

    const distanceKm = Math.max(0, Math.round(to.distanceFromOriginKm - from.distanceFromOriginKm));
    const bookedMinutes = legMinutesBetween(from, to);
    const referenceSpeedKmh = bookedMinutes > 0 ? Math.round((distanceKm / bookedMinutes) * 60) : 0;

    let currentSpeedKmh = referenceSpeedKmh;
    let delayContributionMinutes = 0;
    let congestionStatus: CongestionStatus = "healthy";

    if (to.status === "passed") {
      // Both ends have a real observed delay reading — the difference IS
      // how much this specific leg cost, not an estimate.
      const deltaMinutes = to.delayMinutes - from.delayMinutes;
      const actualMinutes = Math.max(1, bookedMinutes + deltaMinutes);
      currentSpeedKmh = Math.round((distanceKm / actualMinutes) * 60);
      delayContributionMinutes = Math.round(deltaMinutes);
      congestionStatus = tierFromDeltaMinutes(deltaMinutes);
    } else if (from.status === "current") {
      // The leg happening right now — its live speed is the most current
      // number that exists, more honest than a leg-average.
      currentSpeedKmh = train.currentSpeedKmh || referenceSpeedKmh;
      const risk = riskByStation.get(to.stationCode) ?? riskByStation.get(from.stationCode);
      if (risk) {
        delayContributionMinutes = structuralEstimateMinutes(risk.typicalHoldMinutesMin, risk.typicalHoldMinutesMax);
        congestionStatus = "moderate";
      }
    } else {
      // Not yet run — no observation exists. Only a known bottleneck at
      // either end moves this off the neutral baseline.
      const risk = riskByStation.get(to.stationCode) ?? riskByStation.get(from.stationCode);
      if (risk) {
        delayContributionMinutes = structuralEstimateMinutes(risk.typicalHoldMinutesMin, risk.typicalHoldMinutesMax);
        congestionStatus = "moderate";
      }
    }

    sections.push({
      id: `${from.stationCode}-${to.stationCode}`,
      startStationCode: from.stationCode,
      endStationCode: to.stationCode,
      distanceKm,
      referenceSpeedKmh,
      currentSpeedKmh,
      congestionStatus,
      delayContributionMinutes,
    });
  }

  return sections;
}

/** Which section a train currently sits in, matched by its current/next station codes. */
export function findCurrentSection(train: Train, sections: RailwaySection[]): RailwaySection | undefined {
  return sections.find(
    (section) => section.startStationCode === train.currentStationCode && section.endStationCode === train.nextStationCode,
  );
}
