import { TrainFront } from "lucide-react";
import type { RouteStopProgress } from "@/types";
import { cn } from "@/lib/cn";
import { formatDelay } from "@/lib/format";

export interface RouteIntelligenceStop extends RouteStopProgress {
  stationName: string;
}

export interface RouteIntelligenceProps {
  stops: RouteIntelligenceStop[];
  className?: string;
}

const STOP_DOT_CLASS: Record<RouteStopProgress["status"], string> = {
  passed: "bg-on-surface-variant border-2 border-on-surface-variant",
  current: "bg-rail-blue border-2 border-rail-blue",
  upcoming: "bg-surface-container-lowest border-2 border-outline-variant",
};

/**
 * Proportional (distance-weighted, not evenly-spaced) line diagram of a
 * train's route: passed / current / upcoming stops, the live train marker,
 * and each stop's schedule vs. predicted time. This is the "route
 * intelligence visualization" for Train Details — a schematic line, not a
 * geographic map, since the point here is sequence + timing, not geography.
 */
export function RouteIntelligence({ stops, className }: RouteIntelligenceProps) {
  if (stops.length === 0) return null;

  const totalDistance = stops[stops.length - 1].distanceFromOriginKm || 1;
  const currentStop = stops.find((stop) => stop.status === "current") ?? stops[0];
  const trainLeftPct = (currentStop.distanceFromOriginKm / totalDistance) * 100;

  return (
    <div className={cn("overflow-x-auto pb-2", className)}>
      <div className="relative mx-2" style={{ minWidth: "760px", height: "168px" }}>
        {/* Base line */}
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-outline-variant/50" />
        {/* Traveled portion */}
        <div
          className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-rail-blue"
          style={{ width: `${trainLeftPct}%` }}
        />

        {/* Live train marker */}
        <div
          className="live-pulse absolute top-1/2 z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-rail-blue text-white shadow-md"
          style={{ left: `${trainLeftPct}%` }}
          aria-hidden="true"
        >
          <TrainFront size={16} />
        </div>

        {stops.map((stop, index) => {
          const leftPct = (stop.distanceFromOriginKm / totalDistance) * 100;
          const labelAbove = index % 2 === 0;

          return (
            <div key={stop.stationCode}>
              <div
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${leftPct}%` }}
              >
                <div className={cn("h-3.5 w-3.5 rounded-full", STOP_DOT_CLASS[stop.status])} />
              </div>

              <div
                className={cn(
                  "absolute flex w-28 -translate-x-1/2 flex-col items-center gap-0.5 text-center",
                  labelAbove ? "-translate-y-full" : "",
                )}
                style={{
                  left: `${leftPct}%`,
                  top: labelAbove ? "calc(50% - 20px)" : "calc(50% + 20px)",
                }}
              >
                <span className="text-body-sm font-semibold leading-tight text-on-background">
                  {stop.stationName}
                </span>
                <span className="font-body text-data-mono leading-tight text-on-surface-variant">
                  {stop.predictedTime}
                </span>
                {stop.status !== "passed" && stop.delayMinutes !== 0 && (
                  <span className="text-[10px] font-semibold leading-tight text-rail-amber">
                    {formatDelay(stop.delayMinutes)}
                  </span>
                )}
                {stop.status === "current" && (
                  <span className="text-[10px] font-bold uppercase leading-tight tracking-wide text-rail-blue">
                    Live
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
