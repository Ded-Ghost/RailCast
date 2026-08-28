import { useMemo } from "react";
import type { Station, Train } from "@/types";
import { computeBoundsView } from "@/lib/geo";
import { cn } from "@/lib/cn";
import { MapContainer } from "./MapContainer";
import { ZoomAwareStations } from "./ZoomAwareStations";
import { TrainMarker } from "./TrainMarker";

export interface RealNetworkMapProps {
  trains: Train[];
  majorStations: Station[];
  allStations: Station[];
  selectedTrainId?: string | null;
  onSelectTrain?: (trainId: string) => void;
  showLegend?: boolean;
  className?: string;
}

/**
 * The real, zoomable, OpenStreetMap-based network view.
 *
 * Replaces the old schematic map, which projected every station onto fixed
 * percentage coordinates inside a plain div and drew a permanently-visible
 * name label next to each one — workable with a dozen mock stations, an
 * unreadable pile of overlapping boxes once the station database grew to
 * over a thousand real ones. This is a real map instead: it pans and zooms
 * like any map app, station density is progressive (see ZoomAwareStations),
 * and train markers are the same `<TrainMarker>` used everywhere else in the
 * app, so "colored precisely by delay status" is the one implementation
 * every page already shares — nothing bespoke to this view.
 *
 * The view is framed ONCE, over the major stations, and never recentered
 * after that (unlike Simulation Lab or Route Monitor, which reframe when a
 * different train/route loads) — a live map whose trains move should not
 * fight a user who is trying to pan around it.
 */
export function RealNetworkMap({
  trains,
  majorStations,
  allStations,
  selectedTrainId = null,
  onSelectTrain,
  showLegend = true,
  className,
}: RealNetworkMapProps) {
  const initialView = useMemo(
    () => computeBoundsView(majorStations.map((station) => station.position), { padding: 1.15, minZoom: 4, maxZoom: 6 }),
    [majorStations],
  );

  return (
    <MapContainer center={initialView.center} zoom={initialView.zoom} className={className}>
      <ZoomAwareStations majorStations={majorStations} allStations={allStations} />

      {trains.map((train) => (
        <TrainMarker
          key={train.id}
          train={train}
          selected={train.id === selectedTrainId}
          pulse={train.id === selectedTrainId}
          onSelect={onSelectTrain}
        />
      ))}

      {showLegend && (
        <div
          className={cn(
            "pointer-events-none absolute bottom-3 left-3 z-[1000] flex flex-col gap-1.5",
            "rounded border border-outline-variant bg-surface/90 p-2 shadow-sm backdrop-blur-md",
          )}
        >
          <LegendRow colorClass="bg-rail-green" label="On Time" />
          <LegendRow colorClass="bg-rail-amber" label="Minor Delay" />
          <LegendRow colorClass="bg-rail-orange" label="Significant" />
          <LegendRow colorClass="bg-error" label="Severe" />
        </div>
      )}
    </MapContainer>
  );
}

function LegendRow({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-medium text-on-surface-variant">
      <div className={cn("h-2.5 w-2.5 rounded-full", colorClass)} />
      {label}
    </div>
  );
}
