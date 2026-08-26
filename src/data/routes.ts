import type { RouteSection, TrainRoute } from "@/types";

export const trainRoutes: TrainRoute[] = [
  {
    id: "route-12345",
    trainId: "12345",
    originCode: "BBS",
    destinationCode: "NDLS",
    stationCodes: ["BBS", "CTC", "JAJPUR", "BLS", "KGP", "NDLS"],
  },
];

/**
 * Worst-performing network sections, shown on Delay Intelligence. Distinct
 * from `TrainRoute`, which describes a single train's path.
 */
export const routeSections: RouteSection[] = [
  { id: "sec-north-4", name: "North Corridor (Sec 4)", avgDelayMinutes: 14.2, affectedTrains: 12, status: "severe" },
  { id: "sec-central-hub", name: "Central Hub (Approach B)", avgDelayMinutes: 11.8, affectedTrains: 28, status: "severe" },
  { id: "sec-eastern-2", name: "Eastern Line (Jct 2)", avgDelayMinutes: 8.5, affectedTrains: 5, status: "significant" },
  { id: "sec-south-1", name: "South Valley (Sec 1)", avgDelayMinutes: 4.1, affectedTrains: 8, status: "minor" },
];
