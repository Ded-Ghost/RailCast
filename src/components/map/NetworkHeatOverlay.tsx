import { Circle } from "react-leaflet";
import type { Train } from "@/types";
import { getStatusHexColor } from "@/lib/status";

export interface NetworkHeatOverlayProps {
  trains: Train[];
}

const BASE_RADIUS_METERS = 25_000;
const RADIUS_PER_DELAY_MINUTE = 800;
const MAX_RADIUS_METERS = 90_000;

/**
 * A real heat visualization for the whole network: one semi-transparent
 * circle per currently-tracked train, centered on its actual live position,
 * colored and sized by its actual delay severity. Circles overlapping near a
 * busy junction read as a hotter area on their own — a genuine density
 * effect from real, currently-live positions, not a synthetic gradient drawn
 * over one hardcoded route.
 *
 * Scoped to whichever trains RailCast currently has live data for (the
 * browse list from /api/trains, refreshed every 30s) — the same honest scope
 * Dashboard's "Known Trains" KPI already uses. This is not every train in
 * India; it is every train the app is currently watching.
 */
export function NetworkHeatOverlay({ trains }: NetworkHeatOverlayProps) {
  return (
    <>
      {trains.map((train) => {
        const radius = Math.min(
          MAX_RADIUS_METERS,
          BASE_RADIUS_METERS + Math.max(0, train.delayMinutes) * RADIUS_PER_DELAY_MINUTE,
        );
        const color = getStatusHexColor(train.delayStatus);
        return (
          <Circle
            key={train.id}
            center={[train.position.lat, train.position.lng]}
            radius={radius}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.28, opacity: 0.4, weight: 1 }}
          />
        );
      })}
    </>
  );
}
