import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, CircleHelp, Menu, Radio, Search, Settings as SettingsIcon, UserRound } from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { useNetworkStore } from "@/store/useNetworkStore";
import { cn } from "@/lib/cn";

/** Closes an open popover on an outside click or Escape — shared by the Help and Account menus below. */
function useDismissablePopover(onDismiss: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handlePointer(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss();
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onDismiss]);
  return ref;
}

export interface TopHeaderProps {
  /**
   * Optional breadcrumb/title override for the left side of the header —
   * used by pages like Train Details ("Train Search / 12301 Rajdhani
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
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const navigate = useNavigate();

  const helpRef = useDismissablePopover(() => setIsHelpOpen(false));
  const accountRef = useDismissablePopover(() => setIsAccountOpen(false));

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
        <div ref={helpRef} className="relative">
          <button
            type="button"
            className="rounded p-1.5 text-on-surface-variant transition-all hover:bg-surface-container-high hover:text-primary active:scale-90"
            aria-label="Help"
            aria-expanded={isHelpOpen}
            onClick={() => {
              setIsHelpOpen((v) => !v);
              setIsAccountOpen(false);
            }}
          >
            <CircleHelp size={20} />
          </button>
          {isHelpOpen && (
            <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 text-body-sm shadow-popover">
              <p className="font-display text-headline-sm text-on-background">About RailCast</p>
              <p className="mt-1.5 text-on-surface-variant">
                Live train positions and ETAs join two public feeds: erail.in for published timetables and rappid.in
                for running status. Delay predictions layer momentum, live weather and known structural bottlenecks
                on top of that — see Train Details' prediction breakdown for the factors behind any one train.
              </p>
              <div className="mt-3 flex items-center gap-1.5 border-t border-outline-variant/40 pt-3 text-on-surface-variant">
                <Radio size={14} />
                <span>A live feed can go quiet without erroring — a stale-clock icon next to a delay means it's a last-known reading, not a fresh one.</span>
              </div>
              <Link
                to="/settings"
                onClick={() => setIsHelpOpen(false)}
                className="mt-3 flex items-center gap-1.5 text-label-md font-semibold text-primary hover:text-primary-container"
              >
                <SettingsIcon size={14} /> Open System Settings
              </Link>
            </div>
          )}
        </div>

        <div ref={accountRef} className="relative ml-1">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant bg-primary-container/10 text-primary"
            aria-label="Account"
            aria-expanded={isAccountOpen}
            onClick={() => {
              setIsAccountOpen((v) => !v);
              setIsHelpOpen(false);
            }}
          >
            <UserRound size={18} />
          </button>
          {isAccountOpen && (
            <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 text-body-sm shadow-popover">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant bg-primary-container/10 text-primary">
                  <UserRound size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-on-background">Guest Operator</span>
                  <span className="text-body-sm text-on-surface-variant/80">Open demo session</span>
                </div>
              </div>
              <p className="mt-3 border-t border-outline-variant/40 pt-3 text-on-surface-variant">
                RailCast runs without an account system — every visitor sees the same live network view. Display
                preferences (theme, units, alerts) are saved to this browser via Settings.
              </p>
              <Link
                to="/settings"
                onClick={() => setIsAccountOpen(false)}
                className="mt-3 flex items-center gap-1.5 text-label-md font-semibold text-primary hover:text-primary-container"
              >
                <SettingsIcon size={14} /> Open System Settings
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
