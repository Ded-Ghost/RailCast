import { Train, X } from "lucide-react";
import { NavItem } from "@/components/navigation/NavItem";
import { primaryNavEntries, secondaryNavEntries } from "@/components/navigation/navConfig";
import { LiveIndicator } from "@/components/common/LiveIndicator";
import { useUIStore } from "@/store/useUIStore";
import { cn } from "@/lib/cn";

/**
 * Fixed 240px application sidebar. On mobile it becomes an off-canvas
 * drawer controlled by useUIStore (see AppShell for the toggle button and
 * backdrop). Visual spec: DESIGN.md "Sidebar" section — off-white
 * container background, 20px stroke icons, active item gets a tinted
 * background with a right accent bar.
 */
export function Sidebar() {
  const isMobileNavOpen = useUIStore((state) => state.isMobileNavOpen);
  const closeMobileNav = useUIStore((state) => state.closeMobileNav);

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-on-background/40 lg:hidden"
          onClick={closeMobileNav}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full w-sidebar-width flex-col border-r border-outline-variant bg-surface-container-low py-4 transition-transform duration-200 ease-out",
          "lg:translate-x-0",
          isMobileNavOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Primary navigation"
      >
        <div className="mb-6 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-on-primary shadow-card">
              <Train size={20} strokeWidth={2} />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-display text-headline-sm font-bold text-primary">
                RailCast
              </span>
              <span className="text-label-md font-medium uppercase tracking-wide text-on-surface-variant/80">
                Railway Intelligence
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={closeMobileNav}
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high lg:hidden"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-3">
          <LiveIndicator variant="button" />
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto px-3 scrollbar-thin">
          {primaryNavEntries.map((entry) => (
            <NavItem key={entry.path} entry={entry} onNavigate={closeMobileNav} />
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-outline-variant/30 px-3 pt-4">
          {secondaryNavEntries.map((entry) => (
            <NavItem key={entry.path} entry={entry} onNavigate={closeMobileNav} />
          ))}
        </div>
      </aside>
    </>
  );
}
