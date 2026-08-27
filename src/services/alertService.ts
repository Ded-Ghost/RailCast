import type { AlertItem, DataSourceStatus, DelayStatus } from "@/types";
import { alerts } from "@/data";
import { parseTimeToMinutes } from "@/lib/timeMath";
import { resolveAfter } from "./mockDelay";

/**
 * Real state-transition-driven alert generation — `evaluate()` compares a
 * train's previous and current state and returns whatever new alerts that
 * change actually warrants. No alert here is hardcoded; each is only
 * produced when the underlying numbers genuinely crossed a threshold.
 * `listAlerts`/`listCriticalAlerts` below still serve the static seed
 * list (data/alerts.ts) — that's the network-wide alert history a real
 * backend would own; `evaluate` is what a live feed would call on every
 * update to append to it.
 */

const DELAY_SEVERITY_RANK: Record<DelayStatus, number> = {
  "on-time": 0,
  minor: 1,
  significant: 2,
  severe: 3,
};

/** Minutes of ETA drift, in either direction, worth calling out as "changed significantly". */
const ETA_CHANGE_THRESHOLD_MINUTES = 3;

export interface AlertEvaluationSnapshot {
  delayMinutes: number;
  delayStatus: DelayStatus;
  predictedEta: string; // "HH:MM"
  currentSpeedKmh: number;
  currentStationName: string;
}

export interface AlertEvaluationInput {
  trainId: string;
  trainName: string;
  /** null on the very first observation — nothing to compare against yet, so no alerts fire. */
  previous: AlertEvaluationSnapshot | null;
  current: AlertEvaluationSnapshot;
}

function etaDiffMinutes(previousEta: string, currentEta: string): number {
  const diff = parseTimeToMinutes(currentEta) - parseTimeToMinutes(previousEta);
  // Handle midnight wrap by taking the shorter signed distance around the clock.
  if (diff > 720) return diff - 1440;
  if (diff < -720) return diff + 1440;
  return diff;
}

function makeAlert(partial: Omit<AlertItem, "id" | "timestamp" | "read">): AlertItem {
  return {
    ...partial,
    // crypto.randomUUID is for ID uniqueness only — not railway data, but
    // using it instead of Math.random() keeps this file free of ANY
    // randomness, in keeping with the "no Math.random for railway
    // behavior" rule even where it wouldn't technically apply.
    id: `alert-${partial.trainId ?? "network"}-${partial.category}-${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    read: false,
  };
}

export const alertService = {
  async listAlerts(): Promise<AlertItem[]> {
    return resolveAfter(alerts);
  },

  async listCriticalAlerts(): Promise<AlertItem[]> {
    return resolveAfter(alerts.filter((alert) => alert.category === "critical"));
  },

  /**
   * Compares one train's previous and current state and returns any new
   * alerts that transition genuinely warrants — never more than one alert
   * per rule per call, and none at all if nothing crossed a threshold.
   * Covers: ETA changed significantly, delay crossed a severity threshold
   * (worse), delay recovery detected (better), and severe delay reached.
   */
  evaluate({ trainId, trainName, previous, current }: AlertEvaluationInput): AlertItem[] {
    if (!previous) return [];
    const newAlerts: AlertItem[] = [];

    const etaDelta = etaDiffMinutes(previous.predictedEta, current.predictedEta);
    if (Math.abs(etaDelta) >= ETA_CHANGE_THRESHOLD_MINUTES) {
      const improved = etaDelta < 0;
      newAlerts.push(
        makeAlert({
          title: improved ? "ETA Improved" : "ETA Changed",
          message: `Expected arrival for ${trainName} adjusted to ${current.predictedEta} (previously ${previous.predictedEta}).`,
          severity: improved ? "info" : "warning",
          category: "eta-change",
          trainId,
        }),
      );
    }

    const previousRank = DELAY_SEVERITY_RANK[previous.delayStatus];
    const currentRank = DELAY_SEVERITY_RANK[current.delayStatus];
    if (currentRank > previousRank) {
      newAlerts.push(
        makeAlert({
          title: current.delayStatus === "severe" ? "Severe Delay Predicted" : "Delay Increasing",
          message: `${trainName} delay crossed into "${current.delayStatus}" (+${current.delayMinutes} min) near ${current.currentStationName}.`,
          severity: current.delayStatus === "severe" ? "critical" : "warning",
          category: "delay",
          trainId,
          location: current.currentStationName,
        }),
      );
    } else if (currentRank < previousRank) {
      newAlerts.push(
        makeAlert({
          title: "Delay Recovery Detected",
          message: `${trainName} recovered from "${previous.delayStatus}" to "${current.delayStatus}" — now +${current.delayMinutes} min near ${current.currentStationName}.`,
          severity: "success",
          category: "recovery",
          trainId,
          location: current.currentStationName,
        }),
      );
    }

    return newAlerts;
  },

  /** Fires when a module's data-source status degrades — "Live data became stale". */
  evaluateDataSourceChange(
    label: string,
    previousStatus: DataSourceStatus,
    currentStatus: DataSourceStatus,
  ): AlertItem[] {
    const degraded =
      (previousStatus === "live" && (currentStatus === "stale" || currentStatus === "offline")) ||
      (previousStatus === "stale" && currentStatus === "offline");
    if (!degraded) return [];

    return [
      makeAlert({
        title: currentStatus === "offline" ? "Live Data Unavailable" : "Live Data Became Stale",
        message: `${label} ${currentStatus === "offline" ? "lost its live connection" : "hasn't updated recently"}.`,
        severity: "warning",
        category: "data-quality",
      }),
    ];
  },
};
