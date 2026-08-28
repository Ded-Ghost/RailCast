import { useMemo } from "react";
import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import type { OperationalRiskFactor } from "@/data/operationalRiskFactors";

export interface RiskPointMarkerProps {
  factor: OperationalRiskFactor;
  position: { lat: number; lng: number };
}

/**
 * A small warning marker for a known, real operational bottleneck this
 * train's route passes through — see data/operationalRiskFactors.ts for what
 * that means and what it deliberately is not (no fabricated per-train
 * statistics). Shared between Route Monitor and Simulation Lab so "a place
 * this train could lose time" always looks the same wherever it's shown.
 */
export function RiskPointMarker({ factor, position }: RiskPointMarkerProps) {
  const icon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html:
          '<div style="width:22px;height:22px;display:flex;align-items:center;justify-content:center;' +
          'border-radius:9999px;background:#f59e0b;color:white;box-shadow:0 1px 4px rgba(0,0,0,0.35);' +
          'font-size:13px;font-weight:800;border:2px solid white;">!</div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
    [],
  );

  return (
    <Marker position={[position.lat, position.lng]} icon={icon}>
      <Popup>
        <div className="flex min-w-[200px] flex-col gap-1.5">
          <span className="font-semibold text-on-background">{factor.title}</span>
          <span className="text-on-surface-variant">{factor.description}</span>
          <span className="font-medium text-rail-amber">
            Typically +{factor.typicalHoldMinutesMin}–{factor.typicalHoldMinutesMax} min
          </span>
        </div>
      </Popup>
    </Marker>
  );
}
