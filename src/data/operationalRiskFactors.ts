import type { RouteStopProgress } from "@/types";

/**
 * operationalRiskFactors.ts — known, recurring, real Indian Railways
 * operational bottlenecks, matched against a specific train's actual route.
 *
 * This is NOT a statistical model. RailCast has no access to per-train
 * historical punctuality logs: neither of the two upstream feeds (erail.in's
 * timetable, rappid.in's live status — see server/README) publishes a history,
 * and no public keyless API does either. "Look at the last 30 days and compute
 * how often this train was held at Santragachi" is therefore not a number this
 * app can honestly produce — there is no 30 days of data behind it, and
 * inventing one would be fabrication.
 *
 * What IS real and checkable: a small number of station-level chokepoints and
 * seasonal effects are well-documented, structural facts about the Indian
 * Railways network — not statistics about any one train, but geography and
 * infrastructure that apply to every train that passes through them. Santragachi
 * sitting on Howrah's final approach and routinely holding trains for a platform
 * is one of the reasons Santragachi itself was developed into a full terminal.
 * Ghaziabad funnelling four directions of traffic onto Delhi's limited approach
 * tracks, Thane/Kalyan sharing track with Mumbai's suburban network, and winter
 * fog closing down the Indo-Gangetic plain every December–February are the same
 * kind of fact — reported for years by the railway press and by punctuality data
 * IR itself has published, not something specific to today's run.
 *
 * So this module answers a narrower, honest question: "does THIS train's real,
 * live-fetched route pass through a location known for this kind of delay, at a
 * time of year when it's relevant?" It never touches the computed ETA or delay
 * figures — those stay 100% derived from live data, exactly as before. This is
 * a separate, clearly-labelled "heads up" layer.
 */

export type OperationalRiskKind = "terminal-approach" | "junction-congestion" | "seasonal-fog" | "seasonal-monsoon";

/** Every station code that anchors one of the known bottlenecks below — network-wide analytics can check membership without needing a route's full stop list. */
export function isKnownBottleneckStation(stationCode: string): boolean {
  return KNOWN_BOTTLENECKS.some((def) => def.stationCode === stationCode);
}

export interface OperationalRiskFactor {
  kind: OperationalRiskKind;
  stationCode: string;
  stationName: string;
  title: string;
  description: string;
  /** A defensible estimated range, not a measured average — see module docs. */
  typicalHoldMinutesMin: number;
  typicalHoldMinutesMax: number;
}

interface BottleneckDefinition {
  stationCode: string;
  /**
   * "approach" — only relevant when the named terminal appears LATER in this
   * train's route (i.e. it is heading there, not leaving it).
   * "transit" — relevant whenever the route passes through this station at
   * all, in either direction (a junction's congestion doesn't care which way
   * you're going through it).
   */
  scope: "approach" | "transit";
  guardsStationCode?: string;
  title: string;
  description: string;
  typicalHoldMinutesMin: number;
  typicalHoldMinutesMax: number;
}

const KNOWN_BOTTLENECKS: BottleneckDefinition[] = [
  {
    stationCode: "SRC",
    scope: "approach",
    guardsStationCode: "HWH",
    title: "Santragachi outer approach to Howrah",
    description:
      "Santragachi sits on the final approach to Howrah, one of the network's busiest terminals by platform turnover. Limited turn-back capacity routinely holds arriving trains here, or at Howrah's own outer signals, until a platform clears.",
    typicalHoldMinutesMin: 5,
    typicalHoldMinutesMax: 20,
  },
  {
    stationCode: "GZB",
    scope: "approach",
    guardsStationCode: "NDLS",
    title: "Ghaziabad approach to Delhi",
    description:
      "Ghaziabad is the last major junction before Delhi, where lines from four directions converge onto a small number of approach tracks. Holds here are common, especially during peak arrival windows into New Delhi.",
    typicalHoldMinutesMin: 5,
    typicalHoldMinutesMax: 15,
  },
  {
    stationCode: "GZB",
    scope: "approach",
    guardsStationCode: "NZM",
    title: "Ghaziabad approach to Delhi",
    description:
      "Ghaziabad is the last major junction before Delhi, where lines from four directions converge onto a small number of approach tracks. Holds here are common, especially during peak arrival windows into Hazrat Nizamuddin.",
    typicalHoldMinutesMin: 5,
    typicalHoldMinutesMax: 15,
  },
  {
    stationCode: "TNA",
    scope: "approach",
    guardsStationCode: "CSMT",
    title: "Thane approach to Mumbai CSMT",
    description:
      "At Thane, long-distance trains merge onto the Central Line's suburban-shared tracks, one of the busiest commuter corridors in the world. Long-distance services are routinely held to let suburban services through.",
    typicalHoldMinutesMin: 5,
    typicalHoldMinutesMax: 15,
  },
  {
    stationCode: "KYN",
    scope: "approach",
    guardsStationCode: "CSMT",
    title: "Kalyan Jn approach to Mumbai",
    description:
      "Kalyan is where the Central Line's main, Karjat and Kasara branches converge before Mumbai. The resulting cross-traffic is a well-known source of holds for CSMT-bound trains.",
    typicalHoldMinutesMin: 5,
    typicalHoldMinutesMax: 15,
  },
  {
    stationCode: "ET",
    scope: "transit",
    title: "Itarsi Jn congestion",
    description:
      "Itarsi is one of the busiest junctions on the network, where the Delhi–Chennai and Mumbai–Howrah trunk routes cross. Heavy mixed passenger/freight traffic through its yard is a recurring source of delay in both directions.",
    typicalHoldMinutesMin: 5,
    typicalHoldMinutesMax: 20,
  },
  {
    stationCode: "BZA",
    scope: "transit",
    title: "Vijayawada Jn congestion",
    description:
      "Vijayawada is the convergence point of several South/South-Central Railway trunk routes and a major crew-change point. Congestion here is a recurring source of delay for through trains.",
    typicalHoldMinutesMin: 5,
    typicalHoldMinutesMax: 15,
  },
  {
    stationCode: "DDU",
    scope: "transit",
    title: "Deen Dayal Upadhyaya Jn congestion",
    description:
      "DDU Jn (formerly Mughal Sarai) is historically one of the busiest freight marshalling yards in Asia. Passenger trains through here can be held for freight priority movements.",
    typicalHoldMinutesMin: 5,
    typicalHoldMinutesMax: 20,
  },
  {
    stationCode: "CNB",
    scope: "transit",
    title: "Kanpur Central congestion",
    description:
      "Kanpur Central carries a dense mix of Delhi–Howrah trunk traffic and local services through a constrained number of through lines, making it a recurring source of delay on this corridor.",
    typicalHoldMinutesMin: 5,
    typicalHoldMinutesMax: 15,
  },
];

/** Roughly the Indo-Gangetic plain — the winter fog belt (Dec–Feb) that causes the single biggest source of severe, multi-hour delays on North Indian trunk routes, especially into Delhi. */
const FOG_BELT_MIN_LAT = 24;

function isFogSeason(month: number): boolean {
  return month === 11 || month === 0 || month === 1; // Dec, Jan, Feb
}

function isMonsoonSeason(month: number): boolean {
  return month >= 5 && month <= 8; // Jun-Sep
}

/**
 * Which of a train's real route stops carry a known operational risk, given
 * the current time of year. Only looks at stops the train hasn't already
 * passed — a bottleneck already behind it isn't a "heads up" any more.
 */
export function getOperationalRiskFactors(
  stops: RouteStopProgress[],
  referenceDate: Date = new Date(),
): OperationalRiskFactor[] {
  if (stops.length === 0) return [];

  const codeIndex = new Map<string, number>();
  stops.forEach((stop, index) => {
    if (!codeIndex.has(stop.stationCode)) codeIndex.set(stop.stationCode, index);
  });
  const nameFor = (code: string) => stops.find((stop) => stop.stationCode === code)?.stationName ?? code;
  const notPassedAt = (index: number) => stops[index]?.status !== "passed";

  const results: OperationalRiskFactor[] = [];
  const seen = new Set<string>();

  for (const def of KNOWN_BOTTLENECKS) {
    const bottleneckIndex = codeIndex.get(def.stationCode);
    if (bottleneckIndex === undefined || !notPassedAt(bottleneckIndex)) continue;

    if (def.scope === "approach") {
      const terminalIndex = def.guardsStationCode ? codeIndex.get(def.guardsStationCode) : undefined;
      if (terminalIndex === undefined || terminalIndex <= bottleneckIndex) continue;
    }

    const key = `${def.stationCode}-${def.guardsStationCode ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      kind: def.scope === "approach" ? "terminal-approach" : "junction-congestion",
      stationCode: def.stationCode,
      stationName: nameFor(def.stationCode),
      title: def.title,
      description: def.description,
      typicalHoldMinutesMin: def.typicalHoldMinutesMin,
      typicalHoldMinutesMax: def.typicalHoldMinutesMax,
    });
  }

  const month = referenceDate.getMonth();

  if (isFogSeason(month)) {
    const fogStop = stops.find((stop) => stop.status !== "passed" && (stop.position?.lat ?? -90) >= FOG_BELT_MIN_LAT);
    if (fogStop) {
      results.push({
        kind: "seasonal-fog",
        stationCode: fogStop.stationCode,
        stationName: fogStop.stationName ?? fogStop.stationCode,
        title: "Winter fog risk on this route",
        description:
          "This route runs through the Indo-Gangetic plain, which sees dense winter fog most years between December and February, historically the single biggest cause of severe, multi-hour delays on North Indian trunk routes, especially into Delhi.",
        typicalHoldMinutesMin: 15,
        typicalHoldMinutesMax: 120,
      });
    }
  }

  if (isMonsoonSeason(month)) {
    const monsoonStop = stops.find((stop) => stop.status !== "passed" && stop.zone === "Konkan");
    if (monsoonStop) {
      results.push({
        kind: "seasonal-monsoon",
        stationCode: monsoonStop.stationCode,
        stationName: monsoonStop.stationName ?? monsoonStop.stationCode,
        title: "Monsoon risk on this route",
        description:
          "This route runs through the Konkan/Western Ghats coastal belt, where the June–September monsoon regularly brings speed restrictions and, in heavy years, washouts, a recurring source of delay on this stretch.",
        typicalHoldMinutesMin: 10,
        typicalHoldMinutesMax: 90,
      });
    }
  }

  return results;
}
