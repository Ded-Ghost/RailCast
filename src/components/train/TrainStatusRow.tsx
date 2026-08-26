import { Link } from "react-router-dom";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { Train } from "@/types";
import { getStatusVisual } from "@/lib/status";
import { formatDelayCompact } from "@/lib/format";
import { cn } from "@/lib/cn";

export interface TrainStatusRowProps {
  train: Train;
}

/**
 * A single row in a train list/table: id + name, delay chip, ETA.
 * Matches the "Priority Trains" table from the Stitch dashboard —
 * reused anywhere a compact train summary is needed (Live Network list,
 * Route Monitor, search results).
 */
export function TrainStatusRow({ train }: TrainStatusRowProps) {
  const visual = getStatusVisual(train.delayStatus);
  const isOnTime = train.delayMinutes <= 0;
  const DeltaIcon = train.delayMinutes > 0 ? ArrowUp : ArrowDown;

  return (
    <tr className="group relative cursor-pointer transition-colors hover:bg-surface-bright">
      <td className="relative px-4 py-3">
        <div
          className={cn(
            "absolute bottom-0 left-0 top-0 w-0.5 opacity-0 transition-opacity group-hover:opacity-100",
            visual.dotClass,
          )}
        />
        <Link to={`/trains/${train.id}`} className="flex flex-col">
          <span className="font-medium text-on-background">{train.id}</span>
          <span className="w-24 truncate text-body-sm text-on-surface-variant">
            {train.shortName}
          </span>
        </Link>
      </td>
      <td className="px-4 py-3 text-right">
        {isOnTime ? (
          <span className="text-body-sm font-bold text-rail-green">
            {train.delayMinutes === 0 ? "On Time" : "Early"}
          </span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-body-sm font-bold",
              visual.textClass,
              visual.bgSoftClass,
            )}
          >
            <DeltaIcon size={12} />
            {formatDelayCompact(train.delayMinutes)}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right font-body text-data-mono text-on-surface-variant">
        {train.predictedEta}
      </td>
    </tr>
  );
}
