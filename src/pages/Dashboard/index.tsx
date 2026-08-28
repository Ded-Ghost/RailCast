import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Train as TrainIcon,
  CircleCheck,
  Clock,
  TriangleAlert,
  Maximize,
  ZapOff,
  CloudRain,
  Search,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardContent } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { MetricCard } from "@/components/common/MetricCard";
import { MetricCardSkeleton } from "@/components/common/Skeleton";
import { DataSourceBadge } from "@/components/common/LiveIndicator";
import { EmptyState } from "@/components/common/EmptyState";
import { TrainStatusRow } from "@/components/train/TrainStatusRow";
import { RealNetworkMap } from "@/components/map/RealNetworkMap";
import { usePriorityTrains, useTrains } from "@/hooks/useTrains";
import { useAlerts } from "@/hooks/useAlerts";
import { useStations, useAllStations } from "@/hooks/useStations";
import { useAnimatedTrains } from "@/hooks/useAnimatedTrains";
import { useElapsedSeconds } from "@/hooks/useElapsedSeconds";
import { formatAge, formatNumber, formatRelativeTime } from "@/lib/format";
import { getAlertSeverityVisual } from "@/lib/status";
import type { AlertSeverity } from "@/types";

const ALERT_ICONS: Record<AlertSeverity, typeof ZapOff> = {
  critical: ZapOff,
  warning: CloudRain,
  info: TrainIcon,
  success: CircleCheck,
} as const;

export default function Dashboard() {
  const { data: priorityTrains, isLoading: isLoadingTrains } = usePriorityTrains(4);
  const { data: allTrains, isRefreshing, lastUpdatedAt, error: trainsError } = useTrains();
  const { data: majorStations } = useStations();
  const { data: allStations } = useAllStations();
  const animatedTrains = useAnimatedTrains(allTrains ?? []);
  const { data: alerts, isLoading: isLoadingAlerts } = useAlerts();
  const [mapExpanded, setMapExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  // Ticks once a second so a stalled backend is visible rather than silent.
  const secondsSinceRefresh = useElapsedSeconds(lastUpdatedAt ?? Date.now());

  const networkAlerts = (alerts ?? []).filter((a) => a.category === "critical").slice(0, 2);

  const totalTrains = allTrains?.length ?? 0;
  const onTimeCount = allTrains?.filter((t) => t.delayStatus === "on-time").length ?? 0;
  const delayedCount = allTrains?.filter((t) => t.delayStatus !== "on-time").length ?? 0;
  const criticalCount = allTrains?.filter((t) => t.delayStatus === "severe").length ?? 0;
  const onTimePct = totalTrains > 0 ? Math.round((onTimeCount / totalTrains) * 100) : 0;
  const delayedPct = totalTrains > 0 ? Math.round((delayedCount / totalTrains) * 100) : 0;
  const criticalPct = totalTrains > 0 ? Math.round((criticalCount / totalTrains) * 100) : 0;
  // The live feed doesn't always have a fresh reading for every train — a
  // stale one keeps reporting its last snapshot, often a flat "on time".
  // Counted separately so the KPI row doesn't imply more confirmed-on-time
  // trains than were actually rechecked recently.
  const staleCount = allTrains?.filter((t) => t.liveFeedStale).length ?? 0;

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) navigate(`/train-search?q=${encodeURIComponent(q)}`);
    else navigate("/train-search");
  }

  return (
    <PageContainer>
      <PageHeader
        title="Network Dashboard"
        description="Live Indian Railways operational overview: published timetables joined to today's running status."
        action={
          <div className="flex flex-col items-end gap-1">
            <DataSourceBadge
              status={trainsError ? "offline" : "live"}
              detail={trainsError ?? "erail.in timetable + rappid.in running status"}
            />
            <span className="font-body text-data-mono text-[11px] text-on-surface-variant/80">
              {isRefreshing
                ? "Refreshing…"
                : lastUpdatedAt
                  ? `Last refreshed ${formatAge(secondsSinceRefresh)} ago`
                  : "Awaiting first refresh"}
            </span>
          </div>
        }
      />

      {/* Quick search */}
      <form onSubmit={handleSearch} className="flex max-w-lg gap-2">
        <div className="relative flex-1">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Track any train: enter number (e.g. 12301) or name"
            className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest pl-10 pr-4 text-body-md text-on-surface shadow-card placeholder:text-on-surface-variant/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <Button type="submit" variant="primary" size="md">Track</Button>
      </form>

      {/* KPI Row — computed from real backend data */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Known Trains"
          value={formatNumber(totalTrains)}
          delta="live-tracked"
          deltaTone="neutral"
          icon={TrainIcon}
        />
        <MetricCard
          label="On Time"
          value={formatNumber(onTimeCount)}
          delta={`${onTimePct}%`}
          deltaTone="positive"
          icon={CircleCheck}
          accentColorClass="bg-rail-green"
        />
        <MetricCard
          label="Delayed"
          value={formatNumber(delayedCount)}
          delta={`${delayedPct}%`}
          deltaTone="neutral"
          icon={Clock}
          accentColorClass="bg-rail-amber"
        />
        <MetricCard
          label="Critical"
          value={formatNumber(criticalCount)}
          delta={`${criticalPct}%`}
          deltaTone="negative"
          icon={TriangleAlert}
          accentColorClass="bg-error"
        />
      </div>
      {staleCount > 0 && (
        <p className="-mt-2 text-body-sm text-on-surface-variant/80">
          {staleCount} of {totalTrains} train{staleCount === 1 ? "" : "s"} above {staleCount === 1 ? "has" : "have"} a
          stale live reading (feed hasn't rechecked recently). Its "On Time" may just mean no fresher data exists yet.
        </p>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:auto-rows-fr">
        <Card className="xl:col-span-2">
          <CardHeader
            title={
              <>
                Network Snapshot
                <DataSourceBadge status="live" detail="Positions interpolated from live running status" className="ml-2" />
              </>
            }
            action={
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="px-2"
                  aria-label="Expand map"
                  onClick={() => setMapExpanded((v) => !v)}
                >
                  <Maximize size={16} />
                </Button>
              </div>
            }
          />
          <RealNetworkMap
            trains={animatedTrains}
            majorStations={majorStations ?? []}
            allStations={allStations ?? []}
            onSelectTrain={(trainId: string) => navigate(`/trains/${trainId}`)}
            className={mapExpanded ? "min-h-[560px] flex-1" : "min-h-[420px] flex-1"}
          />
        </Card>

        <div className="flex flex-col gap-6 xl:col-span-1">
          <Card className="flex-1">
            <CardHeader
              title="Most Delayed Trains"
              action={
                <Link to="/train-search" className="text-label-md font-semibold text-primary hover:text-primary-container">
                  View All
                </Link>
              }
            />
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {isLoadingTrains ? (
                <div className="flex flex-col gap-3 p-4">
                  <MetricCardSkeleton />
                  <MetricCardSkeleton />
                </div>
              ) : priorityTrains && priorityTrains.length > 0 ? (
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="sticky top-0 z-10 bg-surface-container-low text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                      <th className="px-4 py-2">Train</th>
                      <th className="px-4 py-2 text-right">Delay</th>
                      <th className="px-4 py-2 text-right">ETA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20 font-body text-data-mono">
                    {priorityTrains.map((train) => (
                      <TrainStatusRow key={train.id} train={train} />
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState title="No trains loaded" description="Enter a train number above to start tracking." />
              )}
            </div>
          </Card>

          <Card className="min-h-[200px]">
            <CardHeader
              title={
                <>
                  <TriangleAlert size={20} className="text-error" />
                  System Alerts
                </>
              }
            />
            <CardContent className="flex flex-col gap-3">
              {isLoadingAlerts ? (
                <>
                  <MetricCardSkeleton />
                  <MetricCardSkeleton />
                </>
              ) : networkAlerts.length > 0 ? (
                networkAlerts.map((alert) => {
                  const visual = getAlertSeverityVisual(alert.severity);
                  const Icon = ALERT_ICONS[alert.severity];
                  return (
                    <Link
                      key={alert.id}
                      to="/alerts"
                      className={`group relative flex items-start gap-3 overflow-hidden rounded-lg border p-3 transition-colors ${visual.borderClass} ${visual.bgSoftClass} hover:brightness-95`}
                    >
                      <div className={`absolute bottom-0 left-0 top-0 w-1 ${visual.dotClass}`} />
                      <Icon size={20} className={`mt-0.5 ${visual.textClass}`} />
                      <div className="flex flex-1 flex-col gap-0.5">
                        <span className={`text-label-md font-bold ${visual.textClass}`}>{alert.title}</span>
                        <span className="text-body-sm text-on-surface-variant">{alert.message}</span>
                        <span className="mt-1 text-[10px] uppercase tracking-wider text-on-surface-variant/70">
                          {formatRelativeTime(alert.timestamp)}
                        </span>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <EmptyState title="No active alerts" description="The network is operating normally." />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
