export interface PredictionVsActualPoint {
  time: string; // "HH:MM"
  actualEtaMinutesFromSchedule: number; // actual arrival offset vs schedule, minutes
  predictedEtaMinutesFromSchedule: number; // what the model predicted at that time
}

/**
 * A representative trip's predicted-vs-actual ETA drift, in minutes offset
 * from the original schedule. Deterministic, hand-authored. Powers
 * Predictions' "Prediction vs Actual ETA" chart.
 */
export const predictionVsActual: PredictionVsActualPoint[] = [
  { time: "12:00", actualEtaMinutesFromSchedule: 2, predictedEtaMinutesFromSchedule: 3 },
  { time: "12:30", actualEtaMinutesFromSchedule: 5, predictedEtaMinutesFromSchedule: 4 },
  { time: "13:00", actualEtaMinutesFromSchedule: 4, predictedEtaMinutesFromSchedule: 6 },
  { time: "13:30", actualEtaMinutesFromSchedule: 9, predictedEtaMinutesFromSchedule: 8 },
  { time: "14:00", actualEtaMinutesFromSchedule: 11, predictedEtaMinutesFromSchedule: 10 },
  { time: "14:15", actualEtaMinutesFromSchedule: 11, predictedEtaMinutesFromSchedule: 12 },
];
