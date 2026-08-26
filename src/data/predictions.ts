import type { Prediction } from "@/types";

export const predictions: Prediction[] = [
  {
    trainId: "12345",
    predictedEta: "14:41",
    confidence: 87,
    rangeStart: "14:37",
    rangeEnd: "14:45",
    modelVersion: "v2.4.1",
    factors: [
      { label: "Section congestion (CTC–KGP)", impactMinutes: 6 },
      { label: "Station dwell time", impactMinutes: 3 },
      { label: "Historical pattern deviation", impactMinutes: 2 },
    ],
  },
];

export function getPredictionForTrain(trainId: string): Prediction | undefined {
  return predictions.find((prediction) => prediction.trainId === trainId);
}
