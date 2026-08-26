import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Share2,
  Search,
  BarChart3,
  TriangleAlert,
  Activity,
  FlaskConical,
  BellRing,
  Settings,
} from "lucide-react";

export interface NavEntry {
  label: string;
  path: string;
  icon: LucideIcon;
}

/**
 * Single source of truth for primary navigation. Sidebar and any future
 * breadcrumbs/command-palette should read from here rather than
 * duplicating route/label/icon triples.
 */
export const primaryNavEntries: NavEntry[] = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Live Network", path: "/live-network", icon: Share2 },
  { label: "Train Search", path: "/train-search", icon: Search },
  { label: "Route Monitor", path: "/route-monitor", icon: BarChart3 },
  { label: "Delay Intelligence", path: "/delay-intelligence", icon: TriangleAlert },
  { label: "Predictions", path: "/predictions", icon: Activity },
  { label: "Simulation Lab", path: "/simulation-lab", icon: FlaskConical },
  { label: "Alerts", path: "/alerts", icon: BellRing },
];

export const secondaryNavEntries: NavEntry[] = [
  { label: "Settings", path: "/settings", icon: Settings },
];
