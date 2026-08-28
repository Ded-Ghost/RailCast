import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Gauge, MapPin, X } from "lucide-react";
import type { Train } from "@/types";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatDelay, formatClockTime, formatSpeed } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useSettingsStore } from "@/store/useSettingsStore";

export interface TrainInfoPanelProps {
  train: Train;
  onClose?: () => void;
  className?: string;
}

/**
 * Compact train summary shown when a map marker is selected. Deliberately
 * terse — full telemetry, route intelligence, and prediction breakdown
 * live on Train Details, which this links out to.
 */
export function TrainInfoPanel({ train, onClose, className }: TrainInfoPanelProps) {
  const speedUnit = useSettingsStore((s) => s.speedUnit);
  const timeFormat = useSettingsStore((s) => s.timeFormat);
  return (
    <div className={cn("flex flex-col gap-4 p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className="rounded bg-primary-container/10 px-2 py-0.5 font-body text-data-mono font-semibold text-primary">
            {train.id}
          </span>
          <span className="font-display text-headline-sm text-on-background">{train.name}</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Clear selection"
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
        <span>{train.originName}</span>
        <ArrowRight size={14} />
        <span>{train.destinationName}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Delay" value={<StatusBadge status={train.delayStatus} label={formatDelay(train.delayMinutes)} />} />
        <Stat
          label="Predicted ETA"
          value={<span className="font-body text-data-mono">{formatClockTime(train.predictedEta, timeFormat)}</span>}
        />
        <Stat
          label="Current Location"
          value={
            <span className="flex items-center gap-1">
              <MapPin size={12} className="text-on-surface-variant" />
              {train.currentStationName}
            </span>
          }
        />
        <Stat
          label="Speed"
          value={
            <span className="flex items-center gap-1">
              <Gauge size={12} className="text-on-surface-variant" />
              {formatSpeed(train.currentSpeedKmh, speedUnit)}
            </span>
          }
        />
      </div>

      <Link
        to={`/trains/${train.id}`}
        className="mt-1 flex h-9 items-center justify-center rounded bg-primary text-body-md font-medium text-on-primary transition-colors hover:bg-primary-container"
      >
        View Full Details
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/80">
        {label}
      </span>
      <span className="text-body-md font-semibold text-on-background">{value}</span>
    </div>
  );
}
