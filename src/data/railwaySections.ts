import type { RailwaySection } from "@/types";
import { getStationByCode } from "./stations";
import { haversineDistanceKm } from "@/lib/geo";

function sectionDistanceKm(startCode: string, endCode: string): number {
  const start = getStationByCode(startCode);
  const end = getStationByCode(endCode);
  if (!start || !end) return 0;
  return Math.round(haversineDistanceKm(start.position, end.position) * 10) / 10;
}

/**
 * Section-by-section health for the Bhubaneswar → New Delhi corridor — the
 * only fully-modeled route today (matches trainRoutes / routeProgress for
 * train 12345). Distances are real (haversine between the actual station
 * coordinates in stations.ts); reference/current speeds and congestion
 * tiers are calibrated mock figures, not live telemetry.
 *
 * Note: KGP → NDLS is a straight-line stand-in for ~1,200km of track
 * through several intermediate states we don't have station-level data
 * for — its distance is real, but treat it as one coarse "remaining
 * journey" segment rather than a single physical block/signal section
 * like the other four.
 */
export const railwaySections: RailwaySection[] = [
  {
    id: "sec-bbs-ctc",
    startStationCode: "BBS",
    endStationCode: "CTC",
    distanceKm: sectionDistanceKm("BBS", "CTC"),
    referenceSpeedKmh: 85,
    currentSpeedKmh: 82,
    congestionStatus: "healthy",
    delayContributionMinutes: 1,
  },
  {
    id: "sec-ctc-jajpur",
    startStationCode: "CTC",
    endStationCode: "JAJPUR",
    distanceKm: sectionDistanceKm("CTC", "JAJPUR"),
    referenceSpeedKmh: 85,
    currentSpeedKmh: 71,
    congestionStatus: "moderate",
    delayContributionMinutes: 9,
  },
  {
    id: "sec-jajpur-bls",
    startStationCode: "JAJPUR",
    endStationCode: "BLS",
    distanceKm: sectionDistanceKm("JAJPUR", "BLS"),
    referenceSpeedKmh: 85,
    currentSpeedKmh: 58,
    congestionStatus: "congested",
    delayContributionMinutes: 16,
  },
  {
    id: "sec-bls-kgp",
    startStationCode: "BLS",
    endStationCode: "KGP",
    distanceKm: sectionDistanceKm("BLS", "KGP"),
    referenceSpeedKmh: 85,
    currentSpeedKmh: 49,
    congestionStatus: "critical",
    delayContributionMinutes: 22,
  },
  {
    id: "sec-kgp-ndls",
    startStationCode: "KGP",
    endStationCode: "NDLS",
    distanceKm: sectionDistanceKm("KGP", "NDLS"),
    referenceSpeedKmh: 85,
    currentSpeedKmh: 74,
    congestionStatus: "moderate",
    delayContributionMinutes: 9,
  },
];

export function getRailwaySections(): RailwaySection[] {
  return railwaySections;
}

/** The corridor's ordered station codes — same order as trainRoutes[0], kept independent so Route Monitor doesn't reach into train-specific data. */
export const CORRIDOR_STATION_CODES = ["BBS", "CTC", "JAJPUR", "BLS", "KGP", "NDLS"];
