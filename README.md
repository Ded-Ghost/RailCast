# RailCast

**Smart India Hackathon (SIH) — Dynamic ETA Forecasting & Delay Intelligence**

RailCast is a full-stack Indian Railways operations dashboard: live train tracking, delay
intelligence, ETA prediction, a moving network map, and a what-if simulation lab.

It runs on real data. Every train name, route, station coordinate, scheduled time, delay and
ETA in the running application is fetched from a live source or computed from one. There is
no canned train anywhere in the app, and no API key is required to run it.

---

## Where the data comes from

RailCast joins two keyless public feeds, because neither is sufficient alone.

| Source | Provides | Cache |
|---|---|---|
| **erail.in** | Published timetable: station **codes**, scheduled arrival/departure, halts, cumulative distance, day offsets, platforms, zones, and a real **lat/lng for every stop** | 24 h |
| **rappid.in** | Today's running status: per-stop delay, actual times, current-station marker | 3 min |

The running-status feed publishes station *names* with no codes, no coordinates and no
distances, so it cannot be drawn on a map. The timetable knows nothing about today. Joining
them is what produces a train that has both a real delay and a real position.

The join key is **cumulative distance from origin**, not the station name: both feeds agree on
it to the kilometre, whereas their names diverge freely (`Dd Upadhyaya Jn` vs
`Pt Deen Dayal Upadhyaya Jn`). Name matching is only the fallback.

### Why not NTES?

The official National Train Enquiry System (`enquiry.indianrail.gov.in`) is **not** used. As of
this writing it serves an outage notice —

> *"Due to some technical activity this site will be un-available for some time. Meanwhile
> passenger can use services of 139 for latest train running updates."*

— on **every** path, including the REST endpoints, so there is nothing there to parse. It also
responds with bare-LF headers that Node's HTTP parser rejects outright (`HPE_CR_EXPECTED`)
unless `insecureHTTPParser` is set, which is how you can confirm the above rather than a
network fault. If NTES returns to service it belongs behind the same interface as
`erailClient.js`; nothing else would need to change.

---

## Architecture

```
┌──────────────────────────────────────┐      ┌────────────────────────────────┐
│         Frontend (Vite / React)      │      │   Backend (Node.js, 0 deps)    │
│                                      │      │                                │
│  Pages → Hooks → Services            │      │  /api/trains                   │
│  trainService  ─────────────────────────────►  /api/trains/:id/status  ───────► erail.in
│  networkService                      │      │  /api/trains/:id/route   ───────► rappid.in
│                                      │      │  /api/trains/:id/schedule      │
│  Simulation engine — any train       │      │  /api/stations                 │
│  Zustand stores                      │      │  /api/health                   │
└──────────────────────────────────────┘      └────────────────────────────────┘
            localhost:5173                              localhost:3001
         (Vite proxy → 3001 in dev)
```

### How a train gets on the map

```
GET /api/trains/12301/status
  ├─ erailClient.fetchTrainSchedule("12301")
  │    ├─ getTrains.aspx?TrainNo=12301          → identity + erail's internal train id
  │    └─ data.aspx?Action=TRAINROUTE&Data1=…   → 9 stops, each with real lat/lng
  │       (the two-step lookup is mandatory: TRAINROUTE keys off the internal id,
  │        and passing the public train number returns a different train's route)
  │
  ├─ trainScraper.fetchTrainStatus("12301")     → per-stop delays and actual times
  │
  └─ trainComposer.composeTrain(...)
       ├─ merge stops by cumulative distance
       ├─ resolve today's delay from the last stop BEHIND the train
       │  (the feed's trailing rows are forward projections, not observations —
       │   reading the last row reports a train punctual while it is an hour down)
       ├─ locate the run: elapsed-since-departure − delay = schedule position
       └─ interpolate lat/lng between the bracketing stops
```

### Motion

The backend places the train correctly, but the live feed only refreshes every few minutes.
So the client extrapolates between refreshes:

- **every 5 s** — `trainSimulationEngine` advances the train along its real route, using the
  booked time and distance for that specific leg and an accelerate → cruise → brake profile
  bounded by the service class's top speed
- **every 30 s** — the store re-fetches the real status and rebases the engine on it, so
  extrapolation is discarded rather than compounded

While extrapolating, a train's `dataSource` reads `"simulation"` and the UI badge says so. The
"last updated" counter measures time since the last **backend sync**, never since the last
tick, so it never implies data is fresher than it is.

---

## Quick Start

```bash
cd railcast
npm install          # frontend only

node server/src/index.js    # terminal 1 — backend on :3001 (no npm install needed)
npm run dev                 # terminal 2 — frontend on :5173
```

No `.env` is needed; every value has a working default. Copy `.env.example` to `.env` only if
you want to change ports, the browse list, or CORS.

Verify the backend independently:

```bash
curl http://localhost:3001/api/trains/12301/status
curl http://localhost:3001/api/health
```

---

## API Reference

All responses use the envelope `{ success, data, meta }`; errors use
`{ success: false, error: { code, message } }`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service info, cache stats for both sources, browse-list age |
| `GET` | `/api/trains` | Browse list, live-enriched, served from a warm snapshot |
| `GET` | `/api/trains/search?q=` | Search by number or name; **any** valid number is looked up live |
| `GET` | `/api/trains/:id` | Composed train (same object as `/status`) |
| `GET` | `/api/trains/:id/status` | Live status: position, delay, speed, ETA, confidence |
| `GET` | `/api/trains/:id/route` | Stop list with coordinates, progress status, actual times |
| `GET` | `/api/trains/:id/schedule` | Full published timetable |
| `GET` | `/api/stations` | Station master data (`?all=1` for all, `?q=` to search) |
| `GET` | `/api/stations/:code` | One station |

### Live extensions on the `Train` object

All optional — nothing in the UI may assume they are present.

- `dataSource` — `"live"` \| `"live-cached"` \| `"schedule"` \| `"simulation"` \| `"unavailable"`
- `liveStatusText` — human sentence, e.g. *"Departed Dhaulpur, approaching Morena — running 10 min late."*
- `journeyPhase` — `"running"` \| `"not-started"` \| `"completed"` \| `"unknown"`
- `currentStopIndex`, `legProgress`, `distanceCoveredKm`, `totalDistanceKm`
- `runsOnDays`, `durationLabel`, `scheduledDeparture`, `feedUpdatedLabel`

---

## Station coordinates

`server/src/data/stationCoords.js` and `src/data/stations.ts` hold **1,091 stations** with real
coordinates. They are generated, not hand-written: the harvester walks the published
timetables of 79 long-distance trains spanning the Delhi–Howrah (both the Grand Chord and the
Patna routes), Delhi–Mumbai (Western and Central), Delhi–Chennai, Mumbai–Chennai,
Howrah–Chennai, Delhi–Ahmedabad, Bangalore–Chennai, Konkan, Punjab/Katra and North-East
corridors, and records the position the railway itself publishes for each stop.

```bash
node server/scripts/harvestStationCoords.js   # regenerates both files
```

This table is a **fallback**, not the primary source. A live route lookup carries its own
per-stop coordinates, which is what lets the simulation position a train on a route containing
stations that were never in the table.

---

## Frontend Architecture

### Services — the API boundary

| Service method | Endpoint |
|---|---|
| `trainService.listTrains()` | `GET /api/trains` |
| `trainService.getLiveStatus(id)` | `GET /api/trains/:id/status` |
| `trainService.getRouteProgress(id)` | `GET /api/trains/:id/route` |
| `trainService.getSchedule(id)` | `GET /api/trains/:id/schedule` |
| `trainService.searchTrains(q)` | `GET /api/trains/search?q=` |
| `networkService.getStations()` | `GET /api/stations` |

There is deliberately **no mock fallback** for train data. An earlier version fell back to a
canned train whenever the backend was unreachable, which meant a dead backend looked identical
to a healthy one. Failures now surface as `null`/`[]` so the pages can say *"live data
unavailable"* honestly.

Network-level demo figures that have no live counterpart (delay-cause breakdown, prediction
accuracy metrics, the network trend chart) remain static and are labelled as such in the UI.

### State management

- `useNetworkStore` — the shared train list and alert feed
- `useSimulationStore` — tracks **whichever** train the user opened; 5 s ticks, 30 s resync
- `useSimulationLabStore` — what-if scenarios against **any** entered train number
- `useUIStore` — sidebar and selection state

### Polling

`useTrains` fetches immediately on mount, then every 30 s, and **skips a tick while a request
is still in flight** — otherwise a slow backend stacks requests until each poll races its
predecessors and the stalest response wins. Refreshes keep the previous data on screen
(`isRefreshing`) instead of flashing skeletons.

---

## Simulation Lab

Enter any real train number. The lab loads that train's live status and published route, then
projects forward under scenario controls (target speed, congestion, weather, dwell), and
reports the result **against the train's actual current delay** — so you can see whether a
scenario beats or loses to what is really happening today.

Congestion and weather act as speed *caps*, not discounts: raising the target speed does
nothing once a cap binds, the same as a real speed restriction. Going faster than booked can
recover at most 15% of a leg's running time, because booked times already reflect line speed,
gradients and permanent restrictions — the only genuine slack in them is the planner's
recovery margin. Slowing down has no such bound. That asymmetry is the real one.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `BACKEND_PORT` | `3001` | Backend port |
| `BACKEND_HOST` | `0.0.0.0` | Bind interface |
| `VITE_API_BASE_URL` | *(empty)* | Backend origin in production; empty = use the Vite proxy |
| `BROWSE_TRAIN_IDS` | 15 numbers | Train **numbers** on the search page before typing |
| `BROWSE_REFRESH_SECONDS` | `60` | Background refresh cadence for the browse list |
| `ALLOWED_ORIGINS` | `*` | Comma-separated CORS origins |
| `LOG_REQUESTS` | `false` | Log every request with status and duration |
| `VITE_GOOGLE_MAPS_API_KEY` | *(empty)* | Optional; Leaflet + OSM/Esri tiles used by default |

---

## Production Deployment

**Option A — one origin (recommended):**
```
nginx:  /api/*  → localhost:3001
        /       → static Vite build (dist/)
```

**Option B — split:**
```
frontend:  VITE_API_BASE_URL=https://api.your-backend.com
backend:   ALLOWED_ORIGINS=https://your-frontend.com
```

```bash
npm run build   # → dist/
```

---

## Feature Status

| Feature | Data source |
|---|---|
| Dashboard KPIs | Live — computed from the browse list (currently 34 real trains; configurable via `BROWSE_TRAIN_IDS`) |
| Live Network Map | Live — real Leaflet/OSM map, zoom-aware station density, trains colored by real delay status, train-icon markers |
| Train Search | Live — any valid train number resolves |
| Train Details | Live — real station, delay, stop list, platforms, actual times; multi-factor ETA projection; sets the app-wide "selected train" |
| Route Intelligence | Live — full vertical stop timeline, every station, no thinning |
| Route Monitor | Live — real per-leg speed/congestion for whichever train is loaded; automatically follows the app-wide selected train |
| Delay Heatmap | Live — one circle per currently-tracked train, real position, sized/colored by real delay, with a legend |
| Simulation Lab | Live route + deterministic what-if model; known-bottleneck markers plotted on the map; automatically follows the app-wide selected train |
| Alerts | Live — a network-wide watcher (`hooks/useNetworkAlertWatcher.ts`) polls every browse-list train and diffs it against its own previous state, so alerts accumulate app-wide, not just for whichever train Train Details happens to be simulating |
| Delay Intelligence (summary/trend/causes/busiest points) | Live — every figure is computed from the currently-tracked trains, not seeded. The trend line accumulates real samples starting from when the app opened (no invented full-day curve); "causes" are checkable real buckets (on time / at a known congestion point / stale reading / unspecified), never an invented weather/technical split |
| ETA Predictions (network-wide "What Influences ETA") | Static demo figures, clearly labeled as such on the page; the per-train "Why This ETA?" is live (see below) |
| Settings | Fully functional — theme (light/dark/system, real CSS-variable palette), live refresh interval (drives every poll in the app), speed units and time format (applied across Train Details/Search/Predictions/Route Monitor), alert toggles, and a live backend status panel |

---

## Known Limitations

1. **Position is derived, not GPS.** Indian Railways does not publish public real-time GPS for
   passenger trains. Position is computed by interpolating along the straight line between two
   real stops using the timetable and the live delay — accurate in sequence and timing, but it
   follows chords rather than actual track curvature.

2. **ETA history has no backfill.** Both feeds publish a snapshot, not a time series, so the
   "ETA Evolution" chart fills in as the page observes successive resyncs rather than opening
   with history.

3. **Upstream availability.** If a feed is unreachable the backend degrades in stages —
   timetable-only (`dataSource: "schedule"`) with a visible warning banner, then
   `"unavailable"`. Schedules are additionally served stale rather than dropped, since a
   timetable barely moves.

4. **The live feed itself can be stale.** rappid.in does not always have a fresh reading for
   every train — for one it hasn't rescraped recently, it keeps serving its last snapshot, which
   can be hours old and often shows every stop as a flat "On Time". `trainComposer.js` checks the
   feed's own "Updated X ago" timestamp (`STALE_FEED_THRESHOLD_MINUTES`, 20 min): past that,
   `dataSource` drops to `"live-cached"`, `liveFeedStale` is set, and the status sentence and
   Train Details banner say explicitly how old the reading is, rather than presenting a possibly
   hour-old snapshot with full "LIVE" confidence. A flat "on time" reading is honest only when
   this flag is absent.

5. **The enhanced ETA is a better-reasoned heuristic, not a validated model — and it does not
   claim a specific accuracy figure.** `predictionEngine.ts` layers three real signals onto the
   live feed's raw current delay: momentum (the trend across the last few stops the train has
   actually passed), live weather at its current station (Open-Meteo), and known structural
   bottlenecks still ahead on its real route (`operationalRiskFactors.ts`). What it deliberately
   does not do is claim an accuracy percentage — that requires backtesting predictions against
   real recorded outcomes, and nothing in this pipeline persists a history to backtest against.
   Any specific accuracy number quoted for this app would be invented, not measured.

6. **Zero backend dependencies.** `server/` uses only Node.js built-ins — no `node_modules`,
   no install step.

7. **No news or rail-comms feed.** Delay prediction and Delay Intelligence use live weather
   (Open-Meteo) and curated structural bottleneck knowledge (`operationalRiskFactors.ts`) — there
   is no public, keyless news or railway-communications API to integrate, so nothing here
   attempts to. "Fresh Live Readings" on Delay Intelligence can legitimately read low (rappid.in's
   own cache is only refreshed on its own schedule, sometimes hours between rescrapes for a given
   train) — that is the honest state of the upstream source, not a bug; every tracked train still
   contributes its last-known reading to every other figure on the page.
