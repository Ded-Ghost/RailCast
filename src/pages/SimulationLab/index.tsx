import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Clock, OctagonAlert, Pause, Play, RotateCcw, Search, TrendingUp, TriangleAlert } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/common/Card";
import { MetricCard } from "@/components/common/MetricCard";
import { EmptyState } from "@/components/common/EmptyState";
import { CardSkeleton } from "@/components/common/Skeleton";
import { DataSourceBadge } from "@/components/common/LiveIndicator";
import { MapContainer, RiskPointMarker, RouteOverlay, StationMarker, TrainMarker } from "@/components/map";
import { useCurrentWeather } from "@/hooks/useCurrentWeather";
import { useSimulationLabStore } from "@/store/useSimulationLabStore";
import { useNetworkStore } from "@/store/useNetworkStore";
import { runScenario, buildScenarioTrainMarker } from "@/simulation/simulationLabEngine";
import { getOperationalRiskFactors } from "@/data/operationalRiskFactors";
import { formatDelay } from "@/lib/format";
import { computeBoundsView } from "@/lib/geo";
import { cn } from "@/lib/cn";
import type { CongestionLevel, DwellTime, PlaybackSpeed, Station, WeatherCondition } from "@/types";

const RISK_TONE_CLASS: Record<number, string> = {
  1: "text-rail-green",
  2: "text-rail-green",
  3: "text-rail-amber",
  4: "text-rail-orange",
  5: "text-error",
};

/** On-time or early always reads as good; only positive (late) impact escalates. */
function delayImpactToneClass(etaImpactMinutes: number): string {
  if (etaImpactMinutes <= 0) return RISK_TONE_CLASS[1];
  const level = Math.min(5, Math.max(2, Math.ceil(etaImpactMinutes / 10) + 1));
  return RISK_TONE_CLASS[level];
}

export default function SimulationLab() {
  const state = useSimulationLabStore();
  const loadTrain = useSimulationLabStore((s) => s.loadTrain);
  const [trainInput, setTrainInput] = useState(state.trainId);
  const selectedTrainId = useNetworkStore((s) => s.selectedTrainId);
  const selectTrain = useNetworkStore((s) => s.selectTrain);

  // Opens against whatever train is selected elsewhere in the app (e.g. the
  // one just viewed on Train Details) rather than always the same seed
  // train — and follows it automatically if the selection changes while
  // this page is open. Falls back to the seed only when nothing is loaded
  // yet and nothing else has been selected.
  useEffect(() => {
    const target = selectedTrainId || useSimulationLabStore.getState().trainId;
    if (target !== useSimulationLabStore.getState().trainId || !useSimulationLabStore.getState().route) {
      setTrainInput(target);
      void loadTrain(target);
    }
    // Re-run only when the app-wide selection changes, not on this page's own edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrainId, loadTrain]);

  const scenarioOutput = runScenario({
    targetSpeedKmh: state.targetSpeedKmh,
    congestionLevel: state.congestionLevel,
    stationDwellTime: state.stationDwellTime,
    weatherCondition: state.weatherCondition,
    delayInjectionMinutes: state.delayInjectionMinutes,
    distanceTraveledKm: state.distanceTraveledKm,
    route: state.route,
  });
  const scenarioTrainMarker = buildScenarioTrainMarker(scenarioOutput, state.baseTrain, state.route);

  // The route's own stops are the map's geography — every one carries real
  // coordinates from the published timetable, so this works for any train.
  const routeStations: Station[] = useMemo(
    () =>
      (state.route?.stops ?? [])
        .filter((stop) => stop.position)
        .map((stop) => ({
          code: stop.stationCode,
          name: stop.stationName ?? stop.stationCode,
          position: stop.position!,
          zone: stop.zone ?? undefined,
        })),
    [state.route],
  );

  const stationNameByCode = useMemo(
    () => new Map(routeStations.map((station) => [station.code, station.name])),
    [routeStations],
  );

  // Known, real bottlenecks still ahead on this route — plotted directly on
  // the map, not just described in text. See data/operationalRiskFactors.ts.
  const riskFactors = useMemo(() => getOperationalRiskFactors(state.route?.stops ?? []), [state.route]);
  const riskPositions = riskFactors
    .map((factor) => ({
      factor,
      position: state.route?.stops.find((stop) => stop.stationCode === factor.stationCode)?.position,
    }))
    .filter((entry): entry is { factor: (typeof riskFactors)[number]; position: NonNullable<typeof entry.position> } =>
      Boolean(entry.position),
    );

  // Framed once per route, not on every scenario/playback tick: recentering
  // on the train's live position every second would fight anyone trying to
  // look at the map while it plays, and would keep interrupting tile loads
  // mid-pan. The view shows the whole corridor; the marker moves within it.
  const mapView = useMemo(
    () => computeBoundsView(routeStations.map((station) => station.position)),
    [routeStations],
  );

  const currentStation = routeStations.find((station) => station.code === scenarioOutput.currentStationCode) ?? null;
  const weatherTarget = currentStation
    ? { stationCode: currentStation.code, stationName: currentStation.name, position: currentStation.position }
    : null;
  const { data: weather, status: weatherStatus, isLoading: isLoadingWeather } = useCurrentWeather(weatherTarget);

  function handleLoad(event: FormEvent) {
    event.preventDefault();
    void loadTrain(trainInput);
    selectTrain(trainInput.trim());
  }

  return (
    <PageContainer>
      <PageHeader
        title="Simulation Lab"
        description="Run what-if scenarios against any real train and compare them with how it is actually running today."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
        {/* LEFT: scenario controls */}
        <Card className="xl:col-span-1">
          <CardHeader title="Scenario Controls" />
          <CardContent className="flex flex-col gap-5">
            <Field label="Train">
              <form onSubmit={handleLoad} className="flex gap-2">
                <div className="relative flex-1">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={trainInput}
                    onChange={(event) => setTrainInput(event.target.value)}
                    placeholder="Train number, e.g. 12301"
                    aria-label="Train number to simulate"
                    className="h-9 w-full rounded border border-outline-variant bg-surface-container-lowest pl-8 pr-3 font-body text-data-mono text-body-md text-on-surface placeholder:font-sans placeholder:text-on-surface-variant/70 focus:border-primary focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={state.isLoadingTrain}
                  className="h-9 shrink-0 rounded bg-primary px-3 text-body-sm font-semibold text-on-primary transition-colors hover:bg-primary-container disabled:opacity-60"
                >
                  {state.isLoadingTrain ? "Loading…" : "Load"}
                </button>
              </form>

              {state.trainError ? (
                <p className="mt-1 flex items-start gap-1.5 text-[11px] text-error">
                  <TriangleAlert size={13} className="mt-px shrink-0" />
                  {state.trainError}
                </p>
              ) : state.trainLabel ? (
                <p className="mt-1 text-[11px] text-on-surface-variant/80">
                  Simulating <span className="font-semibold text-on-surface-variant">{state.trainLabel}</span>
                  {state.routeLabel ? ` · ${state.routeLabel}` : ""}
                </p>
              ) : null}
            </Field>

            <Field label="Target Speed" value={`${state.targetSpeedKmh} km/h`}>
              <input
                type="range"
                min={40}
                max={160}
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

            <Field label="Extra Delay Injection" value={formatDelay(state.delayInjectionMinutes)}>
              <input
                type="range"
                min={-10}
                max={60}
                step={1}
                value={state.delayInjectionMinutes}
                onChange={(event) => state.setDelayInjection(Number(event.target.value))}
                className="w-full accent-error"
              />
              <p className="mt-1 text-[11px] text-on-surface-variant/80">
                Applied on top of the train's real {formatDelay(state.baselineDelayMinutes)} current delay.
              </p>
            </Field>

            <div className="flex items-center gap-2 border-t border-outline-variant/30 pt-4">
              <IconButton label="Reset" onClick={state.reset}>
                <RotateCcw size={16} />
              </IconButton>
              <IconButton
                label={state.isRunning ? "Pause" : "Play"}
                onClick={state.isRunning ? state.pause : state.play}
                primary
                disabled={!state.route}
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
              title={state.routeLabel ? `Route Simulation: ${state.routeLabel}` : "Route Simulation"}
              action={
                <span className="rounded bg-surface-container-high px-2 py-1 font-body text-data-mono text-[11px] font-semibold text-on-surface-variant">
                  {state.isRunning ? "SIM RUNNING" : "PAUSED"} · {state.elapsedLabel}
                </span>
              }
            />
            {state.isLoadingTrain ? (
              <div className="p-4">
                <CardSkeleton rows={6} />
              </div>
            ) : routeStations.length === 0 ? (
              <CardContent>
                <EmptyState
                  icon={Search}
                  title="No train loaded"
                  description="Enter a train number above to load its real route and start a scenario."
                />
              </CardContent>
            ) : (
              <MapContainer
                center={mapView.center}
                zoom={mapView.zoom}
                className="min-h-[360px] flex-1 lg:min-h-[420px]"
              >
                <RouteOverlay stations={routeStations} />
                {routeStations.map((station) => (
                  <StationMarker key={station.code} station={station} />
                ))}
                {riskPositions.map(({ factor, position }) => (
                  <RiskPointMarker key={`${factor.kind}-${factor.stationCode}`} factor={factor} position={position} />
                ))}
                {scenarioTrainMarker && (
                  <TrainMarker
                    train={scenarioTrainMarker}
                    selected
                    pulse={state.isRunning}
                    headingDegrees={scenarioOutput.headingDegrees ?? undefined}
                  />
                )}
              </MapContainer>
            )}
            {riskPositions.length > 0 && (
              <p className="border-t border-outline-variant/30 px-4 py-2 text-[11px] text-on-surface-variant">
                <span className="font-semibold text-rail-amber">{riskPositions.length} known bottleneck{riskPositions.length === 1 ? "" : "s"}</span>{" "}
                marked on the map (⚠) — tap one for details.
              </p>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Simulated ETA" value={state.simulatedEta} icon={Clock} />
            <MetricCard
              label="Actual ETA (live)"
              value={state.baselineEta}
              delta={formatDelay(state.baselineDelayMinutes)}
              deltaTone={state.baselineDelayMinutes > 5 ? "negative" : "positive"}
              icon={Clock}
            />
            <MetricCard
              label="vs. Live"
              value={formatDelay(state.deltaVsLiveMinutes)}
              delta={state.deltaVsLiveMinutes <= 0 ? "better than actual" : "worse than actual"}
              deltaTone={state.deltaVsLiveMinutes <= 0 ? "positive" : "negative"}
              icon={TrendingUp}
            />
            <MetricCard label="Bottleneck Risk" value={`Level ${state.bottleneckRiskLevel}`} icon={OctagonAlert} />
          </div>

          <Card>
            <CardHeader title="Downstream Effects" />
            <CardContent>
              {state.stationForecast.length === 0 ? (
                <EmptyState
                  title="No downstream stations"
                  description={
                    state.route
                      ? "The train has reached the end of its route."
                      : "Load a train to project its downstream delays."
                  }
                />
              ) : (
                <div className="flex max-h-[320px] flex-col divide-y divide-outline-variant/20 overflow-y-auto scrollbar-thin">
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
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded transition-colors disabled:opacity-50",
        primary
          ? "bg-primary text-on-primary hover:bg-primary-container"
          : "border border-outline-variant text-on-surface-variant hover:bg-surface-container-high",
      )}
    >
      {children}
    </button>
  );
}
