import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Standard "title + description (+ optional action)" block at the top of every page. */
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-headline-md text-on-background">{title}</h1>
        {description && (
          <p className="text-body-md text-on-surface-variant">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
