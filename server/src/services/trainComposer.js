"use strict";

/**
 * trainComposer.js — Joins the two upstream feeds into one answer.
 *
 *   erail.in (services/erailClient)  → the timetable: station CODES, scheduled
 *                                      times, cumulative distance, and a real
 *                                      lat/lng for every stop.
 *   rappid.in (services/trainScraper) → today's reality: per-stop delay,
 *                                      actual times, and sometimes an explicit
 *                                      "the train is here" marker.
 *
 * Neither is sufficient alone. The live feed publishes station *names* with no
 * codes, no coordinates and no cumulative distance, so it cannot be drawn on a
 * map; the timetable knows nothing about today. Joining them is what produces
 * a train that has both a real delay and a real position.
 *
 * The join key is cumulative distance from origin, not the station name: both
 * feeds agree on it to the kilometre, whereas the names diverge freely
 * ("Dd Upadhyaya Jn" vs "Pt Deen Dayal Upadhyaya Jn", "V Lakshmibai Jhansi
 * Jhs" vs "Virangana Lakshmibai Jhansi"). Name matching is only the fallback.
 *
 * Everything here is derived. No train's position, delay or ETA is written
 * down anywhere in this repository — they are computed from the timetable, the
 * live delay, and the current time in India.
 */

const {
  delayMinutesToStatus,
  parseTimeToMinutes,
  addMinutesToTime,
  nowInIST,
  clamp,
} = require("../lib/status");
const { getStationCoords } = require("../data/stationCoords");

/**
 * Peak running speeds by service class (km/h). Used only to bound the
 * timetable-derived leg speed — the timetable itself is the primary source,
 * these stop a short leg with a rounded-down schedule from implying 300 km/h.
 */
const CLASS_SPEED_CEILING_KMH = {
  rajdhani: 130,
  vandebharat: 160,
  tejas: 130,
  shatabdi: 130,
  duronto: 130,
  garibrath: 120,
  humsafar: 110,
  samparkkranti: 110,
  superfast: 110,
  express: 110,
  mail: 100,
  passenger: 70,
  memu: 70,
  demu: 70,
  default: 110,
};

/**
 * How old rappid.in's own "Updated X ago" timestamp can be before its delay
 * figures stop being treated as current.
 *
 * rappid.in does not always have a fresh reading for every train — for a
 * train it hasn't rescraped in a while, it keeps serving the last snapshot it
 * has, and that snapshot often shows every single stop as "On Time". That is
 * not the same claim as "this train is currently on time" — it is "the last
 * time we checked, which was a while ago, it was". Below this threshold the
 * feed is treated as current; at or above it, the composed train is marked
 * live-cached (not "live") and the status sentence says plainly how old the
 * reading is, rather than quietly presenting a stale snapshot with full
 * "LIVE" confidence.
 *
 * The number itself is set from what the feed actually does, not a guess:
 * sampling every browse-list train's real `updated_time` shows a normal
 * operating cluster from a few minutes up to ~90 minutes old (routine
 * rescrape lag), then a sharp jump straight to 8-150+ HOURS old for trains
 * the feed has effectively stopped tracking. A lower threshold (20 min was
 * tried first) sits inside that normal cluster and flags nearly every train
 * as stale, which is technically defensible but drowns out the signal that
 * actually matters: a reading old enough that it is not routine feed lag but
 * a train the feed has gone dark on.
 */
const STALE_FEED_THRESHOLD_MINUTES = 90;

/** How much of a leg is spent accelerating away from / braking into a stop. */
const ACCELERATION_FRACTION = 0.12;
const BRAKING_FRACTION = 0.12;
/** Speed at the moment of leaving or entering a platform, as a fraction of cruise. */
const TERMINAL_SPEED_FRACTION = 0.25;

function speedCeilingFor(serviceClass, trainName) {
  const haystack = `${serviceClass || ""} ${trainName || ""}`.toLowerCase().replace(/[^a-z]/g, "");
  for (const key of Object.keys(CLASS_SPEED_CEILING_KMH)) {
    if (key !== "default" && haystack.includes(key)) return CLASS_SPEED_CEILING_KMH[key];
  }
  return CLASS_SPEED_CEILING_KMH.default;
}

// ─── Stop merging ─────────────────────────────────────────────────────────────

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(jn|jct|junction|central|ctr|cantt|city|terminus|term|road|rd)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Attach each live observation to its timetable stop.
 *
 * Distance first (both feeds report the same cumulative kilometres), then a
 * normalised-name match, then positional fallback when the two lists happen to
 * be the same length — which they are whenever the live feed is complete.
 */
function mergeStops(scheduleStops, liveStops) {
  const unclaimed = new Set(liveStops.map((_, index) => index));

  const byDistance = new Map();
  for (const live of liveStops) {
    if (live.distanceFromOriginKm === null) continue;
    if (!byDistance.has(live.distanceFromOriginKm)) byDistance.set(live.distanceFromOriginKm, []);
    byDistance.get(live.distanceFromOriginKm).push(live);
  }

  const sameLength = scheduleStops.length === liveStops.length;

  return scheduleStops.map((stop, index) => {
    let match = null;

    // 1. Exact cumulative distance.
    const exact = byDistance.get(stop.distanceFromOriginKm);
    if (exact) match = exact.find((live) => unclaimed.has(live.index)) || null;

    // 2. Distance within a rounding tolerance.
    if (!match) {
      match =
        liveStops.find(
          (live) =>
            unclaimed.has(live.index) &&
            live.distanceFromOriginKm !== null &&
            Math.abs(live.distanceFromOriginKm - stop.distanceFromOriginKm) <= 3,
        ) || null;
    }

    // 3. Station name, stripped of the decorations the two feeds disagree on.
    if (!match) {
      const target = normalizeName(stop.stationName);
      if (target) {
        match =
          liveStops.find((live) => unclaimed.has(live.index) && normalizeName(live.stationName) === target) || null;
      }
    }

    // 4. Same-length lists: trust the ordering.
    if (!match && sameLength && unclaimed.has(index)) match = liveStops[index];

    if (match) unclaimed.delete(match.index);

    return {
      ...stop,
      // The timetable is authoritative for identity and geography; the live
      // feed only ever contributes today's observations on top.
      position: stop.position || positionFromTable(stop.stationCode),
      live: match
        ? {
            actualTime: match.actualTime,
            delayMinutes: match.delayMinutes,
            delayText: match.delayText,
            platform: match.platform,
            isCurrent: match.isCurrent,
            liveStationName: match.stationName,
          }
        : null,
    };
  });
}

function positionFromTable(stationCode) {
  const entry = getStationCoords(stationCode);
  return entry ? { lat: entry.lat, lng: entry.lng } : null;
}

// ─── Journey position ─────────────────────────────────────────────────────────

/**
 * Work out where along its route the train currently is.
 *
 * The timetable gives every stop an elapsed-minutes offset from the origin's
 * departure, so the question becomes: how many schedule-minutes into the
 * journey is this run? That is (wall-clock elapsed − current delay): a train
 * running 20 minutes late has covered 20 fewer minutes' worth of schedule than
 * the clock suggests.
 *
 * The one genuinely ambiguous input is *which* run we are looking at — a
 * 33-hour train has two or three sets of rolling stock out at once. We resolve
 * it by testing each recent departure day and taking the most recent one whose
 * elapsed time falls inside the journey.
 */
function resolveJourneyPosition(schedule, delayMinutes, reference = new Date()) {
  const stops = schedule.stops;
  const last = stops[stops.length - 1];
  const totalScheduleMinutes = last.elapsedArrivalMinutes ?? last.elapsedDepartureMinutes ?? 0;

  const departureMinutes = parseTimeToMinutes(schedule.scheduledDeparture ?? stops[0].scheduledDeparture);
  const now = nowInIST(reference);

  if (departureMinutes === null || totalScheduleMinutes <= 0) {
    return { phase: "unknown", stopIndex: 0, legProgress: 0, schedulePositionMinutes: null, elapsedMinutes: null };
  }

  // Candidate runs: one per departure day, most recent first. The +1 day of
  // slack covers a train that departs late in the evening on the far side of
  // the IST date boundary from "now".
  const maxDayOffset = Math.ceil(totalScheduleMinutes / 1440) + 1;
  let elapsedMinutes = null;

  for (let dayOffset = 0; dayOffset <= maxDayOffset; dayOffset++) {
    const startAbsolute = (now.dayIndex - dayOffset) * 1440 + departureMinutes;
    const elapsed = now.absoluteMinutes - startAbsolute;
    if (elapsed >= 0 && elapsed <= totalScheduleMinutes) {
      elapsedMinutes = elapsed;
      break;
    }
  }

  if (elapsedMinutes === null) {
    // No run is mid-journey. Decide whether the most recent one has finished
    // or the next has yet to leave, so the UI can say which.
    const startToday = now.dayIndex * 1440 + departureMinutes;
    const phase = now.absoluteMinutes < startToday ? "not-started" : "completed";
    return {
      phase,
      stopIndex: phase === "completed" ? stops.length - 1 : 0,
      legProgress: 0,
      schedulePositionMinutes: null,
      elapsedMinutes: null,
      totalScheduleMinutes,
    };
  }

  const schedulePosition = clamp(elapsedMinutes - (delayMinutes || 0), 0, totalScheduleMinutes);

  // Locate the stop pair bracketing that schedule position.
  let stopIndex = 0;
  let legProgress = 0;
  let dwelling = false;

  for (let i = 0; i < stops.length; i++) {
    const arrival = stops[i].elapsedArrivalMinutes ?? stops[i].elapsedDepartureMinutes ?? 0;
    const departure = stops[i].elapsedDepartureMinutes ?? arrival;

    if (schedulePosition < arrival) break;

    stopIndex = i;

    if (schedulePosition <= departure) {
      dwelling = true; // standing at this platform
      legProgress = 0;
      break;
    }

    const next = stops[i + 1];
    if (!next) {
      legProgress = 1;
      break;
    }
    const nextArrival = next.elapsedArrivalMinutes ?? next.elapsedDepartureMinutes ?? departure;
    const legMinutes = nextArrival - departure;
    if (schedulePosition < nextArrival) {
      dwelling = false;
      legProgress = legMinutes > 0 ? clamp((schedulePosition - departure) / legMinutes, 0, 1) : 0;
      break;
    }
  }

  return {
    phase: "running",
    stopIndex,
    legProgress,
    dwelling,
    schedulePositionMinutes: schedulePosition,
    elapsedMinutes,
    totalScheduleMinutes,
  };
}

/**
 * The delay actually observed at the train's current position.
 *
 * The live feed publishes a delay figure against *every* stop, but only the
 * ones at or behind the train are observations — the rest are the operator's
 * forward projection, and the terminus in particular tends to sit at a
 * hopeful "On Time" for the whole journey. Reading the last row of the feed
 * therefore reports a train as punctual while it is an hour down mid-route,
 * so we only ever look backwards from where the train has actually got to.
 *
 * @returns {number|null} signed minutes, or null when nothing behind the train reported
 */
function resolveObservedDelay(merged, journey) {
  // An explicit "the train is here" marker outranks anything inferred.
  const flagged = merged.find((stop) => stop.live?.isCurrent === true);
  if (flagged && flagged.live.delayMinutes !== null && flagged.live.delayMinutes !== undefined) {
    return flagged.live.delayMinutes;
  }

  if (journey.phase === "not-started") return null;

  const upperBound = journey.phase === "completed" ? merged.length - 1 : journey.stopIndex;
  for (let i = Math.min(upperBound, merged.length - 1); i >= 0; i--) {
    const observed = merged[i].live?.delayMinutes;
    if (observed !== null && observed !== undefined) return observed;
  }
  return null;
}

/** Straight-line interpolation between two stops. */
function interpolatePosition(fromStop, toStop, progress) {
  const from = fromStop?.position || null;
  const to = toStop?.position || null;
  if (from && to) {
    return {
      lat: from.lat + (to.lat - from.lat) * progress,
      lng: from.lng + (to.lng - from.lng) * progress,
    };
  }
  return from || to || null;
}

/**
 * Instantaneous speed, shaped so a train accelerates out of a stop, cruises,
 * and brakes into the next one. The cruise value is derived from the
 * timetable's own pace for this leg (distance ÷ booked minutes), bounded by
 * what the service class can physically do.
 */
function computeSpeedKmh(fromStop, toStop, progress, dwelling, ceilingKmh) {
  if (dwelling || !toStop) return 0;

  const legKm = toStop.distanceFromOriginKm - fromStop.distanceFromOriginKm;
  const departure = fromStop.elapsedDepartureMinutes ?? fromStop.elapsedArrivalMinutes ?? 0;
  const arrival = toStop.elapsedArrivalMinutes ?? toStop.elapsedDepartureMinutes ?? departure;
  const legMinutes = arrival - departure;
  if (legKm <= 0 || legMinutes <= 0) return 0;

  const averageKmh = (legKm / legMinutes) * 60;
  // Cruise sits above the leg average because the ramps at each end drag the
  // average down; the uplift is exactly what the trapezoid profile below loses.
  const rampCost = (ACCELERATION_FRACTION + BRAKING_FRACTION) * (1 - TERMINAL_SPEED_FRACTION) / 2;
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

/** Confidence degrades as delay grows — mirrors src/services/etaService.ts. */
function confidenceFromDelay(delayMinutes) {
  return Math.round(clamp(98 - (Number(delayMinutes) || 0), 55, 98));
}

// ─── Composition ──────────────────────────────────────────────────────────────

/**
 * Build the full Train + route payload for one train.
 *
 * @param {string} trainId
 * @param {{ok: boolean, data?: object, error?: string, fromCache?: boolean}} scheduleResult
 * @param {{ok: boolean, data?: object, error?: string, fromCache?: boolean}} liveResult
 */
function composeTrain(trainId, scheduleResult, liveResult) {
  const hasSchedule = scheduleResult && scheduleResult.ok && scheduleResult.data;
  const hasLive = liveResult && liveResult.ok && liveResult.data;

  if (!hasSchedule) {
    return {
      train: unavailableTrain(trainId, liveResult),
      stops: [],
      dataSource: "unavailable",
      errors: {
        schedule: scheduleResult?.error ?? "Timetable unavailable.",
        live: hasLive ? null : liveResult?.error ?? "Live status unavailable.",
      },
    };
  }

  const schedule = scheduleResult.data;
  const live = hasLive ? liveResult.data : null;
  const feedAgeMinutes = live?.feedUpdatedAgeMinutes ?? null;
  const isFeedStale = feedAgeMinutes !== null && feedAgeMinutes >= STALE_FEED_THRESHOLD_MINUTES;

  const merged = live ? mergeStops(schedule.stops, live.stops) : schedule.stops.map((stop) => ({
    ...stop,
    position: stop.position || positionFromTable(stop.stationCode),
    live: null,
  }));

  // Resolving delay and position is circular: where the train is depends on
  // how late it is, and how late it is is read off the stop it has reached.
  // Seed with the feed's own headline, place the train, then re-read the delay
  // from behind that position and place it once more. Two passes converge —
  // the second delay is derived from a position that already accounts for the
  // first, and a third pass has never moved the answer in testing.
  let delayMinutes = live?.currentDelay ?? 0;
  let journey = resolveJourneyPosition(schedule, delayMinutes);

  if (live) {
    const refined = resolveObservedDelay(merged, journey);
    if (refined !== null && refined !== delayMinutes) {
      delayMinutes = refined;
      journey = resolveJourneyPosition(schedule, delayMinutes);
    }
  }

  // Prefer the feed's own "you are here" when it publishes one — it beats any
  // clock arithmetic, because it reflects an actual reported passing.
  let stopIndex = journey.stopIndex;
  let legProgress = journey.legProgress;
  let dwelling = Boolean(journey.dwelling);

  const feedCurrentIndex = merged.findIndex((stop) => stop.live?.isCurrent === true);
  if (feedCurrentIndex >= 0 && journey.phase !== "completed") {
    if (feedCurrentIndex > stopIndex) {
      stopIndex = feedCurrentIndex;
      legProgress = 0;
      dwelling = true;
    } else if (feedCurrentIndex === stopIndex) {
      dwelling = journey.dwelling ?? dwelling;
    }
  }

  const currentStop = merged[stopIndex] || merged[0];
  const nextStop = merged[Math.min(stopIndex + 1, merged.length - 1)];
  const destinationStop = merged[merged.length - 1];
  const isAtDestination = stopIndex >= merged.length - 1;

  const ceilingKmh = speedCeilingFor(schedule.serviceClass, schedule.trainName);
  const speedKmh =
    journey.phase === "running" && !isAtDestination
      ? computeSpeedKmh(currentStop, nextStop, legProgress, dwelling, ceilingKmh)
      : 0;

  const position =
    journey.phase === "running" && !isAtDestination && !dwelling
      ? interpolatePosition(currentStop, nextStop, legProgress)
      : currentStop.position;

  const distanceCoveredKm = isAtDestination
    ? destinationStop.distanceFromOriginKm
    : currentStop.distanceFromOriginKm +
      (nextStop.distanceFromOriginKm - currentStop.distanceFromOriginKm) * legProgress;

  const scheduledEta = schedule.scheduledArrival ?? destinationStop.scheduledArrival ?? "—";
  const predictedEta = addMinutesToTime(scheduledEta, delayMinutes);
  const confidence = confidenceFromDelay(delayMinutes);
  const spread = Math.round(clamp((100 - confidence) / 3, 2, 8));

  const train = {
    id: schedule.trainNumber || trainId,
    name: schedule.trainName || live?.trainName || `Train ${trainId}`,
    shortName: buildShortName(schedule.trainName || live?.trainName, trainId),
    category: schedule.serviceClass || "Express",

    originCode: schedule.originCode,
    originName: schedule.originName,
    destinationCode: schedule.destinationCode,
    destinationName: schedule.destinationName,

    currentStationCode: currentStop.stationCode,
    currentStationName: currentStop.stationName,
    nextStationCode: isAtDestination ? currentStop.stationCode : nextStop.stationCode,
    nextStationName: isAtDestination ? currentStop.stationName : nextStop.stationName,

    currentSpeedKmh: Math.round(speedKmh),
    distanceRemainingKm: Math.max(0, Math.round(destinationStop.distanceFromOriginKm - distanceCoveredKm)),
    distanceCoveredKm: Math.round(distanceCoveredKm),
    totalDistanceKm: destinationStop.distanceFromOriginKm,
    position: position || { lat: 22.5, lng: 80.0 },

    scheduledEta,
    predictedEta,
    delayMinutes,
    delayStatus: delayMinutesToStatus(delayMinutes),

    predictionConfidence: confidence,
    predictedEtaRangeStart: addMinutesToTime(predictedEta, -spread),
    predictedEtaRangeEnd: addMinutesToTime(predictedEta, spread),

    updatedAt: live?.fetchedAt ?? schedule.fetchedAt ?? new Date().toISOString(),

    // ── Live-only extensions (optional on the frontend Train type) ──
    dataSource: hasLive ? (isFeedStale || liveResult.fromCache ? "live-cached" : "live") : "schedule",
    liveStatusText: buildStatusText(
      schedule,
      currentStop,
      nextStop,
      delayMinutes,
      journey,
      dwelling,
      isAtDestination,
      isFeedStale ? feedAgeMinutes : null,
    ),
    liveRunning: journey.phase === "running",
    journeyPhase: journey.phase,
    runsOnDays: schedule.runsOnDays,
    durationLabel: schedule.durationLabel,
    scheduledDeparture: schedule.scheduledDeparture,
    feedUpdatedLabel: live?.feedUpdatedLabel ?? null,
    liveFeedStale: isFeedStale,
    currentStopIndex: stopIndex,
    legProgress: Number(legProgress.toFixed(4)),
  };

  return {
    train,
    stops: buildRouteStops(merged, stopIndex, delayMinutes, isAtDestination),
    schedule,
    dataSource: train.dataSource,
    errors: { schedule: null, live: hasLive ? null : liveResult?.error ?? null },
  };
}

/** Route stops in the shape the frontend RouteStopProgress expects. */
function buildRouteStops(merged, currentIndex, delayMinutes, isAtDestination) {
  return merged.map((stop, index) => {
    const isPassed = index < currentIndex;
    const isCurrent = index === currentIndex && !isAtDestination;
    const scheduledTime = stop.scheduledDeparture ?? stop.scheduledArrival ?? "—";

    // A stop the train has already called at keeps whatever delay was actually
    // observed there. Everything ahead inherits today's current delay, because
    // that is the only honest projection available without a model.
    const observedDelay = stop.live?.delayMinutes;
    const stopDelay = isPassed ? observedDelay ?? 0 : delayMinutes;

    const predictedTime =
      isPassed && stop.live?.actualTime
        ? stop.live.actualTime
        : scheduledTime !== "—"
          ? addMinutesToTime(scheduledTime, stopDelay)
          : "—";

    return {
      stationCode: stop.stationCode,
      stationName: stop.stationName,
      distanceFromOriginKm: stop.distanceFromOriginKm,
      scheduledTime,
      scheduledArrival: stop.scheduledArrival,
      scheduledDeparture: stop.scheduledDeparture,
      actualTime: stop.live?.actualTime ?? null,
      predictedTime,
      delayMinutes: stopDelay,
      delayText: stop.live?.delayText ?? null,
      platform: stop.live?.platform ?? stop.platform ?? null,
      haltMinutes: stop.haltMinutes,
      dayOffset: stop.dayOffset,
      zone: stop.zone,
      position: stop.position,
      status: isPassed ? "passed" : isCurrent ? "current" : "upcoming",
    };
  });
}

function buildShortName(name, trainId) {
  const value = String(name || "").trim();
  if (!value) return String(trainId);
  return value.length <= 22 ? value : `${value.slice(0, 21).trimEnd()}…`;
}

/** The human sentence shown prominently on Train Details. */
function buildStatusText(schedule, currentStop, nextStop, delayMinutes, journey, dwelling, isAtDestination, staleFeedAgeMinutes) {
  const lateness =
    delayMinutes > 0
      ? `running ${formatDuration(delayMinutes)} late`
      : delayMinutes < 0
        ? `running ${formatDuration(-delayMinutes)} early`
        : "on time";

  // A stale reading gets an explicit caveat rather than being presented with
  // the same confidence as a genuinely current one — otherwise an hour-old
  // "On Time" default reads identically to a fresh confirmation, which is
  // exactly what it isn't.
  const staleNote =
    staleFeedAgeMinutes !== null
      ? ` (live feed last updated ${formatDuration(staleFeedAgeMinutes)} ago — may not reflect current running)`
      : "";

  if (journey.phase === "not-started") {
    return `Not yet departed — scheduled to leave ${schedule.originName} at ${schedule.scheduledDeparture ?? "—"}.${staleNote}`;
  }
  if (journey.phase === "completed" || isAtDestination) {
    return `Journey complete — arrived ${schedule.destinationName}, ${lateness}.${staleNote}`;
  }
  if (dwelling) {
    return `At ${currentStop.stationName} — ${lateness}. Departs next for ${nextStop.stationName}.${staleNote}`;
  }
  return `Departed ${currentStop.stationName}, approaching ${nextStop.stationName} — ${lateness}.${staleNote}`;
}

function formatDuration(minutes) {
  const value = Math.round(Math.abs(minutes));
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** Minimal, honest placeholder when we could not resolve the train at all. */
function unavailableTrain(trainId, liveResult) {
  const liveName = liveResult?.ok ? liveResult.data.trainName : null;
  return {
    id: trainId,
    name: liveName || `Train ${trainId}`,
    shortName: String(trainId),
    category: "Unknown",
    originCode: "—",
    originName: "Unknown",
    destinationCode: "—",
    destinationName: "Unknown",
    currentStationCode: "—",
    currentStationName: "Unavailable",
    nextStationCode: "—",
    nextStationName: "—",
    currentSpeedKmh: 0,
    distanceRemainingKm: 0,
    distanceCoveredKm: 0,
    totalDistanceKm: 0,
    position: { lat: 22.5, lng: 80.0 },
    scheduledEta: "—",
    predictedEta: "—",
    delayMinutes: 0,
    delayStatus: "on-time",
    predictionConfidence: 0,
    predictedEtaRangeStart: "—",
    predictedEtaRangeEnd: "—",
    updatedAt: new Date().toISOString(),
    dataSource: "unavailable",
    liveStatusText: "No timetable or live status could be retrieved for this train.",
    liveRunning: false,
    journeyPhase: "unknown",
    currentStopIndex: 0,
    legProgress: 0,
  };
}

module.exports = {
  composeTrain,
  resolveJourneyPosition,
  mergeStops,
  computeSpeedKmh,
  interpolatePosition,
  confidenceFromDelay,
};
