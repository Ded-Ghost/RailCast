/** Format a signed delay in minutes as "+11 min" / "-4 min" / "On Time". */
export function formatDelay(delayMinutes: number): string {
  if (delayMinutes === 0) return "On Time";
  const sign = delayMinutes > 0 ? "+" : "-";
  return `${sign}${Math.abs(delayMinutes)} min`;
}

/** Compact delay chip text, e.g. "11m" / "-4m". */
export function formatDelayCompact(delayMinutes: number): string {
  if (delayMinutes === 0) return "On Time";
  const sign = delayMinutes > 0 ? "" : "-";
  return `${sign}${Math.abs(delayMinutes)}m`;
}

/** Relative "12 mins ago" style formatting for alert timestamps. */
export function formatRelativeTime(isoTimestamp: string): string {
  const then = new Date(isoTimestamp).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

const KMH_TO_MPH = 0.621371;

/** Renders a km/h figure in the user's chosen speed unit (Settings → Localization). */
export function formatSpeed(speedKmh: number, unit: "kmh" | "mph"): string {
  if (unit === "mph") return `${Math.round(speedKmh * KMH_TO_MPH)} mph`;
  return `${Math.round(speedKmh)} km/h`;
}

/** Renders an "HH:MM" schedule/ETA time in the user's chosen time format (Settings → Localization). */
export function formatClockTime(time: string, format: "24h" | "12h"): string {
  if (format === "24h") return time;
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return time;
  const hour24 = Number(match[1]);
  const minute = match[2];
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute} ${period}`;
}

/**
 * A whole-second age as "42s" / "3m 05s" / "1h 04m", for counters that tick
 * once a second next to live data. Zero-padded below the leading unit so the
 * text keeps a constant width and does not jiggle the layout every second —
 * distinct from `formatRelativeTime`, which rounds to human phrasing and is
 * meant for timestamps that are minutes or hours old.
 */
export function formatAge(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
  }
  const hours = Math.floor(seconds / 3600);
  return `${hours}h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}m`;
}
