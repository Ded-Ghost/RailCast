import { stations as staticStations } from "@/data";
import type { Station } from "@/types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "") + "/api";

async function fetchStationsFromBackend(query: string): Promise<Station[]> {
  try {
    const res = await fetch(`${API_BASE}/stations${query}`);
    if (!res.ok) throw new Error("backend unavailable");
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) return json.data as Station[];
    throw new Error("invalid response");
  } catch {
    // The backend is unreachable — fall back to the same real station data,
    // bundled with the frontend build, rather than showing nothing.
    return staticStations;
  }
}

export const networkService = {
  /** Major-station subset — the default map view before the user zooms in. */
  async getStations(): Promise<Station[]> {
    return fetchStationsFromBackend("");
  },

  /**
   * Every station in the database (~1,100), fetched once and kept in memory
   * by the caller. Powers progressive detail as a real map is zoomed in —
   * see components/map/ZoomAwareStations.tsx.
   */
  async getAllStations(): Promise<Station[]> {
    return fetchStationsFromBackend("?all=1");
  },
};
