import { useEffect, type ReactNode } from "react";
import { Clock, OctagonAlert, Pause, Play, RotateCcw, TrendingUp } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/common/Card";
import { MetricCard } from "@/components/common/MetricCard";
import { EmptyState } from "@/components/common/EmptyState";
import { CardSkeleton } from "@/components/common/Skeleton";
import { DataSourceBadge } from "@/components/common/LiveIndicator";
import { MapContainer, RouteOverlay, StationMarker, TrainMarker } from "@/components/map";
import { useCorridorStations, useRailwaySections } from "@/hooks/useRouteMonitor";
import { useCurrentWeather } from "@/hooks/useCurrentWeather";
import { useSimulationLabStore } from "@/store/useSimulationLabStore";
import { runScenario, buildScenarioTrainMarker } from "@/simulation/simulationLabEngine";
import { formatDelay } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { CongestionLevel, DwellTime, PlaybackSpeed, WeatherCondition } from "@/types";

const CORRIDOR_MAP_CENTER = { lat: 23.7, lng: 82.5 };
const CORRIDOR_MAP_ZOOM = 5;

const RISK_TONE_CLASS: Record<number, string> = {
  1: "text-rail-green",
  2: "text-rail-green",
  3: "text-rail-amber",
  4: "text-rail-orange",
  5: "text-error",
};

/** On-time or early is always shown as good, regardless of magnitude; only a positive (late) impact escalates through the amber→red scale. */
function delayImpactToneClass(etaImpactMinutes: number): string {
  if (etaImpactMinutes <= 0) return RISK_TONE_CLASS[1];
  const level = Math.min(5, Math.max(2, Math.ceil(etaImpactMinutes / 10) + 1));
  return RISK_TONE_CLASS[level];
}

export default function SimulationLab() {
  const { data: stations } = useCorridorStations();
  const { data: sections } = useRailwaySections();
  const state = useSimulationLabStore();
  const play = useSimulationLabStore((s) => s.play);

  const stationNameByCode = new Map((stations ?? []).map((station) => [station.code, station.name]));

  // The store only persists the subset of scenario output that feeds the
  // control panel / result cards (see useSimulationLabStore's DerivedFields).
  // The map marker needs the fuller ScenarioOutput (position, delay status),
  // so it's recomputed here from the same current inputs — runScenario is a
  // cheap pure function, so this is not meaningfully redundant work.
  const scenarioOutput = runScenario(state);
  const scenarioTrainMarker = buildScenarioTrainMarker(scenarioOutput);

  const currentStation = (stations ?? []).find((station) => station.code === scenarioOutput.currentStationCode) ?? null;
  const weatherTarget = currentStation
    ? { stationCode: currentStation.code, stationName: currentStation.name, position: currentStation.position }
    : null;
  const { data: weather, status: weatherStatus, isLoading: isLoadingWeather } = useCurrentWeather(weatherTarget);

  // Auto-starts playback on first visit, mirroring the original mockup's
  // "already running" demo state — the same pattern Train Details uses to
  // kick off its own live feed (see hooks/useTrains.ts's useTrain). `play`
  // is a stable reference (selected directly from the store), so this
  // effect genuinely only fires once.
  useEffect(() => {
    play();
  }, [play]);

  return (
    <PageContainer>
      <PageHeader
        title="Simulation Lab"
        description="Predictive modeling and what-if scenario analysis for any train or route."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
        {/* LEFT: scenario controls */}
        <Card className="xl:col-span-1">
          <CardHeader title="Scenario Controls" />
          <CardContent className="flex flex-col gap-5">
            <Field label="Train">
              <select
                className="h-9 rounded border border-outline-variant bg-surface-container-lowest px-3 text-body-md text-on-surface focus:border-primary focus:outline-none"
                value={state.trainId}
                disabled
              >
                <option value={state.trainId}>12345 Rajdhani Exp</option>
              </select>
            </Field>

            <Field label="Target Speed" value={`${state.targetSpeedKmh} km/h`}>
              <input
                type="range"
                min={40}
                max={120}
                step={1}
                value={state.targetSpeedKmh}
                onChange={(event) => state.setTargetSpeed(Number(event.target.value))}
                className="w-full accent-primary"
              />
            </Field>

            <Field label="Section Congestion">
              <SegmentedControl<CongestionLevel>
                value={state.congestionLevel}
                onChange={state.setCongestionLevel}
                options={[
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Med" },
                  { value: "high", label: "High" },
                ]}
              />
            </Field>

            <Field label="Station Dwell Time">
              <SegmentedControl<DwellTime>
                value={state.stationDwellTime}
                onChange={state.setStationDwellTime}
                options={[
                  { value: "normal", label: "Normal" },
                  { value: "increased", label: "Increased" },
                ]}
              />
            </Field>

            <Field label="Weather Conditions">
              <select
                className="h-9 rounded border border-outline-variant bg-surface-container-lowest px-3 text-body-md text-on-surface focus:border-primary focus:outline-none"
                value={state.weatherCondition}
                onChange={(event) => state.setWeatherCondition(event.target.value as WeatherCondition)}
              >
                <option value="Clear">Clear</option>
                <option value="Rain">Rain</option>
                <option value="Fog">Fog</option>
              </select>
              <p className="mt-1 text-[11px] text-on-surface-variant/80">
                This is a what-if input for the scenario, not a forecast — see real conditions below.
              </p>
            </Field>

            <div className="rounded-md border border-outline-variant/60 bg-surface-container-low p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/80">
                  Real conditions {currentStation ? `at ${currentStation.name}` : ""}
                </span>
                <DataSourceBadge status={weatherStatus} />
              </div>
              {isLoadingWeather && !weather ? (
                <p className="mt-1 text-body-sm text-on-surface-variant">Fetching…</p>
              ) : weather ? (
                <p className="mt-1 text-body-sm text-on-background">
                  {weather.conditionLabel} · {Math.round(weather.temperatureCelsius)}°C · wind{" "}
                  {Math.round(weather.windSpeedKmh)} km/h
                </p>
              ) : (
                <p className="mt-1 text-body-sm text-on-surface-variant">Live weather source unavailable.</p>
              )}
            </div>

            <Field label="Current Delay Injection" value={formatDelay(state.delayInjectionMinutes)}>
              <input
                type="range"
                min={-10}
                max={30}
                step={1}
                value={state.delayInjectionMinutes}
                onChange={(event) => state.setDelayInjection(Number(event.target.value))}
                className="w-full accent-error"
              />
            </Field>

            <div className="flex items-center gap-2 border-t border-outline-variant/30 pt-4">
              <IconButton label="Reset" onClick={state.reset}>
                <RotateCcw size={16} />
              </IconButton>
              <IconButton
                label={state.isRunning ? "Pause" : "Play"}
                onClick={state.isRunning ? state.pause : state.play}
                primary
              >
                {state.isRunning ? <Pause size={16} /> : <Play size={16} />}
              </IconButton>
            </div>

            <Field label="Simulation Speed">
              <SegmentedControl<PlaybackSpeed>
                value={state.playbackSpeed}
                onChange={state.setPlaybackSpeed}
                options={[
                  { value: 1, label: "1x" },
                  { value: 2, label: "2x" },
                  { value: 5, label: "5x" },
                ]}
              />
            </Field>
          </CardContent>
        </Card>

        {/* RIGHT: map, results, downstream effects */}
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card className="flex flex-col">
            <CardHeader
              title="Route Simulation: Bhubaneswar → New Delhi"
              action={
                <span className="rounded bg-surface-container-high px-2 py-1 font-body text-data-mono text-[11px] font-semibold text-on-surface-variant">
                  {state.isRunning ? "SIM RUNNING" : "PAUSED"} · {state.elapsedLabel}
                </span>
              }
            />
            {!stations ? (
              <div className="p-4">
                <CardSkeleton rows={6} />
              </div>
            ) : (
              <MapContainer center={CORRIDOR_MAP_CENTER} zoom={CORRIDOR_MAP_ZOOM} className="min-h-[360px] flex-1 lg:min-h-[420px]">
                <RouteOverlay stations={stations} sections={sections ?? undefined} />
                {stations.map((station) => (
                  <StationMarker key={station.code} station={station} />
                ))}
                {scenarioTrainMarker && <TrainMarker train={scenarioTrainMarker} selected pulse={state.isRunning} />}
              </MapContainer>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard label="Simulated ETA" value={state.simulatedEta} icon={Clock} />
            <MetricCard label="ETA Impact" value={formatDelay(state.etaImpactMinutes)} icon={TrendingUp} />
            <MetricCard label="Bottleneck Risk" value={`Level ${state.bottleneckRiskLevel}`} icon={OctagonAlert} />
          </div>

          <Card>
            <CardHeader title="Downstream Effects" />
            <CardContent>
              {state.stationForecast.length === 0 ? (
                <EmptyState title="No downstream stations" description="The train has reached the end of the corridor." />
              ) : (
                <div className="flex flex-col divide-y divide-outline-variant/20">
                  {state.stationForecast.map((point) => (
                    <div key={point.stationCode} className="flex items-center justify-between py-2">
                      <span className="text-body-sm font-medium text-on-background">
                        {stationNameByCode.get(point.stationCode) ?? point.stationCode}
                      </span>
                      <span
                        className={cn(
                          "font-body text-data-mono text-body-sm font-semibold",
                          delayImpactToneClass(point.etaImpactMinutes),
                        )}
                      >
                        {formatDelay(point.etaImpactMinutes)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

function Field({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-body-sm font-semibold text-on-surface-variant">{label}</span>
        {value && <span className="font-body text-data-mono text-body-sm font-semibold text-on-background">{value}</span>}
      </div>
      {children}
    </div>
  );
}

function SegmentedControl<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-outline-variant">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 px-3 py-1.5 text-body-sm font-semibold transition-colors",
            value === option.value
              ? "bg-primary text-on-primary"
              : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
  primary = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded transition-colors",
        primary
          ? "bg-primary text-on-primary hover:bg-primary-container"
          : "border border-outline-variant text-on-surface-variant hover:bg-surface-container-high",
      )}
    >
      {children}
    </button>
  );
}
