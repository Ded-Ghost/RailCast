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
