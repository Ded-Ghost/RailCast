export interface EtaHistoryPoint {
  /** Time the prediction was made, "HH:MM". */
  time: string;
  /** What the model was predicting at that time, "HH:MM". */
  predictedEta: string;
  /** Predicted delay (minutes) at that point in time — what the chart plots. */
  delayMinutes: number;
}

/**
 * How a train's predicted arrival has drifted over the last few model
 * refreshes. Powers the single chart allowed on Train Details ("ETA
 * Evolution"). Only the primary demo train has history recorded today.
 */
export const etaHistoryByTrain: Record<string, EtaHistoryPoint[]> = {
  "12345": [
    { time: "12:00", predictedEta: "14:32", delayMinutes: 2 },
    { time: "12:30", predictedEta: "14:35", delayMinutes: 5 },
    { time: "13:00", predictedEta: "14:33", delayMinutes: 3 },
    { time: "13:30", predictedEta: "14:38", delayMinutes: 8 },
    { time: "14:00", predictedEta: "14:40", delayMinutes: 10 },
    { time: "14:15", predictedEta: "14:41", delayMinutes: 11 },
  ],
};

export function getEtaHistoryForTrain(trainId: string): EtaHistoryPoint[] {
  return etaHistoryByTrain[trainId] ?? [];
}
