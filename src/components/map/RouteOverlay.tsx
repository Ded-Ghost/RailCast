import { Polyline } from "react-leaflet";
import type { RailwaySection, Station } from "@/types";
import { getSectionStatusHexColor } from "@/lib/status";

export interface RouteOverlayProps {
  /** Ordered stations along the route. */
  stations: Station[];
  /** Optional per-segment health — colors each leg individually. Matched to consecutive station pairs by code. */
  sections?: RailwaySection[];
  /** Uniform color when `sections` isn't provided. */
  color?: string;
  weight?: number;
}

/**
 * The route line connecting a series of real station coordinates. This is
 * a straight-line polyline between stations, not actual track curvature —
 * no railway centerline dataset is available, so this is the honest
 * approximation: real endpoints, straight legs between them.
 */
export function RouteOverlay({ stations, sections, color = "#0052cc", weight = 4 }: RouteOverlayProps) {
  if (stations.length < 2) return null;

  if (!sections) {
    return (
      <Polyline
        positions={stations.map((station) => [station.position.lat, station.position.lng])}
        pathOptions={{ color, weight }}
      />
    );
  }

  const sectionByPair = new Map(sections.map((section) => [`${section.startStationCode}-${section.endStationCode}`, section]));

  return (
    <>
      {stations.slice(0, -1).map((station, index) => {
        const next = stations[index + 1];
        const section = sectionByPair.get(`${station.code}-${next.code}`);
        const segmentColor = section ? getSectionStatusHexColor(section.congestionStatus) : color;
        return (
          <Polyline
            key={`${station.code}-${next.code}`}
            positions={[
              [station.position.lat, station.position.lng],
              [next.position.lat, next.position.lng],
            ]}
            pathOptions={{ color: segmentColor, weight }}
          />
        );
      })}
    </>
  );
}
