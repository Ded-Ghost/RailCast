export interface EtaHistoryPoint {
  /** Time the prediction was made, "HH:MM". */
  time: string;
  /** What the model was predicting at that time, "HH:MM". */
  predictedEta: string;
  /** Predicted delay (minutes) at that point in time — what the chart plots. */
  delayMinutes: number;
}

/**
 * A train's ETA drift is observed, never canned.
 *
 * The upstream feeds publish a snapshot of right now, not a time series, so
 * there is no history to import — the series behind Train Details' "ETA
 * Evolution" chart is accumulated by the simulation store as it watches
 * successive live resyncs (see store/useSimulationStore.ts). This module
 * therefore contributes only the point shape.
 */
