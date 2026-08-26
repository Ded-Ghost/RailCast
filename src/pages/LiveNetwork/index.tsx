import { Share2, X } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/common/Card";
import { LiveIndicator } from "@/components/common/LiveIndicator";
import { EmptyState } from "@/components/common/EmptyState";
import { CardSkeleton } from "@/components/common/Skeleton";
import { NetworkMap } from "@/components/map/NetworkMap";
import { TrainInfoPanel } from "@/components/train/TrainInfoPanel";
import { TrainStatusRow } from "@/components/train/TrainStatusRow";
import { useTrains } from "@/hooks/useTrains";
import { useStations } from "@/hooks/useStations";
import { useNetworkStore } from "@/store/useNetworkStore";

/**
 * Map-first live network view. Selecting a marker (or a row in the "Active
 * Trains" list when nothing is selected) populates the compact info panel
 * on the right — see TrainInfoPanel for the deeper "View Full Details" link
 * out to Train Details.
 */
export default function LiveNetwork() {
  const { data: trains, isLoading } = useTrains();
  const { data: stations } = useStations();
  const selectedTrainId = useNetworkStore((state) => state.selectedTrainId);
  const selectTrain = useNetworkStore((state) => state.selectTrain);

  const selectedTrain = (trains ?? []).find((train) => train.id === selectedTrainId) ?? null;

  return (
    <PageContainer>
      <PageHeader
        title="Live Network"
        description="Real-time positions, routes, and delay states across the network."
        action={<LiveIndicator />}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
        <Card className="xl:col-span-2">
          <CardHeader title="Network Map" />
          {isLoading ? (
            <div className="p-4">
              <CardSkeleton rows={6} />
            </div>
          ) : (
            <NetworkMap
              trains={trains ?? []}
              stations={stations ?? []}
              selectedTrainId={selectedTrainId}
              onSelectTrain={selectTrain}
              className="min-h-[520px] flex-1 lg:min-h-[640px]"
            />
          )}
        </Card>

        <Card className="xl:col-span-1 xl:sticky xl:top-20">
          <CardHeader
            title={selectedTrain ? "Selected Train" : "Active Trains"}
            action={
              selectedTrain && (
                <button
                  type="button"
                  onClick={() => selectTrain(null)}
                  aria-label="Clear selection"
                  className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high"
                >
                  <X size={16} />
                </button>
              )
            }
          />

          {selectedTrain ? (
            <TrainInfoPanel train={selectedTrain} />
          ) : isLoading ? (
            <div className="p-4">
              <CardSkeleton rows={4} />
            </div>
          ) : trains && trains.length > 0 ? (
            <div className="max-h-[600px] overflow-y-auto scrollbar-thin">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="sticky top-0 z-10 bg-surface-container-low text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                    <th className="px-4 py-2">Train</th>
                    <th className="px-4 py-2 text-right">Delay</th>
                    <th className="px-4 py-2 text-right">ETA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 font-body text-data-mono">
                  {trains.map((train) => (
                    <TrainStatusRow key={train.id} train={train} />
                  ))}
                </tbody>
              </table>
              <p className="border-t border-outline-variant/30 px-4 py-2 text-body-sm text-on-surface-variant">
                Click a marker on the map to see live telemetry here.
              </p>
            </div>
          ) : (
            <EmptyState icon={Share2} title="No active trains" description="Nothing is currently running on the network." />
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
