import { useEffect, useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, ArrowRight, Gauge, Target } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/common/Card";
import { MetricCard } from "@/components/common/MetricCard";
import { CardSkeleton } from "@/components/common/Skeleton";
import { DataSourceBadge } from "@/components/common/LiveIndicator";
import { EmptyState } from "@/components/common/EmptyState";
import { useTrain } from "@/hooks/useTrains";
import { useRouteProgress, useEtaHistory } from "@/hooks/useTrainIntelligence";
import { useCurrentWeather } from "@/hooks/useCurrentWeather";
import { useSimulationStore, useTrainSimulation } from "@/store/useSimulationStore";
import { useNetworkStore } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { computeEnhancedPrediction } from "@/services/predictionEngine";
import { formatDelay, formatClockTime } from "@/lib/format";
import type { DataSourceStatus, Train } from "@/types";

/** Maps the backend's provenance marker onto the app-wide honesty badge — same mapping Train Details uses. */
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

export default function Predictions() {
  const selectedTrainId = useNetworkStore((state) => state.selectedTrainId);
  const trains = useNetworkStore((state) => state.trains);
  const trainId = selectedTrainId || trains[0]?.id || "12301";
  const timeFormat = useSettingsStore((s) => s.timeFormat);

  const { data: fetchedTrain, isLoading: isLoadingTrain } = useTrain(trainId);
  const { data: routeProgress } = useRouteProgress(trainId);
  const { data: etaHistory, isLoading: isLoadingHistory } = useEtaHistory(trainId);

  const startSimulation = useSimulationStore((state) => state.start);
  const stopSimulation = useSimulationStore((state) => state.stop);
  const simulation = useTrainSimulation(trainId);

  // Hand the real train to the simulation store so its ETA keeps advancing
  // and "ETA Evolution" below has something real to accumulate — same
  // lifecycle Train Details uses for whichever train is on screen.
  useEffect(() => {
    if (fetchedTrain) startSimulation(fetchedTrain);
  }, [fetchedTrain, startSimulation]);

  useEffect(() => () => stopSimulation(), [stopSimulation, trainId]);

  const train = simulation?.train ?? fetchedTrain;
  const activeRouteProgress = simulation?.routeProgress ?? routeProgress;
  const activeEtaHistory = simulation?.etaHistory ?? etaHistory;

  const weatherTarget = train
    ? { stationCode: train.currentStationCode, stationName: train.currentStationName, position: train.position }
    : null;
  const { data: currentWeather } = useCurrentWeather(weatherTarget);

  // The same multi-factor projection Train Details uses: real observed
  // delay, plus momentum, real weather ahead, and known structural
  // bottlenecks on this specific train's route. See predictionEngine.ts.
  const enhancedPrediction = useMemo(
    () => (train ? computeEnhancedPrediction(train, activeRouteProgress?.stops ?? [], currentWeather) : null),
    [train, activeRouteProgress, currentWeather],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Predictions"
        description="Live heuristic ETA forecast for the train you're tracking: real delay, momentum, weather, and known bottlenecks layered on the live feed."
      />

      {!train ? (
        isLoadingTrain ? (
          <CardSkeleton rows={6} />
        ) : (
          <Card>
            <EmptyState
              icon={Activity}
              title="No train tracked yet"
              description="Search for or select a train to see its live ETA prediction."
            />
          </Card>
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded bg-primary-container/10 px-2 py-1 font-body text-data-mono font-bold text-primary">
              {train.id}
            </span>
            <h2 className="font-display text-headline-sm text-on-background">{train.name}</h2>
            <DataSourceBadge
              status={badgeStatusFor(train.dataSource)}
              detail={train.liveFeedStale ? "Live feed hasn't rechecked recently, last known reading" : undefined}
            />
          </div>
          <p className="-mt-2 flex items-center gap-2 text-body-sm text-on-surface-variant">
            {train.originName}
            <ArrowRight size={14} />
            {train.destinationName}
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Predicted ETA"
              value={formatClockTime(enhancedPrediction?.projectedEta ?? train.predictedEta, timeFormat)}
              icon={Target}
            />
            <MetricCard
              label="Confidence"
              value={`${enhancedPrediction?.confidence ?? train.predictionConfidence}%`}
              icon={Gauge}
            />
            <MetricCard
              label="Prediction Range"
              value={
                enhancedPrediction
                  ? `${formatClockTime(enhancedPrediction.rangeStart, timeFormat)}–${formatClockTime(enhancedPrediction.rangeEnd, timeFormat)}`
                  : "—"
              }
              icon={Activity}
            />
            <MetricCard
              label="Projected Delay at Arrival"
              value={formatDelay(enhancedPrediction?.projectedDelayMinutes ?? train.delayMinutes)}
              icon={Gauge}
            />
          </div>
          <p className="-mt-4 text-body-sm text-on-surface-variant/80">
            A heuristic projection, not a validated model. RailCast has no historical ground truth to backtest
            against, so this cannot honestly claim a specific accuracy figure.
          </p>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
            <Card className="xl:col-span-2">
              <CardHeader title="ETA Evolution" />
              <p className="px-4 pb-1 pt-3 text-[11px] leading-snug text-on-surface-variant/80">
                This train's real projected delay, sampled every time this page resyncs, not an invented curve. The
                upstream feeds publish a snapshot, not a history, so the line builds up live while you're watching.
              </p>
              <CardContent>
                {isLoadingHistory && (!activeEtaHistory || activeEtaHistory.length === 0) ? (
                  <CardSkeleton rows={4} />
                ) : activeEtaHistory && activeEtaHistory.length > 1 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={activeEtaHistory} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e2" vertical={false} />
                      <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#737685" }} stroke="#c3c6d6" />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#737685" }}
                        stroke="#c3c6d6"
                        width={36}
                        tickFormatter={(v: number) => `${v}m`}
                      />
                      <Tooltip
                        formatter={(v: number) => [formatDelay(v), "Projected delay"]}
                        labelFormatter={(l: string) => `Updated @ ${l}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="delayMinutes"
                        name="Projected delay"
                        stroke="#0052cc"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    icon={Activity}
                    title="Collecting live samples…"
                    description="The trend line appears once this page has observed a couple of resyncs. Check back in a minute."
                  />
                )}
              </CardContent>
            </Card>

            <Card className="xl:col-span-1">
              <CardHeader title="Why This ETA?" />
              <CardContent>
                {!enhancedPrediction || enhancedPrediction.factors.length <= 1 ? (
                  <EmptyState
                    title="Just the raw delay"
                    description="No momentum, weather, or known bottleneck is currently shifting this train's projection beyond its live delay."
                  />
                ) : (
                  <div className="flex flex-col gap-4">
                    {enhancedPrediction.factors.map((factor) => (
                      <div key={factor.label} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-body-sm">
                          <span className="text-on-background">{factor.label}</span>
                          <span
                            className={`font-body text-data-mono font-semibold ${
                              factor.impactMinutes > 0 ? "text-rail-amber" : "text-rail-green"
                            }`}
                          >
                            {formatDelay(factor.impactMinutes)}
                          </span>
                        </div>
                        <span className="text-[11px] text-on-surface-variant">{factor.detail}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </PageContainer>
  );
}
