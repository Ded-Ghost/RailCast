import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemePreference = "light" | "dark" | "system";
export type SpeedUnit = "kmh" | "mph";
export type TimeFormat = "24h" | "12h";
export type MapVisualization = "standard" | "minimal";

interface SettingsStoreState {
  theme: ThemePreference;
  mapVisualization: MapVisualization;
  /** How often the browse list / live status polls refresh, seconds. */
  refreshIntervalSeconds: number;
  criticalDelayAlerts: boolean;
  audioPrompts: boolean;
  /** ETA drift (either direction) worth an "ETA Changed" alert, minutes. */
  etaChangeThresholdMinutes: number;
  speedUnit: SpeedUnit;
  timeFormat: TimeFormat;

  setTheme: (theme: ThemePreference) => void;
  setMapVisualization: (value: MapVisualization) => void;
  setRefreshIntervalSeconds: (seconds: number) => void;
  toggleCriticalDelayAlerts: () => void;
  toggleAudioPrompts: () => void;
  setEtaChangeThresholdMinutes: (minutes: number) => void;
  setSpeedUnit: (unit: SpeedUnit) => void;
  setTimeFormat: (format: TimeFormat) => void;
  resetToDefaults: () => void;
}

const DEFAULTS = {
  theme: "system" as ThemePreference,
  mapVisualization: "standard" as MapVisualization,
  refreshIntervalSeconds: 30,
  criticalDelayAlerts: true,
  audioPrompts: false,
  etaChangeThresholdMinutes: 5,
  speedUnit: "kmh" as SpeedUnit,
  timeFormat: "24h" as TimeFormat,
};

/**
 * Persisted, user-controlled display/behavior preferences — the Settings
 * page reads and writes this directly. Anything that actually changes app
 * behavior (poll cadence, theme, units, alert thresholds) is wired to a
 * real consumer; nothing here is decorative-only.
 */
export const useSettingsStore = create<SettingsStoreState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setTheme: (theme) => set({ theme }),
      setMapVisualization: (mapVisualization) => set({ mapVisualization }),
      setRefreshIntervalSeconds: (refreshIntervalSeconds) => set({ refreshIntervalSeconds }),
      toggleCriticalDelayAlerts: () => set((s) => ({ criticalDelayAlerts: !s.criticalDelayAlerts })),
      toggleAudioPrompts: () => set((s) => ({ audioPrompts: !s.audioPrompts })),
      setEtaChangeThresholdMinutes: (etaChangeThresholdMinutes) => set({ etaChangeThresholdMinutes }),
      setSpeedUnit: (speedUnit) => set({ speedUnit }),
      setTimeFormat: (timeFormat) => set({ timeFormat }),
      resetToDefaults: () => set({ ...DEFAULTS }),
    }),
    { name: "railcast-settings-store" },
  ),
);
