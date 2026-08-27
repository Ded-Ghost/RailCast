import { useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Clock, Gauge, Target, TriangleAlert } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/common/Card";
import { MetricCard } from "@/components/common/MetricCard";
import { CardSkeleton, MetricCardSkeleton } from "@/components/common/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { MapContainer, HeatmapOverlay, StationMarker } from "@/components/map";
import {
  useDelayCauseBreakdown,
  useDelayIntelligenceSummary,
  useDelayTrend,
  useWorstPerformingSections,
} from "@/hooks/useDelayIntelligence";
import { useCorridorStations, useRailwaySections } from "@/hooks/useRouteMonitor";
import { formatDelay } from "@/lib/format";

const CORRIDOR_MAP_CENTER = { lat: 23.7, lng: 82.5 };
const CORRIDOR_MAP_ZOOM = 5;

export default function DelayIntelligence() {
  const { data: summary, isLoading: isLoadingSummary } = useDelayIntelligenceSummary();
  const { data: causes, isLoading: isLoadingCauses } = useDelayCauseBreakdown();
  const { data: trend, isLoading: isLoadingTrend } = useDelayTrend();
  const { data: worstSections, isLoading: isLoadingWorst } = useWorstPerformingSections();
  const { data: stations } = useCorridorStations();
  const { data: sections } = useRailwaySections();
  const [focusedSectionId, setFocusedSectionId] = useState<string | null>(null);
  const heatmapCardRef = useRef<HTMLDivElement>(null);

  function focusSection(sectionId: string) {
    setFocusedSectionId(sectionId);
    heatmapCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <PageContainer>
      <PageHeader
        title="Delay Intelligence"
        description="Real-time analytics and historical delay trends across the network."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoadingSummary || !summary ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              label="Average Delay"
              value={`${summary.averageDelayMinutes} min`}
              delta={`+${summary.averageDelayDeltaFromYesterday} min from yesterday`}
              deltaTone="negative"
              icon={Clock}
            />
            <MetricCard
              label="Maximum Delay"
              value={`${summary.maxDelayMinutes} min`}
              delta={`Train ${summary.maxDelayTrainId} (${summary.maxDelaySection})`}
              deltaTone="neutral"
              icon={TriangleAlert}
            />
            <MetricCard
              label="Recovery Rate"
              value={`${summary.recoveryRatePerSector} min/sector`}
              delta="Improving steadily"
              deltaTone="positive"
              icon={Gauge}
            />
            <MetricCard
              label="Prediction Accuracy"
              value={`${summary.predictionAccuracyPercent}%`}
              icon={Target}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
        <Card className="xl:col-span-2">
          <CardHeader title="Delay Trend Over Time" />
          <CardContent>
            {isLoadingTrend || !trend ? (
              <CardSkeleton rows={4} />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e2" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#737685" }} stroke="#c3c6d6" />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#737685" }}
                    stroke="#c3c6d6"
                    width={36}
                    tickFormatter={(value: number) => `${value}m`}
                  />
                  <Tooltip formatter={(value: number) => [`${value} min`, undefined]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="actualDelayMinutes"
                    name="Actual"
                    stroke="#0052cc"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="predictedDelayMinutes"
                    name="Predicted"
                    stroke="#c3c6d6"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader title="Delay Causes" />
          <CardContent>
            {isLoadingCauses || !causes ? (
              <CardSkeleton rows={4} />
            ) : (
              <div className="flex flex-col gap-4">
                {causes.map((cause) => (
                  <div key={cause.label} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-body-sm">
                      <span className="text-on-background">{cause.label}</span>
                      <span className="font-semibold text-on-background">{cause.percent}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                      <div className="h-full rounded-full bg-rail-blue" style={{ width: `${cause.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card ref={heatmapCardRef} className={`flex flex-col transition-shadow ${focusedSectionId ? "ring-2 ring-primary ring-offset-2" : ""}`}>
        <CardHeader
          title="Railway Delay Heatmap"
          action={<span className="text-body-sm text-on-surface-variant">Live Data</span>}
        />
        {!stations || !sections ? (
          <div className="p-4">
            <CardSkeleton rows={5} />
          </div>
        ) : (
          <MapContainer
            center={CORRIDOR_MAP_CENTER}
            zoom={CORRIDOR_MAP_ZOOM}
            className="min-h-[380px] flex-1 lg:min-h-[440px]"
            showTypeControl={false}
          >
            <HeatmapOverlay stations={stations} sections={sections} />
            {stations.map((station) => (
              <StationMarker key={station.code} station={station} />
            ))}
          </MapContainer>
        )}
      </Card>

      <Card>
        <CardHeader title="Worst Performing Sections" />
        {isLoadingWorst ? (
          <div className="p-4">
            <CardSkeleton rows={4} />
          </div>
        ) : !worstSections || worstSections.length === 0 ? (
          <EmptyState title="No section data available" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant/30 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  <th className="px-4 py-2">Section</th>
                  <th className="px-4 py-2 text-right">Avg Delay</th>
                  <th className="px-4 py-2 text-right">Affected Trains</th>
                  <th className="px-4 py-2 text-right">Current Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {worstSections.map((section) => (
                  <tr
                    key={section.id}
                    onClick={() => focusSection(section.id)}
                    className={`cursor-pointer transition-colors hover:bg-surface-container-low ${
                      focusedSectionId === section.id ? "bg-primary-container/5" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-on-background">{section.name}</td>
                    <td className="px-4 py-3 text-right">{formatDelay(section.avgDelayMinutes)}</td>
                    <td className="px-4 py-3 text-right text-on-surface-variant">{section.affectedTrains}</td>
                    <td className="px-4 py-3 text-right">
                      <StatusBadge status={section.status} className="ml-auto" showIcon={false} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
