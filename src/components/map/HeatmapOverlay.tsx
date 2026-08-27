import { Polyline } from "react-leaflet";
import type { RailwaySection, Station } from "@/types";
import { getSectionStatusHexColor } from "@/lib/status";

export interface HeatmapOverlayProps {
  stations: Station[];
  sections: RailwaySection[];
}

/**
 * Delay-intensity overlay aligned to the real corridor geometry — each
 * section is drawn as a thick, semi-transparent band colored and sized by
 * how much delay it's contributing (green/yellow/orange/red, matching the
 * existing RailCast status colors), rather than a disconnected heat blob.
 * A dedicated heatmap plugin isn't used here since the "heat" in this
 * dataset only ever varies along five known line segments, not across a
 * continuous 2D surface — a colored/weighted polyline communicates that
 * more precisely than a fuzzy radial gradient would.
 */
export function HeatmapOverlay({ stations, sections }: HeatmapOverlayProps) {
  const stationByCode = new Map(stations.map((station) => [station.code, station]));
  const maxDelay = Math.max(...sections.map((section) => section.delayContributionMinutes), 1);

  return (
    <>
      {sections.map((section) => {
        const start = stationByCode.get(section.startStationCode);
        const end = stationByCode.get(section.endStationCode);
        if (!start || !end) return null;
        const intensity = section.delayContributionMinutes / maxDelay;
        return (
          <Polyline
            key={section.id}
            positions={[
              [start.position.lat, start.position.lng],
              [end.position.lat, end.position.lng],
            ]}
            pathOptions={{
              color: getSectionStatusHexColor(section.congestionStatus),
              weight: 6 + intensity * 10,
              opacity: 0.35 + intensity * 0.45,
              lineCap: "round",
            }}
          />
        );
      })}
    </>
  );
}
