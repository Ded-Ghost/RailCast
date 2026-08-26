import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "./TopHeader";

export interface AppShellProps {
  children: ReactNode;
  headerBreadcrumb?: ReactNode;
}

/**
 * The application "cockpit": fixed sidebar + fixed header + routed page
 * content. Every route renders inside this shell (see App.tsx) so the
 * navigation frame never remounts between page transitions.
 */
export function AppShell({ children, headerBreadcrumb }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <TopHeader breadcrumb={headerBreadcrumb} />
      {children}
    </div>
  );
}
