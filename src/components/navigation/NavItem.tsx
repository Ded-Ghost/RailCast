import { NavLink } from "react-router-dom";
import { cn } from "@/lib/cn";
import type { NavEntry } from "./navConfig";

interface NavItemProps {
  entry: NavEntry;
  onNavigate?: () => void;
}

/**
 * A single sidebar link. Active state matches the Stitch design: primary
 * text color, soft tinted background, and a right-edge accent bar.
 */
export function NavItem({ entry, onNavigate }: NavItemProps) {
  const Icon = entry.icon;

  return (
    <NavLink
      to={entry.path}
      end={entry.path === "/"}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 rounded px-4 py-2 transition-colors",
          isActive
            ? "border-r-2 border-primary bg-secondary-container/30 text-primary"
            : "text-on-surface-variant/70 hover:bg-surface-container-high hover:text-on-surface-variant",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={20}
            strokeWidth={2}
            className={cn(isActive ? "text-primary" : "opacity-80")}
          />
          <span
            className={cn(
              "text-label-md font-body tracking-wide",
              isActive ? "font-semibold" : "font-medium",
            )}
          >
            {entry.label}
          </span>
        </>
      )}
    </NavLink>
  );
}
