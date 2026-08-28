import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Activity, ArrowRight, Gauge, Target } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/common/Card";
import { MetricCard } from "@/components/common/MetricCard";
import { MetricCardSkeleton, CardSkeleton } from "@/components/common/Skeleton";
import { DataSourceBadge } from "@/components/common/LiveIndicator";
import { EmptyState } from "@/components/common/EmptyState";
import { useAccuracyMetrics, usePredictionVsActual, useRankedFactors } from "@/hooks/usePredictionInsights";
import { useTrain } from "@/hooks/useTrains";
import { usePrediction } from "@/hooks/useTrainIntelligence";
import { useNetworkStore } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { formatDelay, formatClockTime } from "@/lib/format";

export default function Predictions() {
  // Use the selected train from network store, or default to first train
  const selectedTrainId = useNetworkStore((state) => state.selectedTrainId);
  const trains = useNetworkStore((state) => state.trains);
  const trainId = selectedTrainId || trains[0]?.id || "12301";

  const { data: accuracy, isLoading: isLoadingAccuracy } = useAccuracyMetrics();
  const { data: series, isLoading: isLoadingSeries } = usePredictionVsActual();
  const { data: factors, isLoading: isLoadingFactors } = useRankedFactors();
  const { data: train } = useTrain(trainId);
  const { data: prediction } = usePrediction(trainId);
  const timeFormat = useSettingsStore((s) => s.timeFormat);

  const maxImpact = factors ? Math.max(...factors.map((factor) => factor.impactScore), 1) : 1;

  return (
    <PageContainer>
      <PageHeader
        title="Predictions"
        description="ML-driven ETA forecasts, confidence bands, and contributing factors."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoadingAccuracy || !accuracy ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard label="MAE" value={`${accuracy.maeMinutes} min`} icon={Target} />
            <MetricCard label="RMSE" value={`${accuracy.rmseMinutes} min`} icon={Activity} />
            <MetricCard label="Within ±5 min" value={`${accuracy.within5MinPercent}%`} icon={Gauge} />
            <MetricCard label="Within ±10 min" value={`${accuracy.within10MinPercent}%`} icon={Gauge} />
          </>
        )}
      </div>
      <p className="-mt-4 text-body-sm text-on-surface-variant/80">
        Demo/mock model-evaluation figures — not measured against real traffic.
      </p>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
        <Card className="xl:col-span-2">
          <CardHeader title="Prediction vs Actual ETA" />
          <CardContent>
            {isLoadingSeries || !series ? (
              <CardSkeleton rows={4} />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e2" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#737685" }} stroke="#c3c6d6" />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#737685" }}
                    stroke="#c3c6d6"
                    width={36}
                    tickFormatter={(value: number) => `${value}m`}
                  />
                  <Tooltip formatter={(value: number) => [`+${value} min`, undefined]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="actualEtaMinutesFromSchedule"
                    name="Actual"
                    stroke="#0052cc"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="predictedEtaMinutesFromSchedule"
                    name="Predicted"
                    stroke="#d68800"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader title="What Influences ETA?" />
          <CardContent>
            {isLoadingFactors || !factors ? (
              <CardSkeleton rows={5} />
            ) : (
              <div className="flex flex-col gap-4">
                {factors.map((factor) => (
                  <div key={factor.label} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-body-sm">
                      <span className="text-on-background">{factor.label}</span>
                      <span className="font-semibold text-on-surface-variant">{factor.impactScore}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(factor.impactScore / maxImpact) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={train ? `${train.id} ${train.name}` : "Selected Train"}
          action={train && <DataSourceBadge status="demo" detail="Scripted for demonstration" />}
        />
        <CardContent>
          {!train || !prediction ? (
            <EmptyState icon={Activity} title="No prediction available" description="Select a train to see its ETA prediction." />
          ) : (
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
                {train.originName}
                <ArrowRight size={14} />
                {train.destinationName}
              </div>
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <PredictionStat label="Current ETA" value={formatClockTime(prediction.predictedEta, timeFormat)} big />
                <PredictionStat label="Confidence" value={`${prediction.confidence}%`} />
                <PredictionStat
                  label="Prediction Range"
                  value={`${formatClockTime(prediction.rangeStart, timeFormat)}–${formatClockTime(prediction.rangeEnd, timeFormat)}`}
                />
                <PredictionStat label="Predicted Final Delay" value={formatDelay(train.delayMinutes)} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function PredictionStat({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/70">{label}</span>
      <span
        className={`font-body text-data-mono font-bold text-on-background ${big ? "text-headline-sm" : "text-body-md"}`}
      >
        {value}
      </span>
    </div>
  );
}
