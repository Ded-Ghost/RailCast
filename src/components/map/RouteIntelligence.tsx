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
 * Vertical station-by-station timeline: every stop on the route gets its own
 * row — full name, code, scheduled vs. predicted time, delay — connected by
 * a continuous line with the live train marker sitting between whichever two
 * stops it's currently between.
 *
 * This replaces an earlier horizontal, distance-proportional layout that
 * floated labels above/below a single line. That design could not show more
 * than a handful of station names on any real long-distance route (some run
 * to 60-100+ stops) without either overlapping text or thinning most labels
 * down to unnamed dots — and unnamed dots read as clutter, not information,
 * exactly the complaint that sank it. A vertical list has no such ceiling:
 * each row gets a fixed height regardless of how many stops there are, so
 * every station is always named, and the list simply scrolls.
 */
export function RouteIntelligence({ stops, className }: RouteIntelligenceProps) {
  if (stops.length === 0) return null;

  const currentIndex = stops.findIndex((stop) => stop.status === "current");

  return (
    <div className={cn("max-h-[420px] overflow-y-auto scrollbar-thin", className)}>
      <div className="relative pl-2">
        {/* Continuous connecting line, behind every row's dot. */}
        <div className="absolute bottom-3 left-[23px] top-3 w-0.5 bg-outline-variant/50" aria-hidden="true" />
        {currentIndex > 0 && (
          <div
            className="absolute left-[23px] top-3 w-0.5 bg-rail-blue"
            style={{ height: `${(currentIndex / (stops.length - 1)) * 100}%` }}
            aria-hidden="true"
          />
        )}

        {stops.map((stop, index) => {
          const isCurrent = stop.status === "current";
          return (
            <div key={`${stop.stationCode}-${stop.distanceFromOriginKm}`} className="relative flex items-start gap-3 py-2.5">
              <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center">
                {isCurrent ? (
                  <div className="live-pulse flex h-7 w-7 items-center justify-center rounded-full bg-rail-blue text-white shadow-md">
                    <TrainFront size={14} />
                  </div>
                ) : (
                  <div className={cn("h-3.5 w-3.5 rounded-full", STOP_DOT_CLASS[stop.status])} />
                )}
              </div>

              <div
                className={cn(
                  "flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-md px-2 py-1",
                  isCurrent && "bg-rail-blue/5",
                )}
              >
                <div className="flex min-w-0 flex-col">
                  <span
                    className={cn(
                      "truncate text-body-sm font-semibold",
                      stop.status === "passed" ? "text-on-surface-variant" : "text-on-background",
                    )}
                  >
                    {stop.stationName}
                  </span>
                  <span className="font-body text-data-mono text-[10px] text-on-surface-variant">
                    {stop.stationCode} · {stop.distanceFromOriginKm} km
                    {index === 0 && " · Origin"}
                    {index === stops.length - 1 && " · Destination"}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-body text-data-mono text-body-sm text-on-surface-variant">
                    {stop.predictedTime}
                  </span>
                  {stop.delayMinutes !== 0 && (
                    <span className="text-[11px] font-semibold text-rail-amber">{formatDelay(stop.delayMinutes)}</span>
                  )}
                  {isCurrent && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-rail-blue">Live</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
