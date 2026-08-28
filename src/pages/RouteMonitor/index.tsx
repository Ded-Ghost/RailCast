import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Gauge, MapPin, Route as RouteIcon, Search, TrendingUp } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/common/Card";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SectionStatusBadge } from "@/components/common/SectionStatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { CardSkeleton } from "@/components/common/Skeleton";
import { MapContainer, RiskPointMarker, RouteOverlay, StationMarker, TrainMarker } from "@/components/map";
import { useTrain } from "@/hooks/useTrains";
import { useRouteProgress } from "@/hooks/useTrainIntelligence";
import { computeRealRouteSections, findCurrentSection } from "@/services/routeService";
import { getOperationalRiskFactors } from "@/data/operationalRiskFactors";
import { computeBoundsView } from "@/lib/geo";
import { useNetworkStore } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { formatDelay, formatSpeed } from "@/lib/format";
import type { Station } from "@/types";

export default function RouteMonitor() {
  const selectedTrainId = useNetworkStore((state) => state.selectedTrainId);
  const trains = useNetworkStore((state) => state.trains);
  const selectTrain = useNetworkStore((state) => state.selectTrain);
  const [activeTrainId, setActiveTrainId] = useState(selectedTrainId || trains[0]?.id || "12301");
  const [trainInput, setTrainInput] = useState(activeTrainId);

  // Whatever train is selected elsewhere in the app (e.g. opened on Train
  // Details) becomes this page's active train automatically — the map no
  // longer stays pinned to a preset default once the user has looked at
  // something else.
  useEffect(() => {
    if (selectedTrainId && selectedTrainId !== activeTrainId) {
      setActiveTrainId(selectedTrainId);
      setTrainInput(selectedTrainId);
    }
    // Only react to the selection changing elsewhere, not to this page's own edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrainId]);

  const { data: train, isLoading: isLoadingTrain } = useTrain(activeTrainId);
  const { data: routeProgress, isLoading: isLoadingRoute } = useRouteProgress(activeTrainId);
  const isLoading = isLoadingTrain || isLoadingRoute;
  const speedUnit = useSettingsStore((s) => s.speedUnit);

  const stops = routeProgress?.stops ?? [];

  // Real per-leg section health, computed from THIS train's own real route
  // and its own real observed delays — see routeService.ts for exactly what
  // "current speed" and "congestion" mean here and where the numbers come
  // from on a leg that hasn't happened yet.
  const sections = useMemo(() => computeRealRouteSections(train, stops), [train, stops]);
  const currentSection = train && sections.length > 0 ? findCurrentSection(train, sections) : undefined;

  const routeStations: Station[] = useMemo(
    () =>
      stops
        .filter((stop) => stop.position)
        .map((stop) => ({
          code: stop.stationCode,
          name: stop.stationName ?? stop.stationCode,
          position: stop.position!,
          zone: stop.zone ?? undefined,
        })),
    [stops],
  );

  const mapView = useMemo(() => computeBoundsView(routeStations.map((station) => station.position)), [routeStations]);

  // Known, real bottlenecks still ahead on this route — surfaced as markers
  // right on the map, not just listed in text. See data/operationalRiskFactors.ts.
  const riskFactors = useMemo(() => getOperationalRiskFactors(stops), [stops]);
  const riskPositions = riskFactors
    .map((factor) => ({ factor, position: stops.find((stop) => stop.stationCode === factor.stationCode)?.position }))
    .filter((entry): entry is { factor: (typeof riskFactors)[number]; position: NonNullable<typeof entry.position> } =>
      Boolean(entry.position),
    );

  function handleLoad(event: FormEvent) {
    event.preventDefault();
    const id = trainInput.trim();
    if (/^\d{4,5}$/.test(id)) {
      setActiveTrainId(id);
      selectTrain(id);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Route Monitor"
        description="Section-by-section health, congestion, and speed compliance for any real train's real route."
      />

      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <form onSubmit={handleLoad} className="flex items-center gap-2">
            <label htmlFor="route-train-input" className="text-body-sm font-semibold text-on-surface-variant">
              Train
            </label>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                id="route-train-input"
                type="text"
                inputMode="numeric"
                value={trainInput}
                onChange={(event) => setTrainInput(event.target.value)}
                placeholder="e.g. 12301"
                className="h-9 w-36 rounded border border-outline-variant bg-surface-container-lowest pl-7 pr-3 font-body text-data-mono text-body-md text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="h-9 rounded bg-primary px-3 text-body-sm font-semibold text-on-primary transition-colors hover:bg-primary-container"
            >
              Load
            </button>
          </form>
          {train && (
            <span className="text-body-sm text-on-surface-variant">
              {train.id} · {train.name} · {train.originName} → {train.destinationName}
            </span>
          )}
          {train && <StatusBadge status={train.delayStatus} className="sm:ml-auto" />}
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardHeader
          title={train ? `${train.originName} → ${train.destinationName}` : "Route"}
          action={<span className="text-body-sm text-on-surface-variant">Real map · OpenStreetMap</span>}
        />
        {isLoading ? (
          <div className="p-4">
            <CardSkeleton rows={6} />
          </div>
        ) : routeStations.length === 0 ? (
          <EmptyState icon={RouteIcon} title="Route data unavailable" description="Enter a valid train number above to load its route." />
        ) : (
          <MapContainer center={mapView.center} zoom={mapView.zoom} className="min-h-[440px] flex-1 lg:min-h-[520px]">
            <RouteOverlay stations={routeStations} sections={sections} />
            {routeStations.map((station) => (
              <StationMarker key={station.code} station={station} />
            ))}
            {riskPositions.map(({ factor, position }) => (
              <RiskPointMarker key={`${factor.kind}-${factor.stationCode}`} factor={factor} position={position} />
            ))}
            {train && <TrainMarker train={train} selected pulse />}
          </MapContainer>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
        <Card className="xl:col-span-2">
          <CardHeader title="Section Timeline" />
          {isLoading ? (
            <div className="p-4">
              <CardSkeleton rows={5} />
            </div>
          ) : sections.length === 0 ? (
            <EmptyState title="No sections available" />
          ) : (
            <div className="flex max-h-[420px] flex-col divide-y divide-outline-variant/20 overflow-y-auto scrollbar-thin">
              {sections.map((section) => {
                const isCurrent = currentSection?.id === section.id;
                return (
                  <div
                    key={section.id}
                    className={`flex items-center justify-between gap-4 px-4 py-3 ${isCurrent ? "bg-primary-container/5" : ""}`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-body-md font-semibold text-on-background">
                        {section.startStationCode} → {section.endStationCode}
                        {isCurrent && (
                          <span className="ml-2 rounded bg-rail-blue/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rail-blue">
                            Train Here
                          </span>
                        )}
                      </span>
                      <span className="text-body-sm text-on-surface-variant">
                        {section.distanceKm} km · {formatSpeed(section.currentSpeedKmh, speedUnit)}
                        {section.delayContributionMinutes !== 0 && (
                          <span className="ml-1.5 text-rail-amber">
                            ({formatDelay(section.delayContributionMinutes)})
                          </span>
                        )}
                      </span>
                    </div>
                    <SectionStatusBadge status={section.congestionStatus} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader title="Current Section" />
          <CardContent>
            {!currentSection ? (
              <EmptyState
                icon={MapPin}
                title="No section detected"
                description="The train isn't positioned within a modeled leg right now."
              />
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-body-md font-semibold text-on-background">
                    {currentSection.startStationCode} → {currentSection.endStationCode}
                  </span>
                  <SectionStatusBadge status={currentSection.congestionStatus} />
                </div>
                <DetailRow icon={Gauge} label="Current Speed" value={formatSpeed(currentSection.currentSpeedKmh, speedUnit)} />
                <DetailRow icon={TrendingUp} label="Booked Pace" value={formatSpeed(currentSection.referenceSpeedKmh, speedUnit)} />
                <DetailRow
                  icon={RouteIcon}
                  label="Delay Contribution"
                  value={formatDelay(currentSection.delayContributionMinutes)}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Speed Compliance by Section" />
        <CardContent>
          {sections.length === 0 ? (
            <EmptyState title="No section data available" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={sections.map((section) => ({
                  name: `${section.startStationCode}–${section.endStationCode}`,
                  Booked: section.referenceSpeedKmh,
                  Actual: section.currentSpeedKmh,
                }))}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e2" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#737685" }} stroke="#c3c6d6" interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: "#737685" }} stroke="#c3c6d6" width={36} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Booked" fill="#c3c6d6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Actual" fill="#0052cc" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-t border-outline-variant/30 pt-3 first:border-t-0 first:pt-0">
      <span className="flex items-center gap-2 text-body-sm text-on-surface-variant">
        <Icon size={14} />
        {label}
      </span>
      <span className="text-body-md font-semibold text-on-background">{value}</span>
    </div>
  );
}
