import type { TrainRouteProgress } from "@/types";

/**
 * Station-by-station schedule/prediction breakdown for a train's active
 * route. Distinct from `TrainRoute` (just an ordered list of codes) — this
 * is the richer feed a real ETA-forecasting service would emit per stop.
 * Only the primary demo train has a fully authored breakdown today; other
 * trains fall back to an empty-state in the UI (see `getRouteProgressForTrain`).
 */
export const routeProgressList: TrainRouteProgress[] = [
  {
    trainId: "12345",
    stops: [
      {
        stationCode: "BBS",
        distanceFromOriginKm: 0,
        scheduledTime: "16:08",
        predictedTime: "16:08",
        delayMinutes: 0,
        status: "passed",
      },
      {
        stationCode: "CTC",
        distanceFromOriginKm: 28,
        scheduledTime: "17:00",
        predictedTime: "17:05",
        delayMinutes: 5,
        status: "current",
      },
      {
        stationCode: "JAJPUR",
        distanceFromOriginKm: 88,
        scheduledTime: "17:48",
        predictedTime: "17:59",
        delayMinutes: 11,
        status: "upcoming",
      },
      {
        stationCode: "BLS",
        distanceFromOriginKm: 178,
        scheduledTime: "18:53",
        predictedTime: "19:04",
        delayMinutes: 11,
        status: "upcoming",
      },
      {
        stationCode: "KGP",
        distanceFromOriginKm: 278,
        scheduledTime: "20:03",
        predictedTime: "20:15",
        delayMinutes: 12,
        status: "upcoming",
      },
      {
        stationCode: "NDLS",
        distanceFromOriginKm: 346,
        scheduledTime: "14:30",
        predictedTime: "14:41",
        delayMinutes: 11,
        status: "upcoming",
      },
    ],
  },
];

export function getRouteProgressForTrain(trainId: string): TrainRouteProgress | undefined {
  return routeProgressList.find((entry) => entry.trainId === trainId);
}
