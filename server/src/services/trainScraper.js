"use strict";

/**
 * trainScraper.js — Live running status (Node.js built-ins only).
 *
 * Source: https://rappid.in/apis/train.php?train_no=NNNNN
 *
 * Why this source. The originally-specified NTES endpoints on
 * enquiry.indianrail.gov.in are, as of this writing, serving an outage notice
 * ("Due to some technical activity this site will be un-available for some
 * time") to every path — including the REST ones — so nothing there can be
 * parsed. rappid.in republishes the same NTES running status as plain JSON
 * with no key, no rate limit and no bot wall, and is the only probed source
 * that returns real per-stop delays. See PART 1 notes in README.
 *
 * What this file is responsible for: turning that payload into a normalised,
 * *schedule-agnostic* live observation — per-stop delay, actual vs scheduled
 * times, and whichever stop the feed marks as current. It deliberately does
 * NOT know about geography or position; joining this to the timetable (and
 * therefore to coordinates) is trainComposer.js's job.
 *
 * Payload shape, for reference:
 *   { success, train_name: "12301 Rajdhani Expres Running Status",
 *     updated_time: "Updated 54min ago",
 *     data: [ { is_current_station, station_name, distance: "200 km",
 *               timing: "18:4918:49", delay: "7min", platform, halt } ] }
 *
 * Note `timing` packs TWO "HH:MM" values with no separator and the ACTUAL
 * time comes FIRST, the scheduled time second — "07:3307:20" with delay
 * "13min" is 07:33 actual against an 07:20 booking. Reading them the other
 * way round (the obvious guess) inverts every arrival on the page.
 */

const { fetchText } = require("../lib/httpClient");

const RAPPID_ENDPOINT = "https://rappid.in/apis/train.php";
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes — matches the feed's own refresh cadence
const LIVE_TIMEOUT_MS = 8000;
const LIVE_RETRIES = 2;

/** trainNumber -> { data, fetchedAt } */
const cache = new Map();
/** Collapses concurrent misses for the same train onto one upstream call. */
const inFlight = new Map();

// ─── Parsing helpers ──────────────────────────────────────────────────────────

/**
 * Parse rappid's delay column into signed minutes (+late / -early).
 * Handles "On Time", "7min", "15 mins late", "5 mins early", "1hr 20min".
 * Returns null when the feed has nothing to say, which is distinct from 0
 * ("we know it is exactly on time") and must not be collapsed into it.
 */
function parseDelayText(text) {
  if (text === null || text === undefined) return null;
  const value = String(text).trim().toLowerCase();
  if (!value || value === "-" || value === "n/a") return null;
  if (value === "on time" || value === "no delay" || value === "ontime" || value === "right time") return 0;

  const early = /\bearly\b/.test(value);

  let minutes = 0;
  let matched = false;

  const hourMatch = value.match(/(\d+)\s*(?:hr|hour|h)\b/);
  if (hourMatch) {
    minutes += Number(hourMatch[1]) * 60;
    matched = true;
  }
  const minuteMatch = value.match(/(\d+)\s*(?:min|mins|minute|minutes|m)\b/);
  if (minuteMatch) {
    minutes += Number(minuteMatch[1]);
    matched = true;
  }
  if (!matched) {
    const bare = value.match(/^(\d+)$/);
    if (!bare) return null;
    minutes = Number(bare[1]);
  }

  if (!Number.isFinite(minutes)) return null;
  return early ? -minutes : minutes;
}

/**
 * Split the packed `timing` column. Two concatenated "HH:MM" values means
 * actual-then-scheduled; a single value means the feed only knows one time
 * (treated as scheduled, since that is what it is before a train arrives).
 */
function parseTiming(raw) {
  if (!raw) return { actual: null, scheduled: null };
  const value = String(raw).trim();
  if (!value || value === "-" || /^(destination|source)$/i.test(value)) {
    return { actual: null, scheduled: null };
  }

  const pair = value.match(/^(\d{1,2}:\d{2})\s*(\d{1,2}:\d{2})$/);
  if (pair) return { actual: normalizeClock(pair[1]), scheduled: normalizeClock(pair[2]) };

  const single = value.match(/(\d{1,2}:\d{2})/);
  if (single) return { actual: null, scheduled: normalizeClock(single[1]) };

  return { actual: null, scheduled: null };
}

function normalizeClock(value) {
  const match = String(value).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** "200 km" -> 200; "-" (the origin) -> 0. */
function parseDistanceKm(raw) {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim();
  if (!value || value === "-") return 0;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

/** "2min" / "5 min" / "Source" / "Destination" -> minutes (0 for the terminals). */
function parseHaltMinutes(raw) {
  if (!raw) return 0;
  const value = String(raw).trim();
  if (/^(source|destination|-)$/i.test(value)) return 0;
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

/** rappid appends a suffix to the title: "12301 Rajdhani Expres Running Status". */
function parseTrainName(raw, trainNumber) {
  return String(raw || "")
    .replace(/running status/i, "")
    .replace(new RegExp(`^\\s*${trainNumber}\\s*`), "")
    .trim();
}

/** Some stop names carry a trailing "(CODE)"; keep the code when it is there. */
function splitStationName(raw) {
  const value = String(raw || "").trim();
  const match = value.match(/^(.*?)\s*\(([A-Z]{2,6})\)\s*$/);
  if (match) return { stationName: match[1].trim(), stationCode: match[2] };
  return { stationName: value, stationCode: null };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a train's live running status.
 *
 * @param {string|number} trainNumber
 * @returns {Promise<{ok: true, data: object, fromCache: boolean} | {ok: false, error: string}>}
 */
async function fetchTrainStatus(trainNumber) {
  const id = String(trainNumber || "").trim();
  if (!/^\d{4,5}$/.test(id)) {
    return { ok: false, error: "Train number must be 4-5 digits." };
  }

  const cached = cache.get(id);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { ok: true, data: cached.data, fromCache: true };
  }

  if (inFlight.has(id)) return inFlight.get(id);

  const work = (async () => {
    let payload;
    try {
      const body = await fetchText(`${RAPPID_ENDPOINT}?train_no=${encodeURIComponent(id)}`, {
        timeoutMs: LIVE_TIMEOUT_MS,
        retries: LIVE_RETRIES,
        headers: { Accept: "application/json" },
      });
      payload = JSON.parse(body);
    } catch (err) {
      if (err.statusCode === 404) return { ok: false, error: `Train ${id} is not published by the live feed.` };
      if (err.code === "ETIMEDOUT") return { ok: false, error: "Live status feed timed out." };
      if (err.code === "EBADJSON" || err instanceof SyntaxError) {
        return { ok: false, error: "Live status feed returned a malformed response." };
      }
      return { ok: false, error: `Live status feed unavailable: ${err.message}` };
    }

    if (!payload || payload.success !== true || !Array.isArray(payload.data) || payload.data.length === 0) {
      return { ok: false, error: `No live running status is available for train ${id} right now.` };
    }

    const rawStops = payload.data;
    const currentIndexFromFeed = rawStops.findIndex((stop) => stop.is_current_station === true);

    const stops = rawStops.map((stop, index) => {
      const { stationName, stationCode } = splitStationName(stop.station_name);
      const { actual, scheduled } = parseTiming(stop.timing);
      const delayMinutes = parseDelayText(stop.delay);

      return {
        index,
        stationName,
        stationCode, // usually null — rappid publishes names, not codes
        distanceFromOriginKm: parseDistanceKm(stop.distance),
        scheduledTime: scheduled,
        actualTime: actual,
        delayMinutes,
        delayText: String(stop.delay || "").trim() || null,
        platform: String(stop.platform || "").trim() || null,
        haltMinutes: parseHaltMinutes(stop.halt),
        isCurrent: stop.is_current_station === true,
        isOrigin: /^source$/i.test(String(stop.halt || "")),
        isDestination: /^destination$/i.test(String(stop.halt || "")),
      };
    });

    // Headline delay: the feed's current stop when it marks one, else the last
    // stop that actually reported something. Falling back to stops[0] would
    // report the origin's departure delay for a train halfway across the country.
    const reporting = stops.filter((stop) => stop.delayMinutes !== null);
    const currentStop = currentIndexFromFeed >= 0 ? stops[currentIndexFromFeed] : null;
    const currentDelay =
      currentStop?.delayMinutes ??
      (reporting.length > 0 ? reporting[reporting.length - 1].delayMinutes : null);

    const data = {
      trainNumber: id,
      trainName: parseTrainName(payload.train_name, id),
      stops,
      /** Index the feed itself marked as current, or -1 when it declined to. */
      currentStopIndex: currentIndexFromFeed,
      currentStationName: currentStop ? currentStop.stationName : null,
      currentDelay,
      /** True only when the feed positively identifies a current stop. */
      running: currentIndexFromFeed >= 0,
      feedUpdatedLabel: String(payload.updated_time || "").trim() || null,
      feedUpdatedAgeMinutes: parseFeedAgeMinutes(payload.updated_time),
      fetchedAt: new Date().toISOString(),
      source: "rappid.in",
    };

    cache.set(id, { data, fetchedAt: Date.now() });
    return { ok: true, data, fromCache: false };
  })().finally(() => inFlight.delete(id));

  inFlight.set(id, work);
  return work;
}

/** "Updated 54min ago" / "Updated 133hr 30min ago" -> age in minutes. */
function parseFeedAgeMinutes(raw) {
  if (!raw) return null;
  const value = String(raw).toLowerCase();
  const hours = value.match(/(\d+)\s*hr/);
  const minutes = value.match(/(\d+)\s*min/);
  if (!hours && !minutes) return null;
  return (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
}

function clearCache(trainNumber) {
  if (trainNumber) cache.delete(String(trainNumber).trim());
  else cache.clear();
}

function getCacheStats() {
  const now = Date.now();
  return {
    entries: cache.size,
    details: Array.from(cache.entries()).map(([trainNumber, entry]) => ({
      trainNumber,
      ageSeconds: Math.round((now - entry.fetchedAt) / 1000),
      expiresInSeconds: Math.max(0, Math.round((CACHE_TTL_MS - (now - entry.fetchedAt)) / 1000)),
    })),
  };
}

module.exports = {
  fetchTrainStatus,
  clearCache,
  getCacheStats,
  // Exported for unit checks.
  parseDelayText,
  parseTiming,
  parseDistanceKm,
};
