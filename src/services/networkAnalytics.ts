import type { RouteSection, Train } from "@/types";
import { isKnownBottleneckStation } from "@/data/operationalRiskFactors";

/**
 * networkAnalytics.ts — Delay Intelligence's numbers, computed entirely from
 * the same live `Train[]` list every other page reads (the browse list from
 * GET /api/trains). Nothing here is seeded or hand-authored.
 *
 * This replaces an earlier version of the page that read static, invented
 * numbers from data/networkStats.ts and data/delayTrend.ts — including a
 * "Prediction Accuracy: 92.4%" figure with no measurement behind it at all.
 * RailCast has no historical ground truth to validate a prediction against
 * (see predictionEngine.ts's module doc), so nothing here claims an accuracy
 * percentage; every figure below is either a direct real-data aggregate or
 * explicitly labeled as accumulating live, starting from empty.
 */

export interface RealDelaySummary {
  trackedTrains: number;
  averageDelayMinutes: number;
  averageDelayTrendDeltaMinutes: number | null;
  maxDelayMinutes: number;
  maxDelayTrainId: string | null;
  maxDelayTrainName: string | null;
  maxDelayLocation: string | null;
  liveCoveragePercent: number;
  delayedCount: number;
  delayedPercent: number;
}

export function computeRealDelaySummary(
  trains: Train[],
  recentTrendPoints: { avgDelayMinutes: number }[],
): RealDelaySummary {
  if (trains.length === 0) {
    return {
      trackedTrains: 0,
      averageDelayMinutes: 0,
      averageDelayTrendDeltaMinutes: null,
      maxDelayMinutes: 0,
      maxDelayTrainId: null,
      maxDelayTrainName: null,
      maxDelayLocation: null,
      liveCoveragePercent: 0,
      delayedCount: 0,
      delayedPercent: 0,
    };
  }

  const averageDelayMinutes = trains.reduce((sum, t) => sum + t.delayMinutes, 0) / trains.length;
  const worst = trains.reduce((max, t) => (t.delayMinutes > max.delayMinutes ? t : max), trains[0]);
  const liveCovered = trains.filter((t) => (t.dataSource === "live" || t.dataSource === "live-cached") && !t.liveFeedStale);
  const delayed = trains.filter((t) => t.delayStatus !== "on-time");

  // Compares the current average against the earliest sample still in the
  // trend buffer (real, accumulated this session) — null until there are at
  // least two samples to compare, rather than inventing a "vs yesterday" figure.
  const trendDelta =
    recentTrendPoints.length >= 2
      ? Math.round((averageDelayMinutes - recentTrendPoints[0].avgDelayMinutes) * 10) / 10
      : null;

  return {
    trackedTrains: trains.length,
    averageDelayMinutes: Math.round(averageDelayMinutes * 10) / 10,
    averageDelayTrendDeltaMinutes: trendDelta,
    maxDelayMinutes: worst.delayMinutes,
    maxDelayTrainId: worst.id,
    maxDelayTrainName: worst.shortName || worst.name,
    maxDelayLocation: worst.currentStationName,
    liveCoveragePercent: Math.round((liveCovered.length / trains.length) * 100),
    delayedCount: delayed.length,
    delayedPercent: Math.round((delayed.length / trains.length) * 100),
  };
}

export interface RealDelayCause {
  label: string;
  percent: number;
  count: number;
}

/**
 * Categorizes every currently-tracked train into one of four REAL, checkable
 * buckets — never a "Weather 28% / Technical 15%" style breakdown, which
 * would require attributing a specific cause to a specific train's delay
 * with no data source that actually says why that train is late.
 */
export function computeRealDelayCauses(trains: Train[]): RealDelayCause[] {
  if (trains.length === 0) return [];

  let onTime = 0;
  let atKnownBottleneck = 0;
  let staleReading = 0;
  let otherDelay = 0;

  for (const train of trains) {
    if (train.delayStatus === "on-time") {
      onTime++;
    } else if (train.liveFeedStale) {
      staleReading++;
    } else if (isKnownBottleneckStation(train.currentStationCode)) {
      atKnownBottleneck++;
    } else {
      otherDelay++;
    }
  }

  const buckets: { label: string; count: number }[] = [
    { label: "On Time", count: onTime },
    { label: "At Known Congestion Point", count: atKnownBottleneck },
    { label: "Delayed — Unspecified", count: otherDelay },
    { label: "Stale Reading (Unconfirmed)", count: staleReading },
  ];

  return buckets
    .filter((b) => b.count > 0)
    .map((b) => ({ ...b, percent: Math.round((b.count / trains.length) * 100) }));
}

/**
 * Real currently-delayed trains grouped by where they are right now, ranked
 * by average delay. Deliberately named "Busiest Delay Points" rather than
 * "Sections" — grouping is by current station, not a fixed track segment, so
 * this answers "where is the network hurting right now", not "which named
 * corridor is historically worst" (which would need data this app doesn't have).
 */
export function computeBusiestDelayPoints(trains: Train[], limit = 6): RouteSection[] {
  const delayed = trains.filter((t) => t.delayStatus !== "on-time");
  const byStation = new Map<string, Train[]>();
  for (const train of delayed) {
    const key = train.currentStationName || train.currentStationCode;
    const list = byStation.get(key) ?? [];
    list.push(train);
    byStation.set(key, list);
  }

  const worstStatus = (group: Train[]) =>
    group.reduce((worst, t) => (rank(t.delayStatus) > rank(worst.delayStatus) ? t : worst), group[0]).delayStatus;

  return [...byStation.entries()]
    .map(([stationName, group]) => ({
      id: `point-${stationName}`,
      name: stationName,
      avgDelayMinutes: Math.round((group.reduce((sum, t) => sum + t.delayMinutes, 0) / group.length) * 10) / 10,
      affectedTrains: group.length,
      status: worstStatus(group),
    }))
    .sort((a, b) => b.avgDelayMinutes - a.avgDelayMinutes)
    .slice(0, limit);
}

function rank(status: Train["delayStatus"]): number {
  return { "on-time": 0, minor: 1, significant: 2, severe: 3 }[status];
}
