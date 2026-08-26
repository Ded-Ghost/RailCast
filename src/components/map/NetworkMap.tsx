import { Fragment } from "react";
import { TrainFront } from "lucide-react";
import type { GeoPoint, Station, Train } from "@/types";
import { getStatusVisual } from "@/lib/status";
import { cn } from "@/lib/cn";

export interface NetworkMapProps {
  trains: Train[];
  stations?: Station[];
  selectedTrainId?: string | null;
  onSelectTrain?: (trainId: string) => void;
  showLegend?: boolean;
  className?: string;
}

/**
 * Bounding box the mock station/train coordinates fall inside (roughly
 * peninsular + northern India). Fixed rather than derived from whatever
 * subset of trains/stations is passed in, so the same train always renders
 * at the same spot whether shown on the Dashboard snapshot or the full
 * Live Network map.
 */
const BOUNDS = { minLat: 18.5, maxLat: 29.2, minLng: 72.0, maxLng: 88.5 };

function project(point: GeoPoint): { xPct: number; yPct: number } {
  const xPct =
    ((point.lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 100;
  const yPct =
    100 - ((point.lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100;
  return {
    xPct: Math.min(97, Math.max(3, xPct)),
    yPct: Math.min(95, Math.max(5, yPct)),
  };
}

/**
 * Schematic (not tile-based) railway network map. Renders station dots,
 * a faint origin→destination corridor line per train, and a colored
 * live-position marker per train. Deliberately avoids a real mapping
 * library — the visual language here is "operational schematic", matching
 * DESIGN.md, and it keeps the shell dependency-light.
 */
export function NetworkMap({
  trains,
  stations = [],
  selectedTrainId = null,
  onSelectTrain,
  showLegend = true,
  className,
}: NetworkMapProps) {
  const stationByCode = new Map(stations.map((station) => [station.code, station]));

  return (
    <div className={cn("relative overflow-hidden bg-[#eef1f5]", className)}>
      {/* Baseline grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Route corridor lines: origin -> destination per train */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        {trains.map((train) => {
          const origin = stationByCode.get(train.originCode);
          const destination = stationByCode.get(train.destinationCode);
          if (!origin || !destination) return null;
          const from = project(origin.position);
          const to = project(destination.position);
          const isSelected = train.id === selectedTrainId;
          return (
            <line
              key={train.id}
              x1={from.xPct}
              y1={from.yPct}
              x2={to.xPct}
              y2={to.yPct}
              stroke={isSelected ? "#0052cc" : "#9ba0b3"}
              strokeWidth={isSelected ? 0.5 : 0.3}
              strokeDasharray={isSelected ? undefined : "1.5,1.5"}
              opacity={isSelected ? 0.9 : 0.55}
            />
          );
        })}
      </svg>

      {/* Station dots + labels */}
      {stations.map((station) => {
        const { xPct, yPct } = project(station.position);
        return (
          <div
            key={station.code}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${xPct}%`, top: `${yPct}%` }}
          >
            <div className="h-2 w-2 rounded-full border-2 border-outline bg-surface shadow-sm" />
            <div className="mt-1 whitespace-nowrap rounded border border-outline-variant bg-surface/90 px-1.5 py-0.5 text-[10px] font-semibold text-on-surface-variant shadow-sm">
              {station.name}
            </div>
          </div>
        );
      })}

      {/* Live train markers */}
      {trains.map((train) => {
        const { xPct, yPct } = project(train.position);
        const visual = getStatusVisual(train.delayStatus);
        const isSelected = train.id === selectedTrainId;
        return (
          <Fragment key={train.id}>
            <button
              type="button"
              onClick={() => onSelectTrain?.(train.id)}
              aria-label={`Select train ${train.id} ${train.name}`}
              className={cn(
                "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white shadow-md transition-transform hover:scale-110",
                visual.dotClass,
                isSelected ? "h-7 w-7 ring-2 ring-primary ring-offset-2" : "h-5 w-5",
              )}
              style={{ left: `${xPct}%`, top: `${yPct}%` }}
            >
              <TrainFront size={isSelected ? 14 : 12} />
            </button>
            {isSelected && (
              <div
                className="absolute -translate-x-1/2 translate-y-2 whitespace-nowrap rounded border border-outline-variant bg-surface-container-lowest px-2 py-0.5 text-[10px] font-bold text-on-background shadow-popover"
                style={{ left: `${xPct}%`, top: `${yPct}%` }}
              >
                {train.id} · {train.shortName}
              </div>
            )}
          </Fragment>
        );
      })}

      {showLegend && (
        <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 rounded border border-outline-variant bg-surface/90 p-2 shadow-sm backdrop-blur-md">
          <LegendRow colorClass="bg-rail-green" label="On Time" />
          <LegendRow colorClass="bg-rail-amber" label="Minor Delay" />
          <LegendRow colorClass="bg-rail-orange" label="Significant" />
          <LegendRow colorClass="bg-error" label="Severe" />
        </div>
      )}
    </div>
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
