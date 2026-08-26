import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Shown when a list/panel has no data to display (not an error). */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
        <Icon size={20} />
      </div>
      <p className="text-body-md font-semibold text-on-background">{title}</p>
      {description && (
        <p className="max-w-xs text-body-sm text-on-surface-variant">{description}</p>
      )}
      {action}
    </div>
  );
}
