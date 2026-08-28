import { useState } from "react";
import { useMapEvents } from "react-leaflet";
import type { Station } from "@/types";
import { StationMarker } from "./StationMarker";

/** Below this zoom level, only the major-station subset is shown. */
const ZOOM_DETAIL_THRESHOLD = 7;
/** A dense zoomed-in viewport is still bounded, so panning over a cluster never tries to mount thousands of markers at once. */
const MAX_DETAIL_MARKERS = 400;

export interface ZoomAwareStationsProps {
  majorStations: Station[];
  allStations: Station[];
}

/**
 * Progressive station detail, the way any real map app behaves: zoomed out,
 * only the major junctions and terminals are worth showing (everything else
 * is noise at that scale); zoomed in past `ZOOM_DETAIL_THRESHOLD`, every
 * station actually inside the current viewport appears.
 *
 * `allStations` is fetched once (see hooks/useStations.ts's useAllStations)
 * and filtered here purely client-side against the map's live bounds — no
 * network round-trip per zoom or pan step, which is what makes this feel
 * instant rather than laggy.
 */
export function ZoomAwareStations({ majorStations, allStations }: ZoomAwareStationsProps) {
  // Leaflet manipulates the map's DOM outside React's render cycle, so
  // nothing here re-renders on pan/zoom unless something explicitly asks
  // React to — this counter is that ask. The array-destructure hole (no
  // name bound to the value half) is deliberate: nothing ever reads the
  // count itself, only the fact that it changed.
  const [, requestRerender] = useState(0);
  const map = useMapEvents({
    zoomend: () => requestRerender((tick) => tick + 1),
    moveend: () => requestRerender((tick) => tick + 1),
  });

  if (map.getZoom() < ZOOM_DETAIL_THRESHOLD || allStations.length === 0) {
    return (
      <>
        {majorStations.map((station) => (
          <StationMarker key={station.code} station={station} />
        ))}
      </>
    );
  }

  const bounds = map.getBounds();
  const visible = allStations
    .filter((station) => bounds.contains([station.position.lat, station.position.lng]))
    .slice(0, MAX_DETAIL_MARKERS);

  return (
    <>
      {visible.map((station) => (
        <StationMarker key={station.code} station={station} />
      ))}
    </>
  );
}
