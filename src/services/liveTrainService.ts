import type { LiveTrainSnapshot } from "@/types";

/**
 * The frontend never talks to RailRadar directly — only to our own
 * backend proxy (api/trains/[number]/live.js), which holds the secret
 * key. This keeps the split from api/trains/[number]/live.js's own
 * comment intact: no live-data secret ever reaches the browser.
 */

export type LiveTrainFetchResult =
  | { kind: "success"; data: LiveTrainSnapshot }
  | { kind: "not_configured" }
  | { kind: "not_found" }
  | { kind: "error"; message: string };

/**
 * Maps our proxy's pass-through RailRadar payload onto our own
 * LiveTrainSnapshot shape.
 *
 * OPEN ITEM: these field paths are a best-effort guess based on
 * RailRadar's documented capabilities ("real-time position, delay in
 * minutes, current halt, and diversion alerts") — their full response
 * schema wasn't accessible without a live API key to test against. This
 * function is deliberately the ONLY place that would need adjusting once
 * a real response is visible: hit the endpoint with a real key, log the
 * raw payload, and fix whichever of these guesses were wrong.
 */
function normalizeRailRadarLiveResponse(trainNumber: string, raw: unknown): LiveTrainSnapshot {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = (raw as any)?.data ?? raw;

  const lat = data?.latitude ?? data?.lat ?? data?.position?.lat ?? data?.location?.latitude;
  const lng = data?.longitude ?? data?.lng ?? data?.position?.lng ?? data?.location?.longitude;

  if (typeof lat !== "number" || typeof lng !== "number") {
    throw new Error("Live position payload did not include usable coordinates.");
  }

  return {
    trainNumber,
    trainName: data?.trainName ?? data?.name ?? "",
    position: { lat, lng },
    currentStationCode: data?.currentStation?.code ?? data?.currentStationCode ?? null,
    currentStationName: data?.currentStation?.name ?? data?.currentStationName ?? data?.currentHalt ?? null,
    nextStationCode: data?.nextStation?.code ?? data?.nextStationCode ?? null,
    nextStationName: data?.nextStation?.name ?? data?.nextStationName ?? null,
    speedKmh: typeof data?.speed === "number" ? data.speed : typeof data?.speedKmh === "number" ? data.speedKmh : null,
    delayMinutes: typeof data?.delayMinutes === "number" ? data.delayMinutes : null,
    directionDegrees:
      typeof data?.bearing === "number" ? data.bearing : typeof data?.direction === "number" ? data.direction : null,
    observedAt: data?.timestamp ?? data?.updatedAt ?? new Date().toISOString(),
  };
}

export const liveTrainService = {
  /**
   * Fetches one train's real live position through our backend proxy.
   * Never throws for expected outcomes (not configured, not found,
   * upstream/network error) — those are all valid results a caller
   * should render honestly, not exceptions to catch. Never fabricates a
   * result: every non-"success" branch means exactly what it says.
   *
   * Requests always go to `${VITE_API_BASE_URL}/api/trains/.../live`,
   * where VITE_API_BASE_URL defaults to an empty string — i.e. a
   * same-origin relative request. That's deliberate: the simplest, and
   * recommended, deployment puts this repo's `api/` functions on the
   * SAME Vercel project as the built frontend, so no base URL needs
   * configuring at all. Only set VITE_API_BASE_URL if the backend is
   * deployed somewhere else entirely.
   */
  async getLiveTrain(trainNumber: string): Promise<LiveTrainFetchResult> {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

    try {
      const response = await fetch(`${baseUrl}/api/trains/${encodeURIComponent(trainNumber)}/live`);
      const payload = await response.json().catch(() => null);

      if (response.status === 503 && payload?.error === "not_configured") {
        return { kind: "not_configured" };
      }
      if (response.status === 404) {
        // Could mean RailRadar doesn't track this train number, OR that
        // no backend/api route exists at all (e.g. a static-only host)
        // and this 404 is generic routing noise, not a JSON payload from
        // our function. Either way, there's no live data for this train
        // right now — that's the one thing this status needs to convey.
        return { kind: "not_found" };
      }
      if (!response.ok) {
        return { kind: "error", message: payload?.message ?? `Request failed (HTTP ${response.status})` };
      }

      return { kind: "success", data: normalizeRailRadarLiveResponse(trainNumber, payload) };
    } catch (error) {
      return { kind: "error", message: error instanceof Error ? error.message : "Network error" };
    }
  },
};
