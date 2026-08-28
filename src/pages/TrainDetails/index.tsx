import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CloudFog,
  CloudRain,
  Gauge,
  Info,
  MapPin,
  Route as RouteIcon,
  TrainFront,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardContent } from "@/components/common/Card";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataSourceBadge } from "@/components/common/LiveIndicator";
import { EmptyState } from "@/components/common/EmptyState";
import { CardSkeleton } from "@/components/common/Skeleton";
import { RouteIntelligence, type RouteIntelligenceStop } from "@/components/map/RouteIntelligence";
import { useTrain } from "@/hooks/useTrains";
import { useRouteProgress, useEtaHistory } from "@/hooks/useTrainIntelligence";
import { useElapsedSeconds } from "@/hooks/useElapsedSeconds";
import { useValueChangeFlash } from "@/hooks/useValueChangeFlash";
import { useSimulationStore, useTrainSimulation } from "@/store/useSimulationStore";
import { useNetworkStore } from "@/store/useNetworkStore";
import { getOperationalRiskFactors, type OperationalRiskKind } from "@/data/operationalRiskFactors";
import { computeEnhancedPrediction } from "@/services/predictionEngine";
import { useCurrentWeather } from "@/hooks/useCurrentWeather";
import { getStatusVisual } from "@/lib/status";
import { formatAge, formatDelay, formatClockTime, formatSpeed } from "@/lib/format";
import { useSettingsStore } from "@/store/useSettingsStore";
import { cn } from "@/lib/cn";
import type { DataSourceStatus, Train } from "@/types";

const RISK_ICON: Record<OperationalRiskKind, typeof Info> = {
  "terminal-approach": Info,
  "junction-congestion": Info,
  "seasonal-fog": CloudFog,
  "seasonal-monsoon": CloudRain,
};

const RISK_ICON_CLASS: Record<OperationalRiskKind, string> = {
  "terminal-approach": "text-rail-blue",
  "junction-congestion": "text-on-surface-variant",
  "seasonal-fog": "text-rail-amber",
  "seasonal-monsoon": "text-rail-blue",
};

/** Maps the backend's provenance marker onto the app-wide honesty badge. */
function badgeStatusFor(dataSource: Train["dataSource"]): DataSourceStatus {
  switch (dataSource) {
    case "live":
      return "live";
    case "live-cached":
    case "simulation":
      return "stale";
    case "schedule":
      return "offline";
    default:
      return "unavailable";
  }
}

export default function TrainDetails() {
  const { id } = useParams<{ id: string }>();
  const speedUnit = useSettingsStore((s) => s.speedUnit);
  const timeFormat = useSettingsStore((s) => s.timeFormat);

  const { data: fetchedTrain, isLoading: isLoadingTrain, error: trainError } = useTrain(id);
  const { data: routeProgress, isLoading: isLoadingRoute } = useRouteProgress(id);
  const { data: etaHistory, isLoading: isLoadingHistory } = useEtaHistory(id);

  const startSimulation = useSimulationStore((state) => state.start);
  const stopSimulation = useSimulationStore((state) => state.stop);
  const lastSyncedAt = useSimulationStore((state) => state.lastSyncedAt);
  const syncError = useSimulationStore((state) => state.syncError);
  const simulation = useTrainSimulation(id ?? "");

  // Hand the real train to the simulation store, which then advances its
  // position every 5 seconds and resyncs against the backend every 30.
  useEffect(() => {
    if (fetchedTrain) startSimulation(fetchedTrain);
  }, [fetchedTrain, startSimulation]);

  // Tracking follows the page: leaving Train Details should not leave an
  // interval running against a train nobody is looking at.
  useEffect(() => () => stopSimulation(), [stopSimulation, id]);

  // The simulated train is the fetched one moved forward in time, so prefer it.
  const train = simulation?.train ?? fetchedTrain;

  // Whatever train the user is actively looking at becomes the app-wide
  // "selected" train, so Route Monitor and Simulation Lab pick it up
  // automatically on the next visit instead of always falling back to a
  // preset default.
  const selectTrain = useNetworkStore((state) => state.selectTrain);
  useEffect(() => {
    if (id) selectTrain(id);
  }, [id, selectTrain]);

  // Age is measured from the last real backend sync, never from a tick — a
  // counter that resets every 5 seconds would imply data far fresher than it is.
  const dataAgeSeconds = useElapsedSeconds(lastSyncedAt || Date.now());

  // Known, real operational chokepoints this SPECIFIC train's real route
  // passes through, ahead of its current position — see data/operationalRiskFactors.ts
  // for what this is and, importantly, what it deliberately is not (no
  // fabricated per-train historical statistics).
  const riskFactors = useMemo(
    () => getOperationalRiskFactors(routeProgress?.stops ?? []),
    [routeProgress],
  );

  // Real current conditions at wherever the train is right now — feeds the
  // enhanced prediction below. `useCurrentWeather` tolerates a null target
  // (no train loaded yet) so this can sit before the early returns.
  const weatherTarget = train
    ? { stationCode: train.currentStationCode, stationName: train.currentStationName, position: train.position }
    : null;
  const { data: currentWeather } = useCurrentWeather(weatherTarget);

  // The multi-factor projection: current observed delay, plus momentum from
  // the last few passed stops, plus real weather ahead, plus known
  // structural bottlenecks still on the route — see predictionEngine.ts for
  // what each term means and what this deliberately does not claim.
  const enhancedPrediction = useMemo(
    () => (train ? computeEnhancedPrediction(train, routeProgress?.stops ?? [], currentWeather) : null),
    [train, routeProgress, currentWeather],
  );

  // Must be called before the early returns below — hooks cannot live inside
  // JSX that only some render paths reach.
  const etaFlash = useValueChangeFlash(enhancedPrediction?.projectedEta ?? "");

  if (isLoadingTrain && !train) {
    return (
      <PageContainer>
        <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
          <RefreshCw size={14} className="animate-spin" />
          Fetching live status from Indian Railways…
        </div>
        <CardSkeleton rows={8} />
      </PageContainer>
    );
  }

  if (!train) {
    return (
      <PageContainer>
        <Card>
          <EmptyState
            icon={TrainFront}
            title="Train not found"
            description={
              id
                ? trainError ?? `No timetable or live status could be found for train ${id}.`
                : "No train selected."
            }
            action={
              <Link
                to="/train-search"
                className="mt-2 inline-flex h-9 items-center justify-center rounded bg-primary px-4 text-body-md font-medium text-on-primary transition-colors hover:bg-primary-container"
              >
                Search Another Train
              </Link>
            }
          />
        </Card>
      </PageContainer>
    );
  }

  const dataSource = train.dataSource;
  const isLive = dataSource === "live" || dataSource === "live-cached" || dataSource === "simulation";
  const badgeStatus = badgeStatusFor(dataSource);
  const badgeDetail = train.liveFeedStale
    ? `Live feed is stale · last updated ${formatAge(dataAgeSeconds)} ago by us, longer upstream`
    : isLive
      ? `Live feed · synced ${formatAge(dataAgeSeconds)} ago`
      : "Live running status unavailable — timetable only";

  // The banner fires when the running-status feed did not contribute, when it
  // did but hasn't actually rechecked this train in a while, or when the last
  // resync failed. In every case the delay figure on screen may not reflect
  // what's really happening right now, and the user needs to know that rather
  // than see a confident "On Time" that's really "unknown, last checked a
  // while ago" — see trainComposer.js's STALE_FEED_THRESHOLD_MINUTES.
  const degradedReason =
    dataSource === "unavailable"
      ? "Neither the timetable nor the live running-status feed could be reached. Nothing on this page is current."
      : dataSource === "schedule"
        ? "The live running-status feed is unavailable. Times below come from the published timetable, not from today's actual running."
        : train.liveFeedStale
          ? "The live running-status source hasn't rechecked this train recently — the delay and station below are its last known reading, not confirmed current. A flat \"on time\" here often just means no fresher data exists yet."
          : syncError;

  const statusVisual = getStatusVisual(train.delayStatus);

  const allStops: RouteIntelligenceStop[] = (routeProgress?.stops ?? []).map((stop) => ({
    ...stop,
    stationName: stop.stationName ?? stop.stationCode,
  }));
  const upcomingStops = allStops.filter((stop) => stop.status !== "passed");

  return (
    <PageContainer>
      <Link
        to="/train-search"
        className="flex w-fit items-center gap-1.5 text-body-sm font-medium text-on-surface-variant hover:text-primary"
      >
        <ArrowLeft size={15} />
        Train Search /{" "}
        <span className="font-semibold text-on-background">
          {train.id} {train.name}
        </span>
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded bg-primary-container/10 px-2 py-1 font-body text-data-mono font-bold text-primary">
              {train.id}
            </span>
            <h1 className="font-display text-headline-md text-on-background">{train.name}</h1>
            <DataSourceBadge status={badgeStatus} detail={badgeDetail} />
          </div>
          <p className="flex flex-wrap items-center gap-2 text-body-md text-on-surface-variant">
            {train.originName}
            <ArrowRight size={14} />
            {train.destinationName}
            {train.durationLabel && (
              <span className="text-on-surface-variant/70">· {train.durationLabel}</span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <StatusBadge status={train.delayStatus} className="h-fit px-3 py-1.5 text-body-md" />
          {/* Ticks up in real time so a frozen feed is visibly frozen. */}
          <span className="font-body text-data-mono text-[11px] text-on-surface-variant/80">
            Last updated {formatAge(dataAgeSeconds)} ago
          </span>
        </div>
      </div>

      {degradedReason && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-lg border border-rail-amber/40 bg-rail-amber/10 px-4 py-3"
        >
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-rail-amber" />
          <div className="flex flex-col gap-0.5">
            <span className="text-body-sm font-bold text-rail-amber">Live data unavailable</span>
            <span className="text-body-sm text-on-surface-variant">{degradedReason}</span>
          </div>
        </div>
      )}

      {/* The live feed's own sentence, given prominence per the brief. */}
      {train.liveStatusText && (
        <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low px-4 py-3">
          <span className="mr-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/80">
            Running status
          </span>
          <span className="text-body-md font-medium text-on-background">{train.liveStatusText}</span>
          {train.feedUpdatedLabel && (
            <span className="ml-2 text-[11px] text-on-surface-variant/70">({train.feedUpdatedLabel})</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
        {/* Left column */}
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="ETA Overview" />
            <CardContent className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <HeroStat
                  label="Predicted ETA"
                  value={formatClockTime(enhancedPrediction?.projectedEta ?? train.predictedEta, timeFormat)}
                  big
                  valueClassName={etaFlash ? "eta-flash" : undefined}
                />
                <HeroStat label="Scheduled" value={formatClockTime(train.scheduledEta, timeFormat)} />
                <HeroStat
                  label="Current Delay"
                  value={formatDelay(train.delayMinutes)}
                  valueClassName={statusVisual.textClass}
                />
                <HeroStat
                  label="Projected at Arrival"
                  value={formatDelay(enhancedPrediction?.projectedDelayMinutes ?? train.delayMinutes)}
                  valueClassName={statusVisual.textClass}
                />
                <HeroStat label="Confidence" value={`${enhancedPrediction?.confidence ?? train.predictionConfidence}%`} />
              </div>

              {enhancedPrediction && (
                <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant/30 pt-4 text-body-sm text-on-surface-variant">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Range</span>
                  <span className="font-body text-data-mono text-on-background">
                    {formatClockTime(enhancedPrediction.rangeStart, timeFormat)}–{formatClockTime(enhancedPrediction.rangeEnd, timeFormat)}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 border-t border-outline-variant/30 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                <MiniStat icon={MapPin} label="Current Location" value={train.currentStationName} />
                <MiniStat icon={ArrowRight} label="Next Station" value={train.nextStationName || "—"} />
                <MiniStat icon={Gauge} label="Speed" value={formatSpeed(train.currentSpeedKmh, speedUnit)} />
                <MiniStat
                  icon={RouteIcon}
                  label="Distance Left"
                  value={`${train.distanceRemainingKm} km`}
                />
              </div>
            </CardContent>
          </Card>

          {enhancedPrediction && enhancedPrediction.factors.length > 1 && (
            <Card>
              <CardHeader title="Why This ETA?" />
              <CardContent className="flex flex-col gap-3">
                <p className="text-[11px] leading-snug text-on-surface-variant/80">
                  A heuristic projection, not a validated model — see each factor's basis below. RailCast
                  has no historical ground truth to backtest against, so this cannot honestly claim a
                  specific accuracy figure.
                </p>
                {enhancedPrediction.factors.map((factor) => (
                  <div key={factor.label} className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between text-body-sm">
                      <span className="text-on-background">{factor.label}</span>
                      <span
                        className={cn(
                          "font-body text-data-mono font-semibold",
                          factor.impactMinutes > 0 ? "text-rail-amber" : "text-rail-green",
                        )}
                      >
                        {formatDelay(factor.impactMinutes)}
                      </span>
                    </div>
                    <span className="text-[11px] text-on-surface-variant">{factor.detail}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader title="Route Intelligence" />
            <CardContent>
              {isLoadingRoute && allStops.length === 0 ? (
                <CardSkeleton rows={2} />
              ) : allStops.length > 0 ? (
                <RouteIntelligence stops={allStops} />
              ) : (
                <EmptyState
                  icon={RouteIcon}
                  title="Route data not available"
                  description="The station-by-station breakdown appears once the timetable for this train can be loaded."
                />
              )}
            </CardContent>
          </Card>

          {/* Full timetable with the times the feed actually reported. */}
          <Card>
            <CardHeader
              title="Full Stop List"
              action={
                <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
                  {allStops.length} stops
                </span>
              }
            />
            {allStops.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-body-sm">
                  <thead>
                    <tr className="border-b border-outline-variant/40 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                      <th className="px-4 py-2">Station</th>
                      <th className="px-3 py-2 text-right">Sched</th>
                      <th className="px-3 py-2 text-right">Actual / Est</th>
                      <th className="px-3 py-2 text-right">Delay</th>
                      <th className="px-3 py-2 text-right">PF</th>
                      <th className="px-4 py-2 text-right">Km</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {allStops.map((stop) => (
                      <tr
                        key={`${stop.stationCode}-${stop.distanceFromOriginKm}`}
                        className={cn(
                          stop.status === "current" && "bg-rail-blue/5",
                          stop.status === "passed" && "text-on-surface-variant",
                        )}
                      >
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "h-1.5 w-1.5 shrink-0 rounded-full",
                                stop.status === "passed" && "bg-on-surface-variant/50",
                                stop.status === "current" && "bg-rail-blue",
                                stop.status === "upcoming" && "bg-outline-variant",
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium text-on-background">{stop.stationName}</span>
                              <span className="font-body text-data-mono text-[10px] text-on-surface-variant">
                                {stop.stationCode}
                                {typeof stop.dayOffset === "number" && stop.dayOffset > 0
                                  ? ` · day ${stop.dayOffset + 1}`
                                  : ""}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-body text-data-mono text-on-surface-variant">
                          {stop.scheduledTime}
                        </td>
                        <td className="px-3 py-2 text-right font-body text-data-mono text-on-background">
                          {stop.actualTime ?? stop.predictedTime}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-2 text-right font-body text-data-mono font-semibold",
                            stop.delayMinutes > 5 ? "text-rail-amber" : "text-rail-green",
                          )}
                        >
                          {stop.delayText ?? formatDelay(stop.delayMinutes)}
                        </td>
                        <td className="px-3 py-2 text-right font-body text-data-mono text-on-surface-variant">
                          {stop.platform ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-right font-body text-data-mono text-on-surface-variant">
                          {stop.distanceFromOriginKm}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <CardContent>
                <EmptyState title="No stop list" description="The timetable for this train could not be loaded." />
              </CardContent>
            )}
          </Card>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6 xl:col-span-1">
          <Card>
            <CardHeader title="Upcoming Stops" />
            <CardContent>
              {isLoadingRoute && upcomingStops.length === 0 ? (
                <CardSkeleton rows={3} />
              ) : upcomingStops.length > 0 ? (
                <div className="flex max-h-[420px] flex-col divide-y divide-outline-variant/20 overflow-y-auto scrollbar-thin">
                  {upcomingStops.map((stop) => (
                    <div
                      key={`${stop.stationCode}-${stop.distanceFromOriginKm}`}
                      className="flex items-center justify-between gap-2 py-2"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-body-sm font-medium text-on-background">
                          {stop.stationName}
                        </span>
                        <span className="font-body text-data-mono text-[11px] text-on-surface-variant">
                          {stop.stationCode} · {stop.distanceFromOriginKm} km
                        </span>
                      </div>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="font-body text-data-mono text-body-sm text-on-surface-variant">
                          {stop.predictedTime}
                        </span>
                        {stop.delayMinutes !== 0 && (
                          <span className="text-body-sm font-semibold text-rail-amber">
                            {formatDelay(stop.delayMinutes)}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No upcoming stops"
                  description="Either every stop has been passed, or route data is unavailable."
                />
              )}
            </CardContent>
          </Card>

          {riskFactors.length > 0 && (
            <Card>
              <CardHeader title="Known Operational Risk Points" />
              <CardContent className="flex flex-col gap-3">
                <p className="text-[11px] leading-snug text-on-surface-variant/80">
                  Known, real chokepoints and seasonal effects this route passes through — not a
                  statistical average for this train. RailCast has no source for per-train
                  historical delay logs; these are documented facts about the network itself.
                </p>
                {riskFactors.map((factor) => {
                  const Icon = RISK_ICON[factor.kind];
                  return (
                    <div
                      key={`${factor.kind}-${factor.stationCode}`}
                      className="flex items-start gap-2.5 rounded-md border border-outline-variant/40 bg-surface-container-low p-3"
                    >
                      <Icon size={16} className={cn("mt-0.5 shrink-0", RISK_ICON_CLASS[factor.kind])} />
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-body-sm font-semibold text-on-background">{factor.title}</span>
                          <span className="font-body text-data-mono text-[10px] text-on-surface-variant">
                            {factor.stationCode}
                          </span>
                        </div>
                        <p className="text-[11px] leading-snug text-on-surface-variant">{factor.description}</p>
                        <span className="text-[11px] font-semibold text-rail-amber">
                          Typically +{factor.typicalHoldMinutesMin}–{factor.typicalHoldMinutesMax} min
                        </span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader title="ETA Evolution" />
            <CardContent>
              {isLoadingHistory && !etaHistory ? (
                <CardSkeleton rows={3} />
              ) : etaHistory && etaHistory.length > 1 ? (
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={etaHistory} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e2" vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#737685" }} stroke="#c3c6d6" />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#737685" }}
                      stroke="#c3c6d6"
                      width={36}
                      tickFormatter={(v: number) => `${v}m`}
                    />
                    <Tooltip
                      formatter={(v: number) => [formatDelay(v), "Delay"]}
                      labelFormatter={(l: string) => `Updated @ ${l}`}
                    />
                    <Line type="monotone" dataKey="delayMinutes" stroke="#0052cc" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  title="Building history"
                  description="The upstream feeds publish a snapshot, not a time series — this chart fills in as the page observes successive updates."
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function HeroStat({
  label,
  value,
  big = false,
  valueClassName,
}: {
  label: string;
  value: string;
  big?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/80">{label}</span>
      <span
        className={cn(
          "font-bold text-on-background",
          big ? "font-display text-display-lg" : "font-body text-headline-sm",
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={16} className="mt-0.5 shrink-0 text-on-surface-variant" />
      <div className="flex min-w-0 flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
          {label}
        </span>
        <span className="truncate text-body-md font-semibold text-on-background">{value}</span>
      </div>
    </div>
  );
}
