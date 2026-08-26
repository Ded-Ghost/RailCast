import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Train as TrainIcon,
  CircleCheck,
  Clock,
  TriangleAlert,
  Maximize,
  ZapOff,
  CloudRain,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardContent } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { MetricCard } from "@/components/common/MetricCard";
import { MetricCardSkeleton } from "@/components/common/Skeleton";
import { LiveIndicator } from "@/components/common/LiveIndicator";
import { EmptyState } from "@/components/common/EmptyState";
import { TrainStatusRow } from "@/components/train/TrainStatusRow";
import { NetworkMap } from "@/components/map/NetworkMap";
import { usePriorityTrains, useTrains } from "@/hooks/useTrains";
import { useAlerts } from "@/hooks/useAlerts";
import { useStations } from "@/hooks/useStations";
import { networkSummary } from "@/data/networkStats";
import { formatNumber, formatRelativeTime } from "@/lib/format";
import { getAlertSeverityVisual } from "@/lib/status";

const ALERT_ICONS = {
  critical: ZapOff,
  warning: CloudRain,
  info: TrainIcon,
  success: CircleCheck,
} as const;

export default function Dashboard() {
  const { data: priorityTrains, isLoading: isLoadingTrains } = usePriorityTrains(4);
  const { data: allTrains } = useTrains();
  const { data: stations } = useStations();
  const { data: alerts, isLoading: isLoadingAlerts } = useAlerts();
  const [mapExpanded, setMapExpanded] = useState(false);
  const navigate = useNavigate();

  const networkAlerts = (alerts ?? []).filter((alert) => alert.category === "critical").slice(0, 2);

  return (
    <PageContainer>
      <PageHeader
        title="Network Dashboard"
        description="Live operational overview and predictive highlights"
      />

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Active Trains"
          value={formatNumber(networkSummary.activeTrains)}
          delta={`+${networkSummary.activeTrainsDeltaLastHour} from last hour`}
          deltaTone="positive"
          icon={TrainIcon}
        />
        <MetricCard
          label="On Time"
          value={formatNumber(networkSummary.onTimeCount)}
          delta={`${networkSummary.onTimePercent}%`}
          deltaTone="positive"
          icon={CircleCheck}
          accentColorClass="bg-rail-green"
        />
        <MetricCard
          label="Delayed"
          value={formatNumber(networkSummary.delayedCount)}
          delta={`${networkSummary.delayedPercent}%`}
          deltaTone="neutral"
          icon={Clock}
          accentColorClass="bg-rail-amber"
        />
        <MetricCard
          label="Critical"
          value={formatNumber(networkSummary.criticalCount)}
          delta={`${networkSummary.criticalPercent}%`}
          deltaTone="negative"
          icon={TriangleAlert}
          accentColorClass="bg-error"
        />
      </div>

      {/* Main grid: map snapshot + priority trains / alerts */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:auto-rows-fr">
        <Card className="xl:col-span-2">
          <CardHeader
            title={
              <>
                Live Network Snapshot
                <LiveIndicator className="ml-2" />
              </>
            }
            action={
              <div className="flex gap-2">
                <Button variant="secondary" size="sm">
                  Filter
                </Button>
                <Button variant="secondary" size="sm">
                  Layers
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="px-2"
                  aria-label="Expand map"
                  onClick={() => setMapExpanded((value) => !value)}
                >
                  <Maximize size={16} />
                </Button>
              </div>
            }
          />
          <NetworkMap
            trains={allTrains ?? []}
            stations={stations ?? []}
            onSelectTrain={(trainId) => navigate(`/trains/${trainId}`)}
            className={mapExpanded ? "min-h-[560px] flex-1" : "min-h-[420px] flex-1"}
          />
        </Card>

        <div className="flex flex-col gap-6 xl:col-span-1">
          <Card className="flex-1">
            <CardHeader
              title="Priority Trains"
              action={
                <Link
                  to="/train-search"
                  className="text-label-md font-semibold text-primary hover:text-primary-container"
                >
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
                <EmptyState title="No priority trains" description="All trains are running on schedule." />
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
                        <span className={`text-label-md font-bold ${visual.textClass}`}>
                          {alert.title}
                        </span>
                        <span className="text-body-sm text-on-surface-variant">
                          {alert.message}
                        </span>
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

