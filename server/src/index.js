"use strict";

/**
 * RailCast Backend — pure Node.js HTTP server, zero npm dependencies.
 *
 * Composes two unauthenticated upstream feeds into one API (see
 * services/trainComposer.js for why both are needed):
 *
 *   erail.in    → timetable, station codes, per-stop coordinates
 *   rappid.in   → today's running status and per-stop delays
 *
 * Routes
 *   GET /api/health                  service + cache diagnostics
 *   GET /api/stations                station master data (?all=1, ?q=)
 *   GET /api/stations/:code          one station
 *   GET /api/trains                  browse list, live-enriched
 *   GET /api/trains/search?q=        search by number or name
 *   GET /api/trains/:id              base identity for one train
 *   GET /api/trains/:id/status       live status: position, delay, ETA
 *   GET /api/trains/:id/route        stop list with coordinates + progress
 *   GET /api/trains/:id/schedule     full published timetable
 *
 * There is no hardcoded train data anywhere in this server. BROWSE_TRAIN_IDS
 * below is a list of train *numbers* only — a starting point for the search
 * page — and every name, route, time and position attached to them is fetched.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

// ─── Environment ──────────────────────────────────────────────────────────────
// Minimal .env reader; adding dotenv would break the zero-dependency rule.
const envPath = path.join(__dirname, "../../.env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

const PORT = parseInt(process.env.BACKEND_PORT || "3001", 10);
const HOST = process.env.BACKEND_HOST || "0.0.0.0";
/** Comma-separated origins allowed to call this API; "*" allows any. */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",").map((o) => o.trim()).filter(Boolean);
/** How often the browse list is refreshed in the background, seconds. */
const BROWSE_REFRESH_SECONDS = parseInt(process.env.BROWSE_REFRESH_SECONDS || "60", 10);

const { fetchTrainSchedule, getScheduleCacheStats } = require("./services/erailClient");
const { fetchTrainStatus, getCacheStats } = require("./services/trainScraper");
const { composeTrain } = require("./services/trainComposer");
const { listStations, searchStations, getStationCoords, MAJOR_STATION_CODES } = require("./data/stationCoords");

/**
 * Train numbers offered on the search page before the user types anything.
 * Numbers only — everything else about these trains is fetched live. Override
 * with BROWSE_TRAIN_IDS in .env to feature a different set.
 */
const BROWSE_TRAIN_IDS = (
  process.env.BROWSE_TRAIN_IDS ||
  "12301,12302,12951,12952,12002,12009,12259,12621,12615,22691,12431,12841,12137,12925,12801," +
  "12010,12626,12625,12903,12904,12723,12724,12649,12650,12295,12296,16031,16032,12027,12028,12053,12054,12429,12430"
)
  .split(",")
  .map((id) => id.trim())
  .filter((id) => /^\d{4,5}$/.test(id));

const TRAIN_ID_PATTERN = /^\d{4,5}$/;

// ─── Response helpers ─────────────────────────────────────────────────────────

function corsHeaders(req) {
  const origin = req.headers.origin;
  const allowed =
    ALLOWED_ORIGINS.includes("*") || !origin
      ? "*"
      : ALLOWED_ORIGINS.includes(origin)
        ? origin
        : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function sendJSON(req, res, statusCode, body) {
  const json = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
    "Cache-Control": "no-cache",
    ...corsHeaders(req),
  });
  res.end(json);
}

const ok = (req, res, data, meta = {}) =>
  sendJSON(req, res, 200, { success: true, data, meta: { timestamp: new Date().toISOString(), ...meta } });

const fail = (req, res, statusCode, code, message) =>
  sendJSON(req, res, statusCode, { success: false, error: { code, message } });

const notFound = (req, res, message = "Not found") => fail(req, res, 404, "NOT_FOUND", message);

// ─── Train assembly ───────────────────────────────────────────────────────────

/**
 * Fetch both feeds for a train and compose them. The two upstream calls are
 * independent, so they run concurrently; both are internally cached, so a warm
 * train costs nothing.
 */
async function loadTrain(trainId) {
  const [scheduleResult, liveResult] = await Promise.all([
    fetchTrainSchedule(trainId),
    fetchTrainStatus(trainId),
  ]);
  return composeTrain(trainId, scheduleResult, liveResult);
}

/** Runs `worker` over `items` with a bounded number in flight at once. */
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = await worker(items[index], index);
      } catch {
        results[index] = null;
      }
    }
  });
  await Promise.all(runners);
  return results;
}

// ─── Browse-list snapshot ─────────────────────────────────────────────────────
/**
 * The browse list would otherwise cost 30 upstream calls per request. Instead a
 * background cycle keeps a composed snapshot warm and every request serves it
 * instantly. The very first request (cold process) waits for one build.
 */
const browseSnapshot = { trains: [], builtAt: 0, building: null };

async function buildBrowseSnapshot() {
  const composed = await mapWithConcurrency(BROWSE_TRAIN_IDS, 8, async (id) => (await loadTrain(id)).train);
  const trains = composed.filter(Boolean);
  if (trains.length > 0) {
    browseSnapshot.trains = trains;
    browseSnapshot.builtAt = Date.now();
  }
  return trains;
}

function refreshBrowseSnapshot() {
  if (browseSnapshot.building) return browseSnapshot.building;
  browseSnapshot.building = buildBrowseSnapshot()
    .catch((err) => {
      console.error("[RailCast] Browse refresh failed:", err.message);
      return browseSnapshot.trains;
    })
    .finally(() => {
      browseSnapshot.building = null;
    });
  return browseSnapshot.building;
}

async function getBrowseTrains() {
  const ageMs = Date.now() - browseSnapshot.builtAt;
  if (browseSnapshot.trains.length === 0) {
    // Cold start — nothing to serve yet, so this one request waits.
    await refreshBrowseSnapshot();
  } else if (ageMs > BROWSE_REFRESH_SECONDS * 1000) {
    // Warm but stale: hand back what we have and refresh behind the response.
    refreshBrowseSnapshot();
  }
  return browseSnapshot.trains;
}

// ─── Router ───────────────────────────────────────────────────────────────────

async function router(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);
  const pathname = requestUrl.pathname.replace(/\/+$/, "") || "/";
  const query = Object.fromEntries(requestUrl.searchParams);

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(req));
    return res.end();
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return fail(req, res, 405, "METHOD_NOT_ALLOWED", "This API is read-only; use GET.");
  }

  // ── GET /api/health ──
  if (pathname === "/api/health") {
    return ok(req, res, {
      ok: true,
      service: "railcast-backend",
      version: "3.0.0",
      uptimeSeconds: Math.round(process.uptime()),
      sources: {
        schedule: { provider: "erail.in", cache: getScheduleCacheStats() },
        live: { provider: "rappid.in", cache: getCacheStats() },
      },
      browseList: {
        trainIds: BROWSE_TRAIN_IDS,
        cached: browseSnapshot.trains.length,
        ageSeconds: browseSnapshot.builtAt ? Math.round((Date.now() - browseSnapshot.builtAt) / 1000) : null,
      },
      stations: { total: listStations().length, major: MAJOR_STATION_CODES.length },
    });
  }

  // ── GET /api/stations ──
  if (pathname === "/api/stations") {
    if (query.q) {
      const results = searchStations(query.q, Number(query.limit) || 25);
      return ok(req, res, results, { count: results.length, query: query.q });
    }
    // Default to the major-station subset: the maps render a marker per row,
    // and all 1,000+ at once is an unreadable smear plus a lot of DOM.
    const all = query.all === "1" || query.all === "true";
    const data = listStations({ majorOnly: !all });
    return ok(req, res, data, { count: data.length, scope: all ? "all" : "major" });
  }

  // ── GET /api/stations/:code ──
  const stationMatch = pathname.match(/^\/api\/stations\/([A-Za-z0-9]+)$/);
  if (stationMatch) {
    const code = stationMatch[1].toUpperCase();
    const entry = getStationCoords(code);
    if (!entry) return notFound(req, res, `Station ${code} is not in the coordinate database.`);
    return ok(req, res, { code, name: entry.name, position: { lat: entry.lat, lng: entry.lng }, zone: entry.zone });
  }

  // ── GET /api/trains  and  GET /api/trains/search?q= ──
  if (pathname === "/api/trains" || pathname === "/api/trains/search") {
    const q = String(query.q || "").trim().toLowerCase();
    const browse = await getBrowseTrains();

    if (!q) {
      return ok(req, res, browse, {
        count: browse.length,
        source: "browse-list",
        refreshedAt: browseSnapshot.builtAt ? new Date(browseSnapshot.builtAt).toISOString() : null,
      });
    }

    const matches = browse.filter(
      (train) =>
        train.id.includes(q) ||
        train.name.toLowerCase().includes(q) ||
        train.category.toLowerCase().includes(q) ||
        train.originName.toLowerCase().includes(q) ||
        train.destinationName.toLowerCase().includes(q),
    );

    // A train number outside the browse list is still perfectly valid — look it
    // up live rather than telling the user it does not exist.
    if (matches.length === 0 && TRAIN_ID_PATTERN.test(q)) {
      const composed = await loadTrain(q);
      if (composed.dataSource !== "unavailable") {
        return ok(req, res, [composed.train], { count: 1, source: "live-lookup", query: q });
      }
      return ok(req, res, [], { count: 0, source: "live-lookup", query: q, error: composed.errors.schedule });
    }

    return ok(req, res, matches, { count: matches.length, source: "browse-list", query: q });
  }

  // ── Per-train routes ──
  const trainMatch = pathname.match(/^\/api\/trains\/(\d{1,6})(?:\/(status|route|schedule))?$/);
  if (trainMatch) {
    const trainId = trainMatch[1];
    const section = trainMatch[2] || "base";

    if (!TRAIN_ID_PATTERN.test(trainId)) {
      return fail(req, res, 400, "INVALID_TRAIN_ID", "Train number must be 4-5 digits.");
    }

    if (section === "schedule") {
      const scheduleResult = await fetchTrainSchedule(trainId);
      if (!scheduleResult.ok) {
        return notFound(req, res, scheduleResult.error);
      }
      const schedule = scheduleResult.data;
      return ok(
        req,
        res,
        {
          trainId,
          trainName: schedule.trainName,
          serviceClass: schedule.serviceClass,
          originCode: schedule.originCode,
          originName: schedule.originName,
          destinationCode: schedule.destinationCode,
          destinationName: schedule.destinationName,
          scheduledDeparture: schedule.scheduledDeparture,
          scheduledArrival: schedule.scheduledArrival,
          durationLabel: schedule.durationLabel,
          runsOnDays: schedule.runsOnDays,
          totalDistanceKm: schedule.totalDistanceKm,
          stops: schedule.stops.map((stop) => ({
            sequence: stop.sequence,
            stationCode: stop.stationCode,
            stationName: stop.stationName,
            scheduledArrival: stop.scheduledArrival,
            scheduledDeparture: stop.scheduledDeparture,
            haltMinutes: stop.haltMinutes,
            distanceFromOriginKm: stop.distanceFromOriginKm,
            dayOffset: stop.dayOffset,
            platform: stop.platform,
            zone: stop.zone,
            position: stop.position,
            elapsedArrivalMinutes: stop.elapsedArrivalMinutes,
            elapsedDepartureMinutes: stop.elapsedDepartureMinutes,
          })),
          updatedAt: schedule.fetchedAt,
        },
        { source: "erail.in", fromCache: Boolean(scheduleResult.fromCache) },
      );
    }

    const composed = await loadTrain(trainId);

    if (composed.dataSource === "unavailable") {
      return notFound(
        req,
        res,
        composed.errors.schedule || composed.errors.live || `No data available for train ${trainId}.`,
      );
    }

    const meta = {
      dataSource: composed.dataSource,
      liveDataAvailable: composed.dataSource.startsWith("live"),
      liveError: composed.errors.live,
      sources: { schedule: "erail.in", live: "rappid.in" },
    };

    if (section === "route") {
      return ok(req, res, { trainId, stops: composed.stops }, { ...meta, count: composed.stops.length });
    }
    // "status" and the bare train route both return the composed Train; the
    // bare one is just the identity view of the same object.
    return ok(req, res, composed.train, meta);
  }

  return notFound(req, res, `No API endpoint matches ${pathname}.`);
}

// ─── Server ───────────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const startedAt = Date.now();
  router(req, res)
    .catch((err) => {
      console.error(`[RailCast] ${req.method} ${req.url} failed:`, err.stack || err.message);
      if (!res.headersSent) {
        fail(req, res, 500, "INTERNAL_ERROR", "The server hit an unexpected error handling this request.");
      } else {
        res.end();
      }
    })
    .finally(() => {
      if (process.env.LOG_REQUESTS === "true") {
        console.log(`[RailCast] ${req.method} ${req.url} ${res.statusCode} ${Date.now() - startedAt}ms`);
      }
    });
});

// Only listen when run directly, so tests can require this module.
if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`\n🚂 RailCast backend listening on http://localhost:${PORT}`);
    console.log(`   schedule + geography : erail.in`);
    console.log(`   live running status  : rappid.in`);
    console.log(`   browse list          : ${BROWSE_TRAIN_IDS.length} trains, refreshed every ${BROWSE_REFRESH_SECONDS}s`);
    console.log(`   station coordinates  : ${listStations().length} stations\n`);

    // Warm the browse list so the first page load is instant.
    refreshBrowseSnapshot().then((trains) => {
      console.log(`[RailCast] Browse list warm: ${Array.isArray(trains) ? trains.length : 0} trains ready.`);
    });
    const timer = setInterval(refreshBrowseSnapshot, BROWSE_REFRESH_SECONDS * 1000);
    timer.unref?.();
  });

  const shutdown = (signal) => {
    console.log(`\n[RailCast] ${signal} received — closing server.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

module.exports = server;
