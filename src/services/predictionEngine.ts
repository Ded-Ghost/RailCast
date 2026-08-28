import type { RouteStopProgress, Train, WeatherSnapshot } from "@/types";
import { getOperationalRiskFactors } from "@/data/operationalRiskFactors";
import { clamp, addMinutesToTime } from "@/lib/timeMath";

/**
 * predictionEngine.ts — a multi-factor projection of delay AT ARRIVAL,
 * layered on top of the live feed's raw CURRENT delay.
 *
 * The previous model was a flat pass-through: `predictedEta = scheduledEta +
 * currentDelayMinutes`, i.e. "assume whatever the delay is right now stays
 * exactly the same all the way to the destination." That's the right
 * baseline when nothing else is known, but it's a genuinely too-simple
 * prediction — it ignores whether the train is actively gaining or losing
 * time, real weather ahead, and known chokepoints still on the route.
 *
 * This layers three REAL, independently-sourced signals on top of that
 * baseline:
 *
 *   1. Momentum — the live feed records an observed delay at every stop the
 *      train has already passed (see trainComposer.js on the backend). The
 *      trend across the last few of those is a genuine short-term signal:
 *      a train that picked up 12 minutes over its last three stops is more
 *      likely still losing time than one holding flat.
 *   2. Weather — real current conditions (Open-Meteo, see weatherService.ts)
 *      at the train's current/next station. Rain and fog are the only
 *      conditions with an established, defensible link to Indian Railways
 *      running speed; a scaled, capped penalty is applied only when the
 *      live reading actually shows one.
 *   3. Structural risk — known, real bottlenecks still ahead on THIS
 *      train's actual route (see data/operationalRiskFactors.ts), weighted
 *      down since a "typical" hold is not a certainty.
 *
 * What this deliberately is NOT: a validated, accuracy-tested model. RailCast
 * has no historical ground truth to backtest against (see
 * operationalRiskFactors.ts's module doc for why), so nothing here can
 * honestly claim a specific accuracy percentage — that would require
 * comparing predictions against real outcomes at scale, which requires data
 * this app does not have. This is a better-reasoned heuristic than the flat
 * baseline it replaces, not a measured one.
 */

export interface PredictionFactorDetail {
  label: string;
  impactMinutes: number;
  detail: string;
}

export interface EnhancedPrediction {
  /** The raw, unmodified delay the live feed reports right now — unchanged by this engine. */
  currentDelayMinutes: number;
  /** This engine's projection for delay AT ARRIVAL. */
  projectedDelayMinutes: number;
  projectedEta: string;
  confidence: number;
  rangeStart: string;
  rangeEnd: string;
  factors: PredictionFactorDetail[];
}

const MOMENTUM_LOOKBACK_STOPS = 3;
/** A short recent trend is a signal, not a guarantee — only half of it is extrapolated forward. */
const MOMENTUM_DAMPING = 0.5;
const MOMENTUM_CAP_MINUTES = 20;

/** Per-remaining-leg penalty, minutes — modest and bounded, not a physics simulation. */
const WEATHER_IMPACT_PER_LEG: Record<WeatherSnapshot["condition"], number> = { Rain: 1.5, Fog: 3, Clear: 0 };
const WEATHER_IMPACT_CAP_MINUTES: Record<WeatherSnapshot["condition"], number> = { Rain: 20, Fog: 45, Clear: 0 };

/** A "typical" bottleneck hold is a range, not a certainty — only this fraction of its midpoint counts toward the projection. */
const STRUCTURAL_RISK_WEIGHT = 0.5;

export function computeEnhancedPrediction(
  train: Train,
  stops: RouteStopProgress[],
  weather: WeatherSnapshot | null,
  referenceDate: Date = new Date(),
): EnhancedPrediction {
  const currentDelayMinutes = train.delayMinutes ?? 0;
  const factors: PredictionFactorDetail[] = [
    {
      label: "Current observed delay",
      impactMinutes: currentDelayMinutes,
      detail: "What the live running-status feed reports right now.",
    },
  ];

  // ── Momentum ────────────────────────────────────────────────────────────
  const passedWithDelay = stops.filter((stop) => stop.status === "passed");
  const recent = passedWithDelay.slice(-MOMENTUM_LOOKBACK_STOPS);
  let momentumMinutes = 0;
  if (recent.length >= 2) {
    const first = recent[0].delayMinutes;
    const last = recent[recent.length - 1].delayMinutes;
    momentumMinutes = clamp((last - first) * MOMENTUM_DAMPING, -MOMENTUM_CAP_MINUTES, MOMENTUM_CAP_MINUTES);
    if (Math.abs(momentumMinutes) >= 1) {
      factors.push({
        label: momentumMinutes > 0 ? "Worsening trend" : "Recovering trend",
        impactMinutes: Math.round(momentumMinutes),
        detail: `Observed delay moved from ${formatSigned(first)} to ${formatSigned(last)} min over the last ${recent.length} stops.`,
      });
    }
  }

  // ── Weather ─────────────────────────────────────────────────────────────
  let weatherImpactMinutes = 0;
  if (weather && weather.condition !== "Clear") {
    const remainingLegs = Math.max(1, stops.filter((stop) => stop.status !== "passed").length - 1);
    const perLeg = WEATHER_IMPACT_PER_LEG[weather.condition];
    const cap = WEATHER_IMPACT_CAP_MINUTES[weather.condition];
    weatherImpactMinutes = clamp(perLeg * remainingLegs, 0, cap);
    if (weatherImpactMinutes >= 1) {
      factors.push({
        label: `${weather.conditionLabel} ahead`,
        impactMinutes: Math.round(weatherImpactMinutes),
        detail: `Live conditions at ${weather.stationName}: ${weather.conditionLabel}, ${Math.round(weather.temperatureCelsius)}°C, wind ${Math.round(weather.windSpeedKmh)} km/h.`,
      });
    }
  }

  // ── Structural risk ─────────────────────────────────────────────────────
  const riskFactors = getOperationalRiskFactors(stops, referenceDate);
  const structuralImpactMinutes = Math.round(
    riskFactors.reduce((total, risk) => total + ((risk.typicalHoldMinutesMin + risk.typicalHoldMinutesMax) / 2) * STRUCTURAL_RISK_WEIGHT, 0),
  );
  if (structuralImpactMinutes >= 1) {
    factors.push({
      label: "Known bottlenecks ahead",
      impactMinutes: structuralImpactMinutes,
      detail: riskFactors.map((risk) => risk.title).join("; "),
    });
  }

  const projectedDelayMinutes = Math.round(
    clamp(
      currentDelayMinutes + momentumMinutes + weatherImpactMinutes + structuralImpactMinutes,
      -30,
      currentDelayMinutes + 240,
    ),
  );
  const projectedEta = addMinutesToTime(train.scheduledEta, projectedDelayMinutes);

  // Confidence starts from the same delay-magnitude formula as the plain
  // baseline, then erodes further with how much this projection has moved
  // away from the raw observed number — the more adjustment layered on top
  // of "what the feed says right now," the less certain the answer is.
  const adjustmentMagnitude = Math.abs(projectedDelayMinutes - currentDelayMinutes);
  const confidence = Math.round(clamp(98 - Math.abs(projectedDelayMinutes) - adjustmentMagnitude * 0.5, 40, 98));
  const spread = Math.round(clamp((100 - confidence) / 3, 2, 10));

  return {
    currentDelayMinutes,
    projectedDelayMinutes,
    projectedEta,
    confidence,
    rangeStart: addMinutesToTime(projectedEta, -spread),
    rangeEnd: addMinutesToTime(projectedEta, spread),
    factors,
  };
}

function formatSigned(minutes: number): string {
  return minutes >= 0 ? `+${minutes}` : `${minutes}`;
}
