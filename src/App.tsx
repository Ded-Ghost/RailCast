import { Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import Dashboard from "@/pages/Dashboard";
import LiveNetwork from "@/pages/LiveNetwork";
import TrainSearch from "@/pages/TrainSearch";
import TrainDetails from "@/pages/TrainDetails";
import RouteMonitor from "@/pages/RouteMonitor";
import DelayIntelligence from "@/pages/DelayIntelligence";
import Predictions from "@/pages/Predictions";
import SimulationLab from "@/pages/SimulationLab";
import Alerts from "@/pages/Alerts";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";

/**
 * Route table for the whole app. Every route renders inside a single
 * AppShell (sidebar + header persist across navigation). Add new pages
 * here and to components/navigation/navConfig.ts together.
 */
export default function App() {
  return (
    <AppShell>
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
    </AppShell>
  );
}
