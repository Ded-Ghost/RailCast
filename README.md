# RailCast — Frontend

Dynamic ETA forecasting & delay intelligence for coaching trains. This is
the **application shell** phase: navigation frame, design tokens, shared
components, typed mock data, and a fully wired Dashboard. Every other page
is routed and functional-navigation-ready, with a scaffolded placeholder
body pending its own implementation phase.

The Stitch-generated `DESIGN.md` in this folder (design system: **Kinetic
Logic**) is the visual source of truth. `tailwind.config.ts` mirrors its
color, typography, spacing, and shape tokens exactly — no values were
invented, with one exception noted below.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (default `http://localhost:5173`).

```bash
npm run build    # type-check + production build
npm run lint      # eslint
```

## Architecture

```
src/
  components/
    layout/        AppShell, Sidebar, TopHeader, PageContainer, PageHeader,
                    PlaceholderPage — the navigation frame every page renders inside.
    navigation/     NavItem + navConfig (single source of truth for sidebar routes).
    common/         Button, Card, StatusBadge, LiveIndicator, MetricCard,
                    Skeleton/EmptyState/ErrorState — the shared design-system primitives.
    train/          TrainStatusRow — reusable train-summary row (dashboard, search, etc).
    map/            Reserved for map-rendering components (next phase).
    analytics/      Reserved for chart components (Recharts) — Delay Intelligence, Predictions.
    alerts/         Reserved for alert-specific presentational components.
    simulation/     Reserved for Simulation Lab controls.
  pages/            One folder per route. Dashboard is fully implemented;
                    the rest are routed placeholders (see below).
  data/             Typed mock data (trains, stations, routes, alerts,
                    predictions, network stats). Never imported directly by pages.
  services/         Async data-access layer (trainService, alertService,
                    networkService). Pages/hooks only ever talk to services —
                    swapping mock data for a real API/WebSocket means editing
                    files in this folder only.
  store/            Zustand stores — useNetworkStore (trains/alerts/live state),
                    useUIStore (sidebar/mobile-nav state only, never data).
  hooks/            useTrains / usePriorityTrains / useTrain / useAlerts —
                    the seam between services and components; own loading/error state.
  types/            Train, Station, RouteSection/TrainRoute, Prediction,
                    AlertItem, SimulationState, plus shared primitives.
  lib/              cn() class helper, status.ts (single source of truth for
                    delay-status → color mapping), format.ts (delay/time/number formatting).
```

### Data flow (mock today → API tomorrow)

```
data/*.ts  →  services/*.ts (async, simulated latency)  →  hooks/*.ts (loading/error)  →  pages
                                                              ↕
                                                       store/useNetworkStore
```

Nothing above the `services/` layer knows or cares that the data is mocked.
Replacing `services/trainService.ts`'s internals with real `fetch`/WebSocket
calls requires no changes to hooks, store, or any component.

## Pages implemented in this phase

| Route | Status |
|---|---|
| `/` (Dashboard) | **Fully implemented** — KPI row, live network snapshot (static map placeholder), priority trains, system alerts. Real mock data, loading skeletons, empty states. |
| `/train-search` | **Functional** — search by train number/name via `trainService.searchTrains`, results link to Train Details. |
| `/alerts` | **Functional** — lists alerts from the store, mark-as-read wired up. |
| `/trains/:id` | Placeholder (id-aware) |
| `/live-network`, `/route-monitor`, `/delay-intelligence`, `/predictions`, `/simulation-lab`, `/settings` | Placeholders — routed, navigable, consistent shell styling, no lorem-ipsum walls. |

Placeholders use the shared `PlaceholderPage` component so every unbuilt
page looks intentional rather than broken.

## Primary demo train

`data/trains.ts` seeds train **12345 Rajdhani Express** with the exact
figures from the brief (Bhubaneswar → New Delhi, currently at Cuttack,
78 km/h, scheduled 14:30 / predicted 14:41, +11 min, 87% confidence,
14:37–14:45 range) plus five supporting trains referenced across the
Stitch screens (98765 Shatabdi, 54321 Duronto, 11223 Express Mail, 89012
Garib Rath, 45678 Khurda Road Passenger) so every list/table has enough
variety to look real.

## Design-token note

DESIGN.md's status system names four tiers (On Time/Green, Minor/Amber,
Significant/Orange, Severe/Red) but the Stitch-exported Tailwind config
only defines `rail-green`, `rail-amber`, and the Material `error` red — no
orange token. I added `rail-orange` (`#c2540a`) to `tailwind.config.ts` to
complete the four-tier system the brief calls for. Flag if you'd like a
different hex.

## Conventions for extending this

- **New page:** add a folder under `pages/`, register the route in
  `App.tsx`, and add its nav entry to `components/navigation/navConfig.ts`.
- **New shared UI:** goes in `components/common/` (or a more specific
  folder if it's domain-specific like `train/`), exported from that
  folder's `index.ts`.
- **New data:** add types to `types/`, mock data to `data/`, an async
  method to the relevant `services/*.ts`, and (if a component needs
  loading/error state) a hook in `hooks/`. Pages should never import from
  `data/` directly.
- **Status colors:** always go through `lib/status.ts`
  (`getStatusVisual`, `delayMinutesToStatus`, `getAlertSeverityVisual`) —
  never hardcode a status color in a component.
