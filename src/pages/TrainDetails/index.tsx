import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Gauge,
  MapPin,
  Route as RouteIcon,
  TrainFront,
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
import { LiveIndicator } from "@/components/common/LiveIndicator";
import { EmptyState } from "@/components/common/EmptyState";
import { CardSkeleton } from "@/components/common/Skeleton";
import { RouteIntelligence, type RouteIntelligenceStop } from "@/components/map/RouteIntelligence";
import { PRIMARY_DEMO_TRAIN_ID } from "@/data";
import { useTrain } from "@/hooks/useTrains";
import { usePrediction, useRouteProgress, useEtaHistory } from "@/hooks/useTrainIntelligence";
import { useStations } from "@/hooks/useStations";
import { useSimulationStore } from "@/store/useSimulationStore";
import { useElapsedSeconds } from "@/hooks/useElapsedSeconds";
import { useValueChangeFlash } from "@/hooks/useValueChangeFlash";
import { getStatusVisual } from "@/lib/status";
import { formatDelay } from "@/lib/format";
import { cn } from "@/lib/cn";

export default function TrainDetails() {
  const { id } = useParams<{ id: string }>();
  const { data: train, isLoading: isLoadingTrain } = useTrain(id);
  const { data: prediction, isLoading: isLoadingPrediction } = usePrediction(id);
  const { data: routeProgress, isLoading: isLoadingRoute } = useRouteProgress(id);
  const { data: etaHistory, isLoading: isLoadingHistory } = useEtaHistory(id);
  const { data: stations } = useStations();

  // Called unconditionally (before any early return) to keep hook order
  // stable across renders. Harmless when the train hasn't loaded yet or
  // isn't the live demo train — `lastUpdatedAt` just won't be used below.
  const lastUpdatedAt = useSimulationStore((state) => state.lastUpdatedAt);
  const elapsedSeconds = useElapsedSeconds(lastUpdatedAt);
  const etaFlash = useValueChangeFlash(train?.predictedEta ?? "");

  if (isLoadingTrain) {
    return (
      <PageContainer>
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
            description={id ? `No live data for train ${id}.` : "No train selected."}
            action={
              <Link
                to="/train-search"
                className="mt-2 inline-flex h-9 items-center justify-center rounded bg-primary px-4 text-body-md font-medium text-on-primary transition-colors hover:bg-primary-container"
              >
                Back to Train Search
              </Link>
            }
          />
        </Card>
      </PageContainer>
    );
  }

  const isLiveDemo = train.id === PRIMARY_DEMO_TRAIN_ID;
  const statusVisual = getStatusVisual(train.delayStatus);
  const stationNameByCode = new Map((stations ?? []).map((station) => [station.code, station.name]));
  const enrichedStops: RouteIntelligenceStop[] = (routeProgress?.stops ?? []).map((stop) => ({
    ...stop,
    stationName: stationNameByCode.get(stop.stationCode) ?? stop.stationCode,
  }));
  const upcomingStops = enrichedStops.filter((stop) => stop.status !== "passed");

  return (
    <PageContainer>
      <Link
        to="/train-search"
        className="flex w-fit items-center gap-1.5 text-body-sm font-medium text-on-surface-variant hover:text-primary"
      >
        <ArrowLeft size={15} />
        Train Search / <span className="font-semibold text-on-background">{train.id} {train.name}</span>
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded bg-primary-container/10 px-2 py-1 font-body text-data-mono font-bold text-primary">
              {train.id}
            </span>
            <h1 className="font-display text-headline-md text-on-background">{train.name}</h1>
            <LiveIndicator />
            {isLiveDemo && (
              <span className="text-body-sm text-on-surface-variant">
                Updated {elapsedSeconds}s ago
              </span>
            )}
          </div>
          <p className="flex items-center gap-2 text-body-md text-on-surface-variant">
            {train.originName}
            <ArrowRight size={14} />
            {train.destinationName}
          </p>
        </div>
        <StatusBadge status={train.delayStatus} className="h-fit px-3 py-1.5 text-body-md" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
        {/* Dominant column: ETA hero + route intelligence */}
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="ETA Overview" />
            <CardContent className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <HeroStat
                  label="Primary ETA"
                  value={train.predictedEta}
                  big
                  valueClassName={etaFlash ? "eta-flash" : undefined}
                />
                <HeroStat label="Scheduled" value={train.scheduledEta} />
                <HeroStat
                  label="Delay"
                  value={formatDelay(train.delayMinutes)}
                  valueClassName={statusVisual.textClass}
                />
                <HeroStat label="Confidence" value={`${train.predictionConfidence}%`} />
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant/30 pt-4 text-body-sm text-on-surface-variant">
                <span className="font-semibold uppercase tracking-wider text-[11px]">Range</span>
                <span className="font-body text-data-mono text-on-background">
                  {train.predictedEtaRangeStart}–{train.predictedEtaRangeEnd}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 border-t border-outline-variant/30 pt-4 sm:grid-cols-3">
                <MiniStat icon={MapPin} label="Current Location" value={train.currentStationName} />
                <MiniStat icon={Gauge} label="Speed" value={`${train.currentSpeedKmh} km/h`} />
                <MiniStat icon={RouteIcon} label="Distance Remaining" value={`${train.distanceRemainingKm} km`} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Route Intelligence" />
            <CardContent>
              {isLoadingRoute ? (
                <CardSkeleton rows={2} />
              ) : enrichedStops.length > 0 ? (
                <RouteIntelligence stops={enrichedStops} />
              ) : (
                <EmptyState
                  icon={RouteIcon}
                  title="Route intelligence not available"
                  description="Station-by-station ETA breakdown hasn't been modeled for this train yet."
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Secondary column: forecast, explanation, and the one allowed chart */}
        <div className="flex flex-col gap-6 xl:col-span-1">
          <Card>
            <CardHeader title="Delay Forecast" />
            <CardContent>
              {isLoadingRoute ? (
                <CardSkeleton rows={3} />
              ) : upcomingStops.length > 0 ? (
                <div className="flex flex-col divide-y divide-outline-variant/20">
                  {upcomingStops.map((stop) => (
                    <div key={stop.stationCode} className="flex items-center justify-between py-2">
                      <span className="text-body-sm font-medium text-on-background">{stop.stationName}</span>
                      <span className="flex items-center gap-2">
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
                <EmptyState title="No forecast available" description="No upcoming stops modeled for this train." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Why This ETA?" />
            <CardContent>
              {isLoadingPrediction ? (
                <CardSkeleton rows={3} />
              ) : prediction ? (
                <div className="flex flex-col gap-3">
                  {prediction.factors.map((factor) => (
                    <div key={factor.label} className="flex items-center justify-between gap-3">
                      <span className="text-body-sm text-on-surface-variant">{factor.label}</span>
                      <span className="whitespace-nowrap text-body-sm font-semibold text-rail-amber">
                        +{factor.impactMinutes}m
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-outline-variant/30 pt-3 text-body-sm text-on-surface-variant">
                    <span>Model {prediction.modelVersion}</span>
                    <span>{prediction.confidence}% confidence</span>
                  </div>
                </div>
              ) : (
                <EmptyState title="No explanation available" description="Contributing factors haven't been modeled for this train." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="ETA Evolution" />
            <CardContent>
              {isLoadingHistory ? (
                <CardSkeleton rows={3} />
              ) : etaHistory && etaHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={etaHistory} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e2" vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#737685" }} stroke="#c3c6d6" />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#737685" }}
                      stroke="#c3c6d6"
                      width={36}
                      tickFormatter={(value: number) => `${value}m`}
                    />
                    <Tooltip
                      formatter={(value: number) => [`+${value} min`, "Predicted delay"]}
                      labelFormatter={(label: string) => `Model refresh @ ${label}`}
                    />
                    <Line type="monotone" dataKey="delayMinutes" stroke="#0052cc" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState title="No history available" description="Prediction drift hasn't been recorded for this train." />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

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
      <Icon size={16} className="mt-0.5 text-on-surface-variant" />
      <div className="flex flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
          {label}
        </span>
        <span className="text-body-md font-semibold text-on-background">{value}</span>
      </div>
    </div>
  );
}

