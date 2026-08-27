import { useMemo } from "react";
import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { Link } from "react-router-dom";
import type { Train } from "@/types";
import { getStatusVisual } from "@/lib/status";
import { formatDelay } from "@/lib/format";

export interface TrainMarkerProps {
  train: Train;
  selected?: boolean;
  /** Adds the same pulsing ring used on Train Details' LIVE badge — reserve for a train that's actually simulating live. */
  pulse?: boolean;
  onSelect?: (trainId: string) => void;
}

/** A live train position on the real map — colored by delay status, matching the schematic NetworkMap's marker language exactly. */
export function TrainMarker({ train, selected = false, pulse = false, onSelect }: TrainMarkerProps) {
  const visual = getStatusVisual(train.delayStatus);
  const size = selected ? 22 : 16;

  const icon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html: `<div class="${pulse ? "live-pulse " : ""}flex items-center justify-center rounded-full text-white shadow-md ${visual.dotClass}" style="width:${size}px;height:${size}px;${selected ? "outline:2px solid #0052cc;outline-offset:2px;" : ""}"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      }),
    [visual.dotClass, size, selected, pulse],
  );

  return (
    <Marker
      position={[train.position.lat, train.position.lng]}
      icon={icon}
      eventHandlers={onSelect ? { click: () => onSelect(train.id) } : undefined}
    >
      <Popup>
        <div className="flex min-w-[180px] flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-on-background">
              {train.id} {train.shortName}
            </span>
          </div>
          <div className="flex items-center justify-between text-on-surface-variant">
            <span>Speed</span>
            <span className="font-medium text-on-background">{train.currentSpeedKmh} km/h</span>
          </div>
          <div className="flex items-center justify-between text-on-surface-variant">
            <span>Delay</span>
            <span className={`font-medium ${visual.textClass}`}>{formatDelay(train.delayMinutes)}</span>
          </div>
          <div className="flex items-center justify-between text-on-surface-variant">
            <span>Next Station ETA</span>
            <span className="font-medium text-on-background">{train.predictedEta}</span>
          </div>
          <Link
            to={`/trains/${train.id}`}
            className="mt-1 rounded bg-primary px-2 py-1 text-center text-white no-underline"
          >
            View Train Details
          </Link>
        </div>
      </Popup>
    </Marker>
  );
}
