import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import type { Station } from "@/types";

const stationIcon = L.divIcon({
  className: "",
  html: '<div class="h-2.5 w-2.5 rounded-full border-2 border-outline bg-surface shadow-sm"></div>',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

export interface StationMarkerProps {
  station: Station;
  /** Extra detail line inside the popup, e.g. a scheduled/predicted time. */
  detail?: string;
}

/** A station on the real map — a small dot + name/detail popup, matching the schematic map's station dot styling. */
export function StationMarker({ station, detail }: StationMarkerProps) {
  return (
    <Marker position={[station.position.lat, station.position.lng]} icon={stationIcon}>
      <Popup>
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-on-background">{station.name}</span>
          <span className="text-on-surface-variant">{station.code}</span>
          {detail && <span className="text-on-surface-variant">{detail}</span>}
        </div>
      </Popup>
    </Marker>
  );
}
