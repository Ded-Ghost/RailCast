import { useEffect, useState } from "react";
import { Moon, Sun, Monitor, RefreshCw, Bell, Globe2, Activity, Check } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardContent } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { cn } from "@/lib/cn";
import { useSettingsStore, type ThemePreference } from "@/store/useSettingsStore";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "") + "/api";

interface HealthSnapshot {
  ok: boolean;
  version: string;
  uptimeSeconds: number;
  browseList: { cached: number; ageSeconds: number | null };
  stations: { total: number; major: number };
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-0 outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest",
        checked ? "bg-primary" : "bg-surface-container-high",
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute left-0.5 h-5 w-5 rounded-full bg-surface-container-lowest shadow-card transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}

function SettingRow({ title, description, control }: { title: string; description: string; control: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-body-md font-semibold text-on-background">{title}</span>
        <span className="text-body-sm text-on-surface-variant">{description}</span>
      </div>
      {control}
    </div>
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System Match", icon: Monitor },
];

const REFRESH_OPTIONS = [15, 30, 60, 120];

export default function Settings() {
  const settings = useSettingsStore();
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/health`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json) => {
        if (!cancelled && json.success) setHealth(json.data);
      })
      .catch(() => {
        if (!cancelled) setHealthError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSave() {
    // Every control below already writes straight to the persisted store on
    // change — there is nothing left to flush. This just confirms that to
    // the user, since a Settings page with no "Save" affordance at all reads
    // as broken even when changes are already durable.
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  }

  return (
    <PageContainer>
      <PageHeader
        title="System Settings"
        description="Configure RailCast operational parameters and display preferences."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Appearance" />
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                Interface Theme
              </span>
              <div className="flex gap-2">
                {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => settings.setTheme(value)}
                    className={cn(
                      "flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-body-sm font-medium outline-none transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest",
                      settings.theme === value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low",
                    )}
                  >
                    <Icon size={18} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                Map Visualization
              </span>
              <select
                value={settings.mapVisualization}
                onChange={(e) => settings.setMapVisualization(e.target.value as "standard" | "minimal")}
                className="h-10 rounded border border-outline-variant bg-surface-container-lowest px-3 text-body-md text-on-surface focus:border-primary focus:outline-none"
              >
                <option value="standard">Standard (train icons, full detail)</option>
                <option value="minimal">Minimal (plain status dots)</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title={
              <>
                <Bell size={18} className="text-on-surface-variant" />
                Alert Configuration
              </>
            }
          />
          <CardContent className="flex flex-col gap-5">
            <SettingRow
              title="Critical Delay Alerts"
              description="Generate alerts when a train's delay crosses into significant/severe territory."
              control={
                <Switch
                  checked={settings.criticalDelayAlerts}
                  onChange={settings.toggleCriticalDelayAlerts}
                  label="Critical Delay Alerts"
                />
              }
            />
            <SettingRow
              title="Audio Prompts"
              description="Play a short tone when a critical alert fires."
              control={
                <Switch checked={settings.audioPrompts} onChange={settings.toggleAudioPrompts} label="Audio Prompts" />
              }
            />
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-body-md font-semibold text-on-background">ETA Change Threshold</span>
                <span className="font-body text-data-mono text-primary">±{settings.etaChangeThresholdMinutes} mins</span>
              </div>
              <input
                type="range"
                min={1}
                max={15}
                value={settings.etaChangeThresholdMinutes}
                onChange={(e) => settings.setEtaChangeThresholdMinutes(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <span className="text-body-sm text-on-surface-variant">
                Minimum ETA drift, in either direction, worth surfacing as an "ETA Changed" alert.
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title={
              <>
                <RefreshCw size={18} className="text-on-surface-variant" />
                Data Synchronization
              </>
            }
          />
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                Live Refresh Interval
              </span>
              <select
                value={settings.refreshIntervalSeconds}
                onChange={(e) => settings.setRefreshIntervalSeconds(Number(e.target.value))}
                className="h-10 rounded border border-outline-variant bg-surface-container-lowest px-3 text-body-md text-on-surface focus:border-primary focus:outline-none"
              >
                {REFRESH_OPTIONS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds} Seconds {seconds === 30 ? "(Standard)" : seconds < 30 ? "(Fast)" : "(Relaxed)"}
                  </option>
                ))}
              </select>
              <span className="text-body-sm text-on-surface-variant">
                Faster intervals call the backend more often; every live poll on the app follows this setting.
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title={
              <>
                <Globe2 size={18} className="text-on-surface-variant" />
                Localization
              </>
            }
          />
          <CardContent className="flex flex-col gap-5">
            <SettingRow
              title="Speed Units"
              description="Applied to speed figures on Train Details, Train Search and Route Monitor."
              control={
                <div className="flex overflow-hidden rounded border border-outline-variant">
                  {(["kmh", "mph"] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => settings.setSpeedUnit(unit)}
                      className={cn(
                        "px-3 py-1.5 text-body-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                        settings.speedUnit === unit
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low",
                      )}
                    >
                      {unit === "kmh" ? "km/h" : "mph"}
                    </button>
                  ))}
                </div>
              }
            />
            <SettingRow
              title="Time Format"
              description="Applied to ETA and schedule times on Train Details, Train Search and Predictions."
              control={
                <div className="flex overflow-hidden rounded border border-outline-variant">
                  {(["24h", "12h"] as const).map((format) => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => settings.setTimeFormat(format)}
                      className={cn(
                        "px-3 py-1.5 text-body-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                        settings.timeFormat === format
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low",
                      )}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              }
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title={
              <>
                <Activity size={18} className="text-on-surface-variant" />
                System Status
              </>
            }
          />
          <CardContent>
            {healthError ? (
              <p className="text-body-sm text-error">Backend unreachable — start the RailCast server to see live status.</p>
            ) : !health ? (
              <p className="text-body-sm text-on-surface-variant">Checking backend…</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                    Backend
                  </span>
                  <span className="flex items-center gap-1.5 text-body-md font-semibold text-rail-green">
                    <span className="h-2 w-2 rounded-full bg-rail-green" /> Online — v{health.version}
                  </span>
                  <span className="text-body-sm text-on-surface-variant">Up {Math.round(health.uptimeSeconds / 60)} min</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                    Prediction Engine
                  </span>
                  <span className="text-body-md font-semibold text-on-background">heuristic-v3</span>
                  <span className="text-body-sm text-on-surface-variant">Momentum + weather + structural risk</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                    Browse List
                  </span>
                  <span className="text-body-md font-semibold text-on-background">{health.browseList.cached} trains cached</span>
                  <span className="text-body-sm text-on-surface-variant">
                    {health.browseList.ageSeconds !== null ? `Refreshed ${health.browseList.ageSeconds}s ago` : "Building…"}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="md" onClick={settings.resetToDefaults}>
          Reset to Defaults
        </Button>
        <Button variant="primary" size="md" onClick={handleSave}>
          {savedFlash ? (
            <>
              <Check size={16} /> Saved
            </>
          ) : (
            "Save Configuration"
          )}
        </Button>
      </div>
    </PageContainer>
  );
}
