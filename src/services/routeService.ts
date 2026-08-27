import type { RailwaySection, Station, Train } from "@/types";
import { CORRIDOR_STATION_CODES, getRailwaySections, getStationByCode } from "@/data";
import { resolveAfter } from "./mockDelay";

/**
 * Data-access boundary for route/section geography. Only the
 * Bhubaneswar → New Delhi corridor is modeled today — the same route
 * train 12345 runs (see data/routes.ts, data/routeProgress.ts). Adding a
 * second route means adding another entry to data/railwaySections.ts and
 * this service picking it by id; nothing above this layer needs to change.
 */
export const routeService = {
  async getCorridorStations(): Promise<Station[]> {
    const stations = CORRIDOR_STATION_CODES.map(getStationByCode).filter(
      (station): station is Station => Boolean(station),
    );
    return resolveAfter(stations);
  },

  async getRailwaySections(): Promise<RailwaySection[]> {
    return resolveAfter(getRailwaySections());
  },
};

/** Which section a train currently sits in, matched by its current/next station codes — no distance math needed. */
export function findCurrentSection(train: Train, sections: RailwaySection[]): RailwaySection | undefined {
  return sections.find(
    (section) => section.startStationCode === train.currentStationCode && section.endStationCode === train.nextStationCode,
  );
}
