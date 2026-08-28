"use strict";

/**
 * erailClient.js — Static timetable + geography source (Node.js built-ins only).
 *
 * erail.in exposes two unauthenticated tilde-delimited endpoints that between
 * them give us everything the live running-status feed does *not* provide:
 *
 *   1. /rail/getTrains.aspx?TrainNo=NNNNN
 *      Train identity: name, origin/destination (code + name), departure,
 *      arrival, duration, running days, total distance, service class, and
 *      erail's own internal train id.
 *
 *   2. /data.aspx?Action=TRAINROUTE&Data1=<internalId>
 *      The full timetable: every stop with its station CODE, scheduled
 *      arrival/departure, halt, cumulative distance, day offset, platform,
 *      zone — and, critically, real lat/lng for each station.
 *
 * That second endpoint is what makes the simulation work for *any* train:
 * position interpolation needs coordinates for the specific stops this train
 * calls at, which no static station table can guarantee covering.
 *
 * Note the two-step lookup: TRAINROUTE keys off erail's internal id, NOT the
 * public train number. Passing "12301" returns a completely different train's
 * route, so the id from step 1 is mandatory.
 *
 * Schedules are timetable data — they change a couple of times a year, not
 * a couple of times an hour — so they are cached for 24 hours.
 */

const { fetchText } = require("../lib/httpClient");

const ERAIL_ORIGIN = "https://erail.in";
const SCHEDULE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** trainNumber -> { data, fetchedAt } */
const scheduleCache = new Map();
/** In-flight requests, so N concurrent callers trigger exactly one upstream fetch. */
const inFlight = new Map();

// ─── Parsing helpers ──────────────────────────────────────────────────────────

/**
 * erail renders times as "HH.MM" and uses the sentinels "First" (origin has
 * no arrival) and "Last" (destination has no departure). Normalise to "HH:MM"
 * and return null for the sentinels so callers can distinguish "no such time"
 * from "midnight".
 */
function normalizeTime(raw) {
  if (!raw) return null;
  const value = String(raw).trim();
  if (!value || value === "First" || value === "Last" || value === "--") return null;
  const match = value.match(/^(\d{1,2})[.:](\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function toFiniteNumber(raw) {
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * "1111110" -> the days of the week the train runs, starting Monday.
 * erail uses '1' for "runs" and '0' for "does not run".
 */
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function parseRunningDays(mask) {
  if (!mask || !/^[01]{7}$/.test(mask)) return [];
  return DAY_LABELS.filter((_, index) => mask[index] === "1");
}

/**
 * Parse the getTrains.aspx payload into train identity fields.
 *
 * The record is one long tilde-delimited row beginning at the first '^'.
 * Most fields sit at fixed offsets from that marker, but the internal id and
 * total distance are located relative to the "DATASOURCE_*" token instead —
 * anchoring on that sentinel survives erail padding the row with extra
 * columns, which fixed indices in that region do not.
 */
function parseTrainMeta(body, trainNumber) {
  if (!body || body.indexOf("^") === -1) return null;

  const fields = body.slice(body.indexOf("^")).split("~");
  const number = (fields[0] || "").replace("^", "").trim();
  if (!number) return null;

  const dataSourceIndex = fields.findIndex((field) => field.startsWith("DATASOURCE"));
  const internalId = dataSourceIndex > 3 ? (fields[dataSourceIndex - 3] || "").trim() : null;
  const serviceClass = dataSourceIndex > 4 ? (fields[dataSourceIndex - 4] || "").trim() : "";
  const totalDistanceKm = dataSourceIndex > 0 ? toFiniteNumber(fields[dataSourceIndex + 3]) : null;

  if (!internalId || !/^\d+$/.test(internalId)) return null;

  return {
    trainNumber: number,
    trainName: titleCase(fields[1] || ""),
    originName: (fields[2] || "").trim(),
    originCode: (fields[3] || "").trim(),
    destinationName: (fields[4] || "").trim(),
    destinationCode: (fields[5] || "").trim(),
    scheduledDeparture: normalizeTime(fields[10]),
    scheduledArrival: normalizeTime(fields[11]),
    durationLabel: (fields[12] || "").replace(".", "h ") + "m",
    runsOnDays: parseRunningDays((fields[13] || "").trim()),
    serviceClass: titleCase(serviceClass),
    totalDistanceKm,
    internalId,
    requestedNumber: String(trainNumber),
  };
}

/**
 * Parse the TRAINROUTE payload into an ordered stop list.
 *
 * The response is a fare table followed by the route, but the two cannot be
 * split on the fare separator '#': erail embeds Hindi station names as HTML
 * entities ("&#2361;&#2366;…"), so '#' occurs inside the route as well. The
 * first '^' is the unambiguous boundary — fares never contain one.
 */
function parseRoute(body) {
  if (!body) return [];
  const start = body.indexOf("^");
  if (start === -1) return [];

  return body
    .slice(start)
    .split("^")
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const f = record.split("~");
      const lat = toFiniteNumber(f[14]);
      const lng = toFiniteNumber(f[15]);

      return {
        sequence: toFiniteNumber(f[0]),
        stationCode: (f[1] || "").trim().toUpperCase(),
        stationName: (f[2] || "").trim(),
        scheduledArrival: normalizeTime(f[3]),
        scheduledDeparture: normalizeTime(f[4]),
        haltMinutes: toFiniteNumber(f[5]) ?? 0,
        distanceFromOriginKm: toFiniteNumber(f[6]) ?? 0,
        dayOffset: (toFiniteNumber(f[7]) ?? 1) - 1, // erail is 1-based; expose 0-based
        platform: (f[8] || "").trim() || null,
        zone: (f[10] || "").trim() || null,
        // Position is only trustworthy when erail actually has a fix; (0,0)
        // is its "unknown" sentinel and would fling markers into the ocean.
        position: isUsableCoordinate(lat, lng) ? { lat, lng } : null,
        elapsedArrivalMinutes: toFiniteNumber(f[16]),
        elapsedDepartureMinutes: toFiniteNumber(f[17]),
      };
    })
    .filter((stop) => stop.stationCode && Number.isFinite(stop.sequence))
    .sort((a, b) => a.sequence - b.sequence);
}

/** Rejects the (0,0) sentinel and anything outside India's bounding box. */
function isUsableCoordinate(lat, lng) {
  if (lat === null || lng === null) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= 5 && lat <= 38 && lng >= 66 && lng <= 98;
}

/** "RAJDHANI EXPRES" -> "Rajdhani Expres" — erail shouts everything. */
function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase())
    .trim();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a train's identity + full timetable with coordinates.
 *
 * @param {string|number} trainNumber
 * @returns {Promise<{ok: true, data: object, fromCache: boolean} | {ok: false, error: string}>}
 */
async function fetchTrainSchedule(trainNumber) {
  const id = String(trainNumber || "").trim();
  if (!/^\d{4,5}$/.test(id)) {
    return { ok: false, error: "Train number must be 4-5 digits." };
  }

  const cached = scheduleCache.get(id);
  if (cached && Date.now() - cached.fetchedAt < SCHEDULE_CACHE_TTL_MS) {
    return { ok: true, data: cached.data, fromCache: true };
  }

  // Collapse concurrent misses onto a single upstream round-trip.
  if (inFlight.has(id)) return inFlight.get(id);

  const work = (async () => {
    try {
      const metaBody = await fetchText(
        `${ERAIL_ORIGIN}/rail/getTrains.aspx?TrainNo=${encodeURIComponent(id)}&DataSource=0&Language=0&Cache=true`,
      );
      const meta = parseTrainMeta(metaBody, id);
      if (!meta) {
        return { ok: false, error: `Train ${id} was not found in the timetable database.` };
      }

      const routeBody = await fetchText(
        `${ERAIL_ORIGIN}/data.aspx?Action=TRAINROUTE&Password=2012&Data1=${encodeURIComponent(meta.internalId)}&Data2=0&Cache=true`,
      );
      const stops = parseRoute(routeBody);
      if (stops.length === 0) {
        return { ok: false, error: `No route data is published for train ${id}.` };
      }

      const data = {
        trainNumber: meta.trainNumber,
        trainName: meta.trainName,
        serviceClass: meta.serviceClass,
        originCode: meta.originCode || stops[0].stationCode,
        originName: meta.originName || stops[0].stationName,
        destinationCode: meta.destinationCode || stops[stops.length - 1].stationCode,
        destinationName: meta.destinationName || stops[stops.length - 1].stationName,
        scheduledDeparture: meta.scheduledDeparture ?? stops[0].scheduledDeparture,
        scheduledArrival: meta.scheduledArrival ?? stops[stops.length - 1].scheduledArrival,
        durationLabel: meta.durationLabel,
        runsOnDays: meta.runsOnDays,
        totalDistanceKm: meta.totalDistanceKm ?? stops[stops.length - 1].distanceFromOriginKm,
        stops,
        fetchedAt: new Date().toISOString(),
        source: "erail.in",
      };

      scheduleCache.set(id, { data, fetchedAt: Date.now() });
      return { ok: true, data, fromCache: false };
    } catch (err) {
      // A stale schedule beats no schedule — timetables barely move, so if the
      // refresh fails we keep serving the last good copy rather than degrading
      // the whole page to "route unavailable".
      if (cached) return { ok: true, data: cached.data, fromCache: true, stale: true };
      if (err.code === "ETIMEDOUT") return { ok: false, error: "Timetable source timed out." };
      return { ok: false, error: `Timetable source unavailable: ${err.message}` };
    } finally {
      inFlight.delete(id);
    }
  })();

  inFlight.set(id, work);
  return work;
}

function getScheduleCacheStats() {
  const now = Date.now();
  return {
    entries: scheduleCache.size,
    trains: Array.from(scheduleCache.keys()),
    oldestAgeSeconds:
      scheduleCache.size === 0
        ? 0
        : Math.round(
            Math.max(...Array.from(scheduleCache.values()).map((entry) => now - entry.fetchedAt)) / 1000,
          ),
  };
}

function clearScheduleCache(trainNumber) {
  if (trainNumber) scheduleCache.delete(String(trainNumber).trim());
  else scheduleCache.clear();
}

module.exports = {
  fetchTrainSchedule,
  getScheduleCacheStats,
  clearScheduleCache,
  // Exported for the station-coordinate harvester and unit checks.
  parseTrainMeta,
  parseRoute,
  normalizeTime,
  isUsableCoordinate,
};
