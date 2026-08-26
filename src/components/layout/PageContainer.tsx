import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Wraps every page's content: accounts for the fixed sidebar + header,
 * applies the 24px container padding, and stacks children with the
 * standard content gap. Every page component should render its content
 * inside exactly one PageContainer.
 */
export function PageContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <main
      className={cn(
        "flex min-h-screen flex-col gap-6 pt-header-height lg:ml-sidebar-width",
        "p-container-padding",
        className,
      )}
      {...props}
    />
  );
}
