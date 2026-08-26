import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CircleHelp, Grip, Menu, Search, UserRound } from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { useNetworkStore } from "@/store/useNetworkStore";
import { cn } from "@/lib/cn";

export interface TopHeaderProps {
  /**
   * Optional breadcrumb/title override for the left side of the header —
   * used by pages like Train Details ("Train Search / 12345 Rajdhani
   * Express"). Falls back to the RailCast wordmark + global search.
   */
  breadcrumb?: ReactNode;
}

/**
 * Fixed 56px top header. Always visible regardless of page; hosts global
 * search, notifications, help, and the account menu per DESIGN.md.
 */
export function TopHeader({ breadcrumb }: TopHeaderProps) {
  const openMobileNav = useUIStore((state) => state.openMobileNav);
  const unreadAlertCount = useNetworkStore(
    (state) => state.alerts.filter((alert) => !alert.read).length,
  );
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  function handleSearchSubmit(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    navigate(`/train-search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-30 flex h-header-height items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-4 shadow-sm lg:left-sidebar-width lg:px-6">
      <div className="flex flex-1 items-center gap-4">
        <button
          type="button"
          onClick={openMobileNav}
          className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>

        {breadcrumb ?? (
          <span className="font-display text-headline-sm font-bold text-primary">
            RailCast Intelligence
          </span>
        )}

        <form onSubmit={handleSearchSubmit} className="relative ml-4 hidden w-64 md:block">
          <Search
            size={18}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search trains, stations, alerts..."
            className="h-8 w-full rounded border border-outline-variant bg-surface pl-9 pr-3 text-body-sm text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </form>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          className="relative rounded p-1.5 text-on-surface-variant transition-all hover:bg-surface-container-high hover:text-primary active:scale-90"
          aria-label="Notifications"
          onClick={() => navigate("/alerts")}
        >
          <Bell size={20} />
          {unreadAlertCount > 0 && (
            <span
              className={cn(
                "absolute right-1 top-1 h-2 w-2 rounded-full bg-error",
                unreadAlertCount > 0 && "block",
              )}
            />
          )}
        </button>
        <button
          type="button"
          className="rounded p-1.5 text-on-surface-variant transition-all hover:bg-surface-container-high hover:text-primary active:scale-90"
          aria-label="Help"
        >
          <CircleHelp size={20} />
        </button>
        <button
          type="button"
          className="hidden rounded p-1.5 text-on-surface-variant transition-all hover:bg-surface-container-high hover:text-primary active:scale-90 sm:inline-flex"
          aria-label="Apps"
        >
          <Grip size={20} />
        </button>
        <button
          type="button"
          className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant bg-primary-container/10 text-primary"
          aria-label="Account"
        >
          <UserRound size={18} />
        </button>
      </div>
    </header>
  );
}
