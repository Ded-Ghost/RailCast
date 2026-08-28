import { useMemo } from "react";
import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { Link } from "react-router-dom";
import type { Train } from "@/types";
import { getStatusHexColor, getStatusVisual } from "@/lib/status";
import { formatDelay } from "@/lib/format";
import { useSettingsStore } from "@/store/useSettingsStore";

export interface TrainMarkerProps {
  train: Train;
  selected?: boolean;
  /** Adds the same pulsing ring used on Train Details' LIVE badge — reserve for a train that's actually simulating live. */
  pulse?: boolean;
  onSelect?: (trainId: string) => void;
  /**
   * Compass bearing (0-360, clockwise from north) the train is heading —
   * when given, the marker renders as an arrow pointing that way instead of
   * a plain dot. Optional and off by default: most callers don't have a
   * meaningful direction to hand it (a train sitting exactly on a station
   * has none), so this only activates where a caller has actually computed
   * one (Simulation Lab, mid-leg).
   */
  headingDegrees?: number;
}

/** A live train position on the real map — colored by delay status, matching the app-wide status color system exactly. */
export function TrainMarker({ train, selected = false, pulse = false, onSelect, headingDegrees }: TrainMarkerProps) {
  const visual = getStatusVisual(train.delayStatus);
  const size = selected ? 22 : 16;
  const showTrainGlyph = useSettingsStore((s) => s.mapVisualization) === "standard";

  const icon = useMemo(() => {
    if (headingDegrees !== undefined) {
      const arrowSize = selected ? 26 : 20;
      const hex = getStatusHexColor(train.delayStatus);
      const html = `
        <div style="width:${arrowSize}px;height:${arrowSize}px;position:relative;">
          ${pulse ? `<div class="live-pulse" style="position:absolute;inset:0;border-radius:9999px;background:${hex};opacity:0.5;"></div>` : ""}
          <div style="width:100%;height:100%;transform:rotate(${headingDegrees}deg);transform-origin:center;position:relative;">
            <svg viewBox="0 0 24 24" width="100%" height="100%">
              <path d="M12 1.5 L21 21 L12 16.5 L3 21 Z" fill="${hex}" stroke="white" stroke-width="1.5" stroke-linejoin="round" />
            </svg>
          </div>
        </div>`;
      return L.divIcon({ className: "", html, iconSize: [arrowSize, arrowSize], iconAnchor: [arrowSize / 2, arrowSize / 2] });
    }

    const trainGlyph = showTrainGlyph
      ? `<svg viewBox="0 0 24 24" width="70%" height="70%" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="6" y="3" width="12" height="13" rx="4"/>
          <path d="M6 11h12"/>
          <circle cx="9" cy="18.5" r="1.3" fill="white" stroke="none"/>
          <circle cx="15" cy="18.5" r="1.3" fill="white" stroke="none"/>
          <path d="M8 16l-2 3M16 16l2 3"/>
        </svg>`
      : "";
    return L.divIcon({
      className: "",
      html: `<div class="${pulse ? "live-pulse " : ""}flex items-center justify-center rounded-full text-white shadow-md ${visual.dotClass}" style="width:${size}px;height:${size}px;${selected ? "outline:2px solid #0052cc;outline-offset:2px;" : ""}">${trainGlyph}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }, [visual.dotClass, train.delayStatus, size, selected, pulse, headingDegrees, showTrainGlyph]);

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
