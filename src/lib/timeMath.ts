/**
 * "HH:MM" time-of-day arithmetic shared by both simulation engines
 * (trainSimulationEngine for the live Train Details feed,
 * simulationLabEngine for Simulation Lab's what-if scenarios) — kept in
 * one place so a fix or change to how times wrap past midnight only ever
 * needs to happen once.
 */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatMinutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = Math.round(normalized % 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function addMinutesToTime(time: string, minutesToAdd: number): string {
  return formatMinutesToTime(parseTimeToMinutes(time) + minutesToAdd);
}

/** Formats whole seconds as a "T+HH:MM:SS" playback elapsed-time label. */
export function formatElapsedLabel(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `T+${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
