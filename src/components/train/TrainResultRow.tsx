import { Link } from "react-router-dom";
import { Clock, Gauge, MapPin } from "lucide-react";
import type { Train } from "@/types";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatDelay, formatClockTime, formatSpeed } from "@/lib/format";
import { useSettingsStore } from "@/store/useSettingsStore";

export interface TrainResultRowProps {
  train: Train;
}

/**
 * A single Train Search result. Unlike `TrainStatusRow` (compact table row
 * for dashboard-style lists), this surfaces current location and speed
 * alongside ETA/delay, per the Train Search brief's "prioritize ETA, delay
 * and location" requirement.
 */
export function TrainResultRow({ train }: TrainResultRowProps) {
  const speedUnit = useSettingsStore((s) => s.speedUnit);
  const timeFormat = useSettingsStore((s) => s.timeFormat);
  return (
    <Link
      to={`/trains/${train.id}`}
      className="flex flex-col gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4 shadow-card transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="rounded bg-primary-container/10 px-2 py-0.5 font-body text-data-mono font-semibold text-primary">
            {train.id}
          </span>
          <span className="font-display text-headline-sm text-on-background">{train.name}</span>
        </div>
        <span className="text-body-sm text-on-surface-variant">
          {train.originName} → {train.destinationName}
        </span>
        <div className="flex items-center gap-3 text-body-sm text-on-surface-variant">
          <span className="flex items-center gap-1">
            <MapPin size={13} />
            {train.currentStationName}
          </span>
          <span className="flex items-center gap-1">
            <Gauge size={13} />
            {formatSpeed(train.currentSpeedKmh, speedUnit)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6 sm:flex-col sm:items-end sm:gap-1">
        <div className="flex flex-col sm:items-end">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
            Predicted ETA
          </span>
          <span className="font-body text-headline-sm text-data-mono text-on-background">
            {formatClockTime(train.predictedEta, timeFormat)}
          </span>
        </div>
        <span className="flex items-center gap-1.5">
          <StatusBadge status={train.delayStatus} label={formatDelay(train.delayMinutes)} />
          {train.liveFeedStale && (
            <span title="Live feed hasn't rechecked this train recently, reading may be outdated">
              <Clock size={13} className="text-on-surface-variant/70" aria-hidden="true" />
            </span>
          )}
        </span>
      </div>
    </Link>
  );
}
