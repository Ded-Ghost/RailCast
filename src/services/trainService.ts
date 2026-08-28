import type { Prediction, Train, TrainRoute, TrainRouteProgress } from "@/types";
import type { EtaHistoryPoint } from "@/data/etaHistory";
import { computeEnhancedPrediction } from "./predictionEngine";

/**
 * trainService.ts — the single boundary between the UI and train data.
 *
 * Everything comes from the RailCast backend (/api/trains/*), which joins the
 * published timetable to the live running-status feed. During `npm run dev`
 * the Vite proxy forwards /api to http://localhost:3001; in production set
 * VITE_API_BASE_URL to the deployed backend origin.
 *
 * There is deliberately no mock fallback. An earlier version of this file fell
 * back to a canned train whenever the backend was unreachable, which meant a
 * dead backend looked identical to a healthy one — the UI would confidently
 * show a delay for a train that nobody had actually asked about. Failures now
 * surface as null/empty so the pages can say "live data unavailable" honestly.
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "") + "/api";

/** How long any single backend call may take before it is abandoned. */
const REQUEST_TIMEOUT_MS = 12_000;

type ApiResult<T> = { ok: true; data: T; meta: Record<string, unknown> } | { ok: false; error: string };

async function apiFetch<T>(path: string): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: controller.signal });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json) {
      return { ok: false, error: json?.error?.message ?? `Request failed (${res.status}).` };
    }
    if (!json.success) {
      return { ok: false, error: json.error?.message ?? "The backend rejected the request." };
    }
    return { ok: true, data: json.data as T, meta: json.meta ?? {} };
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    return { ok: false, error: aborted ? "The backend did not respond in time." : "The backend is unreachable." };
  } finally {
    clearTimeout(timeout);
  }
}

export const trainService = {
  /** The browse list — real trains, live-enriched by the backend. */
  async listTrains(): Promise<Train[]> {
    const result = await apiFetch<Train[]>("/trains");
    return result.ok ? result.data : [];
  },

  /** One train's identity + current state. */
  async getTrain(id: string): Promise<Train | null> {
    if (!id) return null;
    const result = await apiFetch<Train>(`/trains/${encodeURIComponent(id)}`);
    return result.ok ? result.data : null;
  },

  /**
   * Live status: real current station, real delay, real interpolated position.
   * This is the call the Train Details page and the simulation store both
   * resync against.
   */
  async getLiveStatus(id: string): Promise<Train | null> {
    if (!id) return null;
    const result = await apiFetch<Train>(`/trains/${encodeURIComponent(id)}/status`);
    return result.ok ? result.data : null;
  },

  /** Trains ordered by how late they are running. */
  async getPriorityTrains(limit = 4): Promise<Train[]> {
    const all = await trainService.listTrains();
    return [...all].sort((a, b) => b.delayMinutes - a.delayMinutes).slice(0, limit);
  },

  /**
   * Search by train number or name. A number outside the browse list is looked
   * up live by the backend, so any real train is reachable.
   */
  async searchTrains(query: string): Promise<Train[]> {
    const normalized = query.trim();
    if (!normalized) return [];
    const result = await apiFetch<Train[]>(`/trains/search?q=${encodeURIComponent(normalized)}`);
    return result.ok ? result.data : [];
  },

  /**
   * Station-by-station progress, each stop carrying its own real coordinates.
   * This is what makes position interpolation work for an arbitrary train.
   */
  async getRouteProgress(trainId: string): Promise<TrainRouteProgress | null> {
    if (!trainId) return null;
    const result = await apiFetch<TrainRouteProgress>(`/trains/${encodeURIComponent(trainId)}/route`);
    if (!result.ok || !Array.isArray(result.data?.stops) || result.data.stops.length === 0) return null;
    return result.data;
  },

  /** The published timetable — origin, destination, running days, every booked time. */
  async getSchedule(trainId: string): Promise<TrainSchedule | null> {
    if (!trainId) return null;
    const result = await apiFetch<TrainSchedule>(`/trains/${encodeURIComponent(trainId)}/schedule`);
    if (!result.ok || !Array.isArray(result.data?.stops) || result.data.stops.length === 0) return null;
    return result.data;
  },

  /** Ordered station codes for a route — derived from the live route. */
  async getRoute(trainId: string): Promise<TrainRoute | null> {
    const progress = await trainService.getRouteProgress(trainId);
    if (!progress || progress.stops.length === 0) return null;
    return {
      id: `route-${trainId}`,
      trainId,
      originCode: progress.stops[0].stationCode,
      destinationCode: progress.stops[progress.stops.length - 1].stationCode,
      stationCodes: progress.stops.map((stop) => stop.stationCode),
    };
  },

  /**
   * ETA breakdown for a train that is not currently being tracked.
   *
   * Built from the train's own live figures rather than a model: the backend
   * has already computed the predicted arrival, confidence and range from the
   * real delay, so this reshapes them rather than inventing a second opinion.
   * A tracked train gets a richer, tick-by-tick version from the simulation
   * store instead (see hooks/useTrainIntelligence.ts).
   */
  async getPrediction(trainId: string): Promise<Prediction | null> {
    const train = await trainService.getLiveStatus(trainId);
    if (!train) return null;

    // Momentum (from the route's own passed-stop history) and known
    // structural bottlenecks ahead — the same engine Train Details uses,
    // minus the live-weather term, since this is a one-shot service call
    // with no polling hook to keep a weather reading fresh. See
    // predictionEngine.ts for what each factor means.
    const routeProgress = await trainService.getRouteProgress(trainId);
    const enhanced = computeEnhancedPrediction(train, routeProgress?.stops ?? [], null);

    return {
      trainId: train.id,
      predictedEta: enhanced.projectedEta,
      confidence: enhanced.confidence,
      rangeStart: enhanced.rangeStart,
      rangeEnd: enhanced.rangeEnd,
      modelVersion: "heuristic-v3",
      factors: enhanced.factors.filter((factor) => factor.label !== "Current observed delay"),
    };
  },

  /**
   * ETA drift history.
   *
   * The backend keeps no time series — the upstream feeds publish a snapshot,
   * not a history — so this is empty until the simulation store starts
   * recording one from live resyncs. Train Details shows an explanatory empty
   * state rather than a fabricated trend line.
   */
  async getEtaHistory(_trainId: string): Promise<EtaHistoryPoint[]> {
    return [];
  },
};

/** Shape returned by GET /api/trains/:id/schedule. */
export interface TrainScheduleStop {
  sequence: number;
  stationCode: string;
  stationName: string;
  scheduledArrival: string | null;
  scheduledDeparture: string | null;
  haltMinutes: number;
  distanceFromOriginKm: number;
  dayOffset: number;
  platform: string | null;
  zone: string | null;
  position: { lat: number; lng: number } | null;
  elapsedArrivalMinutes: number | null;
  elapsedDepartureMinutes: number | null;
}

export interface TrainSchedule {
  trainId: string;
  trainName: string;
  serviceClass: string;
  originCode: string;
  originName: string;
  destinationCode: string;
  destinationName: string;
  scheduledDeparture: string | null;
  scheduledArrival: string | null;
  durationLabel: string;
  runsOnDays: string[];
  totalDistanceKm: number;
  stops: TrainScheduleStop[];
  updatedAt: string;
}
