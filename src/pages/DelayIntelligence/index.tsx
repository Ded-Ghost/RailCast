import { useMemo, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Clock, Gauge, Radio, TriangleAlert } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/common/Card";
import { MetricCard } from "@/components/common/MetricCard";
import { CardSkeleton, MetricCardSkeleton } from "@/components/common/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataSourceBadge } from "@/components/common/LiveIndicator";
import { MapContainer, NetworkHeatOverlay, StationMarker } from "@/components/map";
import { useTrains } from "@/hooks/useTrains";
import { useStations } from "@/hooks/useStations";
import { useNetworkStore } from "@/store/useNetworkStore";
import { computeBoundsView } from "@/lib/geo";
import { formatDelay } from "@/lib/format";
import { computeRealDelaySummary, computeRealDelayCauses, computeBusiestDelayPoints } from "@/services/networkAnalytics";

export default function DelayIntelligence() {
  const { data: liveTrains, error: trainsError } = useTrains();
  const { data: majorStations } = useStations();
  const delayTrendHistory = useNetworkStore((s) => s.delayTrendHistory);
  const [focusedSectionId, setFocusedSectionId] = useState<string | null>(null);
  const heatmapCardRef = useRef<HTMLDivElement>(null);

  const trains = liveTrains ?? [];
  const isLoadingSummary = liveTrains === null;
  const summary = useMemo(() => computeRealDelaySummary(trains, delayTrendHistory), [trains, delayTrendHistory]);
  const causes = useMemo(() => computeRealDelayCauses(trains), [trains]);
  const worstSections = useMemo(() => computeBusiestDelayPoints(trains), [trains]);

  // Framed once over the major stations — a stable, network-wide view. The
  // heat circles move as trains do; the view itself does not chase them.
  const mapView = useMemo(
    () => computeBoundsView((majorStations ?? []).map((station) => station.position), { padding: 1.15, minZoom: 4, maxZoom: 6 }),
    [majorStations],
  );

  function focusSection(sectionId: string) {
    setFocusedSectionId(sectionId);
    heatmapCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <PageContainer>
      <PageHeader
        title="Delay Intelligence"
        description="Real-time analytics computed from the trains RailCast is currently tracking."
      />

      {!isLoadingSummary && (
        <p className="-mt-2 flex items-center gap-1.5 text-body-sm text-on-surface-variant">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rail-green opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rail-green" />
          </span>
          Actively tracking all {summary.trackedTrains} browse-list trains. Every KPI below is computed from them,
          not just the ones with a fresh reading right now.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoadingSummary ? (
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
              delta={
                summary.averageDelayTrendDeltaMinutes === null
                  ? "Accumulating this session"
                  : `${summary.averageDelayTrendDeltaMinutes >= 0 ? "+" : ""}${summary.averageDelayTrendDeltaMinutes} min vs earlier this session`
              }
              deltaTone={
                summary.averageDelayTrendDeltaMinutes === null || summary.averageDelayTrendDeltaMinutes === 0
                  ? "neutral"
                  : summary.averageDelayTrendDeltaMinutes > 0
                    ? "negative"
                    : "positive"
              }
              icon={Clock}
            />
            <MetricCard
              label="Maximum Delay"
              value={`${summary.maxDelayMinutes} min`}
              delta={summary.maxDelayTrainId ? `Train ${summary.maxDelayTrainId} near ${summary.maxDelayLocation}` : "—"}
              deltaTone="neutral"
              icon={TriangleAlert}
            />
            <MetricCard
              label="Fresh Live Readings"
              value={`${summary.liveCoveragePercent}%`}
              delta={`${summary.trackedTrains} trains tracked, rest are showing a last-known reading`}
              deltaTone={summary.liveCoveragePercent >= 70 ? "positive" : "neutral"}
              icon={Radio}
            />
            <MetricCard
              label="Currently Delayed"
              value={`${summary.delayedCount}`}
              delta={`${summary.delayedPercent}% of tracked trains`}
              deltaTone={summary.delayedPercent > 40 ? "negative" : "neutral"}
              icon={Gauge}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Network Average Delay · This Session"
            action={
              delayTrendHistory.length > 0 && (
                <span className="text-[11px] text-on-surface-variant/80">
                  {delayTrendHistory.length} sample{delayTrendHistory.length === 1 ? "" : "s"} · last at{" "}
                  {delayTrendHistory[delayTrendHistory.length - 1].time}
                </span>
              )
            }
          />
          <p className="px-4 pb-1 pt-3 text-[11px] leading-snug text-on-surface-variant/80">
            One real sample per poll, starting from when this page's watcher began running. There's no historical
            network-wide series to draw on, so this builds up live rather than showing an invented full-day curve.
            A near-flat line is real too: it means the network genuinely hasn't shifted much yet this session.
          </p>
          <CardContent>
            {delayTrendHistory.length < 2 ? (
              <EmptyState
                icon={Clock}
                title="Collecting live samples…"
                description="The trend line appears once a couple of polls have landed. Check back in a minute."
              />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={delayTrendHistory} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e2" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#737685" }} stroke="#c3c6d6" minTickGap={30} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#737685" }}
                    stroke="#c3c6d6"
                    width={40}
                    domain={[(min: number) => Math.max(0, Math.floor(min - 1)), (max: number) => Math.ceil(max + 1)]}
                    allowDecimals={false}
                    tickFormatter={(value: number) => `${value}m`}
                  />
                  <Tooltip formatter={(value: number) => [`${Number(value).toFixed(1)} min`, "Network avg delay"]} />
                  <Line
                    type="monotone"
                    dataKey="avgDelayMinutes"
                    name="Network avg delay"
                    stroke="#0052cc"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader title="Delay Causes" />
          <p className="px-4 pb-1 pt-3 text-[11px] leading-snug text-on-surface-variant/80">
            Real, checkable buckets only, never a specific weather/technical split no data source here can actually attribute.
          </p>
          <CardContent>
            {causes.length === 0 ? (
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
          action={
            <DataSourceBadge
              status={trainsError ? "offline" : "live"}
              detail={trainsError ?? `${liveTrains?.length ?? 0} currently-tracked trains`}
            />
          }
        />
        <p className="px-4 pb-1 pt-3 text-[11px] leading-snug text-on-surface-variant/80">
          <span className="font-semibold text-on-background">How to read it:</span> each circle is one tracked
          train, positioned live. Bigger and redder means a longer delay. Where circles overlap, that's several
          delayed trains clustered in the same area right now, not a drawn-on gradient. Same trains as Dashboard's
          "Known Trains" count.
        </p>
        <div className="flex flex-wrap items-center gap-3 px-4 pb-2 text-[11px] text-on-surface-variant">
          <LegendDot colorClass="bg-rail-green" label="On Time" />
          <LegendDot colorClass="bg-rail-amber" label="Minor" />
          <LegendDot colorClass="bg-rail-orange" label="Significant" />
          <LegendDot colorClass="bg-error" label="Severe" />
          <span className="text-on-surface-variant/70">Circle size scales with delay</span>
        </div>
        {!majorStations || !liveTrains ? (
          <div className="p-4">
            <CardSkeleton rows={5} />
          </div>
        ) : (
          <MapContainer
            center={mapView.center}
            zoom={mapView.zoom}
            className="min-h-[380px] flex-1 lg:min-h-[440px]"
            showTypeControl={false}
          >
            <NetworkHeatOverlay trains={liveTrains} />
            {majorStations.map((station) => (
              <StationMarker key={station.code} station={station} />
            ))}
          </MapContainer>
        )}
      </Card>

      <Card>
        <CardHeader title="Busiest Delay Points Right Now" />
        <p className="px-4 pb-1 pt-3 text-[11px] leading-snug text-on-surface-variant/80">
          Currently-tracked delayed trains grouped by where they are right now, ranked by average delay, not a
          fixed named corridor (RailCast has no historical per-section punctuality log to rank those against).
        </p>
        {worstSections.length === 0 ? (
          <EmptyState title="No delayed trains right now" description="Every currently-tracked train is on time." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant/30 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  <th className="px-4 py-2">Location</th>
                  <th className="px-4 py-2 text-right">Avg Delay</th>
                  <th className="px-4 py-2 text-right">Trains Here</th>
                  <th className="px-4 py-2 text-right">Worst Status</th>
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

function LegendDot({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${colorClass}`} />
      {label}
    </span>
  );
}
