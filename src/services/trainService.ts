import type { Train } from "@/types";
import { getTrainById, trains } from "@/data";
import { getPredictionForTrain } from "@/data/predictions";
import { getRouteProgressForTrain } from "@/data/routeProgress";
import { getEtaHistoryForTrain } from "@/data/etaHistory";
import { trainRoutes } from "@/data/routes";
import { resolveAfter } from "./mockDelay";

/**
 * Data-access boundary for trains. Every call here is `async` on purpose,
 * even though the mock implementation is synchronous underneath — this is
 * the seam where a real REST call or WebSocket subscription gets swapped
 * in later without touching a single component or hook.
 */
export const trainService = {
  async listTrains(): Promise<Train[]> {
    return resolveAfter(trains);
  },

  async getTrain(id: string): Promise<Train | null> {
    return resolveAfter(getTrainById(id) ?? null);
  },

  async getPriorityTrains(limit = 4): Promise<Train[]> {
    const sorted = [...trains].sort((a, b) => b.delayMinutes - a.delayMinutes);
    return resolveAfter(sorted.slice(0, limit));
  },

  async searchTrains(query: string): Promise<Train[]> {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return resolveAfter([]);
    const results = trains.filter(
      (train) =>
        train.id.includes(normalized) ||
        train.name.toLowerCase().includes(normalized) ||
        train.shortName.toLowerCase().includes(normalized),
    );
    return resolveAfter(results);
  },

  async getPrediction(trainId: string) {
    return resolveAfter(getPredictionForTrain(trainId) ?? null);
  },

  async getRoute(trainId: string) {
    return resolveAfter(trainRoutes.find((route) => route.trainId === trainId) ?? null);
  },

  /** Station-by-station schedule/prediction breakdown — powers the route intelligence visualization. */
  async getRouteProgress(trainId: string) {
    return resolveAfter(getRouteProgressForTrain(trainId) ?? null);
  },

  /** Recent prediction drift — powers the ETA Evolution chart. */
  async getEtaHistory(trainId: string) {
    return resolveAfter(getEtaHistoryForTrain(trainId));
  },
};
