import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { useThemeEffect } from "@/lib/theme";
import { useNetworkAlertWatcher } from "@/hooks/useNetworkAlertWatcher";

/**
 * Every page is loaded lazily, one chunk per route, instead of one bundle
 * containing all ten pages up front. The heavy dependencies here — Leaflet
 * (map pages) and Recharts (chart-heavy pages) — only cost bytes on the
 * routes that actually use them; visiting the Dashboard first no longer
 * downloads Simulation Lab's mapping code before you've navigated there.
 */
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const LiveNetwork = lazy(() => import("@/pages/LiveNetwork"));
const TrainSearch = lazy(() => import("@/pages/TrainSearch"));
const TrainDetails = lazy(() => import("@/pages/TrainDetails"));
const RouteMonitor = lazy(() => import("@/pages/RouteMonitor"));
const DelayIntelligence = lazy(() => import("@/pages/DelayIntelligence"));
const Predictions = lazy(() => import("@/pages/Predictions"));
const SimulationLab = lazy(() => import("@/pages/SimulationLab"));
const Alerts = lazy(() => import("@/pages/Alerts"));
const Settings = lazy(() => import("@/pages/Settings"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function RouteFallback() {
  return (
    <PageContainer>
      <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
        <RefreshCw size={14} className="animate-spin" />
        Loading…
      </div>
    </PageContainer>
  );
}

/**
 * Route table for the whole app. Every route renders inside a single
 * AppShell (sidebar + header persist across navigation). Add new pages
 * here and to components/navigation/navConfig.ts together.
 */
export default function App() {
  useThemeEffect();
  useNetworkAlertWatcher();

  return (
    <AppShell>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/live-network" element={<LiveNetwork />} />
          <Route path="/train-search" element={<TrainSearch />} />
          <Route path="/trains/:id" element={<TrainDetails />} />
          <Route path="/route-monitor" element={<RouteMonitor />} />
          <Route path="/delay-intelligence" element={<DelayIntelligence />} />
          <Route path="/predictions" element={<Predictions />} />
          <Route path="/simulation-lab" element={<SimulationLab />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
