import { BellRing, CircleCheck, CloudRain, TrainFront, ZapOff } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { CardSkeleton } from "@/components/common/Skeleton";
import { useAlerts } from "@/hooks/useAlerts";
import { useNetworkStore } from "@/store/useNetworkStore";
import { getAlertSeverityVisual } from "@/lib/status";
import { formatRelativeTime } from "@/lib/format";
import type { AlertSeverity } from "@/types";

const ALERT_ICONS: Record<AlertSeverity, typeof BellRing> = {
  critical: ZapOff,
  warning: CloudRain,
  info: TrainFront,
  success: CircleCheck,
};

export default function Alerts() {
  const { data: alerts, isLoading } = useAlerts();
  const markAllAlertsRead = useNetworkStore((state) => state.markAllAlertsRead);
  const markAlertRead = useNetworkStore((state) => state.markAlertRead);

  return (
    <PageContainer>
      <PageHeader
        title="Alert Center"
        description="Monitor and manage network notifications."
        action={
          <Button variant="secondary" size="sm" onClick={markAllAlertsRead}>
            Mark All as Read
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <CardSkeleton rows={2} />
          <CardSkeleton rows={2} />
        </div>
      ) : !alerts || alerts.length === 0 ? (
        <Card>
          <EmptyState icon={BellRing} title="No alerts" description="The network is operating normally." />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {alerts.map((alert) => {
            const visual = getAlertSeverityVisual(alert.severity);
            const Icon = ALERT_ICONS[alert.severity];
            return (
              <Card
                key={alert.id}
                className={`relative ${!alert.read ? "" : "opacity-70"}`}
              >
                <div className={`absolute bottom-0 left-0 top-0 w-1 ${visual.dotClass}`} />
                <CardContent className="flex items-start gap-4 pl-5">
                  <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-full ${visual.bgSoftClass} ${visual.textClass}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-headline-sm text-on-background">
                        {alert.title}
                      </span>
                      {alert.trainId && (
                        <span className="rounded bg-surface-container-high px-1.5 py-0.5 text-body-sm text-on-surface-variant">
                          Train {alert.trainId}
                        </span>
                      )}
                    </div>
                    <p className="text-body-md text-on-surface-variant">{alert.message}</p>
                    <span className="text-body-sm text-on-surface-variant/70">
                      {formatRelativeTime(alert.timestamp)}
                    </span>
                  </div>
                  {!alert.read && (
                    <Button variant="secondary" size="sm" onClick={() => markAlertRead(alert.id)}>
                      Mark Read
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
