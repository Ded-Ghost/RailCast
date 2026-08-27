import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

/**
 * The primary container for intelligence widgets across RailCast.
 * DESIGN.md spec: pure white surface, 1px outline-variant border, 8px
 * radius, very soft diffused shadow. Compose with CardHeader/CardContent
 * for the standard "title + divider + body" pattern seen throughout the
 * Stitch screens. Forwards its ref to the underlying div — needed by
 * anything that wants to scroll a card into view or measure it (e.g.
 * Delay Intelligence's "focus this section on the map" interaction).
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-outline-variant/50 bg-surface-container-lowest shadow-card",
        className,
      )}
      {...props}
    />
  );
});

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: ReactNode;
  action?: ReactNode;
}

export function CardHeader({ title, action, className, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-outline-variant/30 bg-surface-bright px-4 py-4",
        className,
      )}
      {...props}
    >
      <h3 className="flex items-center gap-2 font-display text-headline-sm text-on-background">
        {title}
      </h3>
      {action}
    </div>
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}
