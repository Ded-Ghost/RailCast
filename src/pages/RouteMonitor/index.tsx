import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Gauge, MapPin, Route as RouteIcon, TrendingUp } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/common/Card";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SectionStatusBadge } from "@/components/common/SectionStatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { CardSkeleton } from "@/components/common/Skeleton";
import { MapContainer, RouteOverlay, StationMarker, TrainMarker } from "@/components/map";
import { useCorridorStations, useRailwaySections } from "@/hooks/useRouteMonitor";
import { useTrain } from "@/hooks/useTrains";
import { findCurrentSection } from "@/services/routeService";
import { PRIMARY_DEMO_TRAIN_ID } from "@/data";
import { formatDelay } from "@/lib/format";

const CORRIDOR_MAP_CENTER = { lat: 23.7, lng: 82.5 };
const CORRIDOR_MAP_ZOOM = 5;

export default function RouteMonitor() {
  const { data: stations, isLoading: isLoadingStations } = useCorridorStations();
  const { data: sections, isLoading: isLoadingSections } = useRailwaySections();
  const { data: train } = useTrain(PRIMARY_DEMO_TRAIN_ID);

  const currentSection = train && sections ? findCurrentSection(train, sections) : undefined;
  const isLoading = isLoadingStations || isLoadingSections;

  return (
    <PageContainer>
      <PageHeader
        title="Route Monitor"
        description="Section-by-section health, congestion, and speed compliance along a route."
      />

      {/* Route selector — one route modeled today; the control is built to hold more. */}
      <Card>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <label htmlFor="route-select" className="text-body-sm font-semibold text-on-surface-variant">
            Route
          </label>
          <select
            id="route-select"
            className="h-9 rounded border border-outline-variant bg-surface-container-lowest px-3 text-body-md text-on-surface focus:border-primary focus:outline-none"
            defaultValue="bbs-ndls"
          >
            <option value="bbs-ndls">Bhubaneswar → New Delhi</option>
          </select>
          {train && <StatusBadge status={train.delayStatus} className="ml-auto" />}
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardHeader title="Bhubaneswar → New Delhi" action={<span className="text-body-sm text-on-surface-variant">Real map — OpenStreetMap</span>} />
        {isLoading ? (
          <div className="p-4">
            <CardSkeleton rows={6} />
          </div>
        ) : !stations || stations.length === 0 ? (
          <EmptyState icon={RouteIcon} title="Route data unavailable" description="No stations found for this route." />
        ) : (
          <MapContainer center={CORRIDOR_MAP_CENTER} zoom={CORRIDOR_MAP_ZOOM} className="min-h-[440px] flex-1 lg:min-h-[520px]">
            <RouteOverlay stations={stations} sections={sections ?? undefined} />
            {stations.map((station) => (
              <StationMarker key={station.code} station={station} />
            ))}
            {train && <TrainMarker train={train} selected pulse />}
          </MapContainer>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
        <Card className="xl:col-span-2">
          <CardHeader title="Section Timeline" />
          {isLoadingSections ? (
            <div className="p-4">
              <CardSkeleton rows={5} />
            </div>
          ) : !sections || sections.length === 0 ? (
            <EmptyState title="No sections available" />
          ) : (
            <div className="flex flex-col divide-y divide-outline-variant/20">
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
                        {section.distanceKm} km · Avg speed {section.currentSpeedKmh} km/h
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
                description="The live train isn't positioned within a modeled section right now."
              />
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-body-md font-semibold text-on-background">
                    {currentSection.startStationCode} → {currentSection.endStationCode}
                  </span>
                  <SectionStatusBadge status={currentSection.congestionStatus} />
                </div>
                <DetailRow icon={Gauge} label="Current Speed" value={`${currentSection.currentSpeedKmh} km/h`} />
                <DetailRow icon={TrendingUp} label="Permitted / Reference Speed" value={`${currentSection.referenceSpeedKmh} km/h`} />
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
          {!sections || sections.length === 0 ? (
            <EmptyState title="No section data available" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={sections.map((section) => ({
                  name: `${section.startStationCode}–${section.endStationCode}`,
                  Reference: section.referenceSpeedKmh,
                  Current: section.currentSpeedKmh,
                }))}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e2e2" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#737685" }} stroke="#c3c6d6" />
                <YAxis tick={{ fontSize: 11, fill: "#737685" }} stroke="#c3c6d6" width={36} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Reference" fill="#c3c6d6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Current" fill="#0052cc" radius={[3, 3, 0, 0]} />
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
