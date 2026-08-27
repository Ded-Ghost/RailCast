export interface DelayTrendPoint {
  time: string; // "HH:MM"
  actualDelayMinutes: number;
  predictedDelayMinutes: number;
}

/**
 * A day's network-average delay, actual vs. what the model predicted at
 * the time — deterministic, hand-authored to read as a believable
 * congestion cycle (morning ramp, midday peak, afternoon recovery), not
 * randomly generated. Powers Delay Intelligence's "Delay Trend Over Time".
 */
export const delayTrend: DelayTrendPoint[] = [
  { time: "08:00", actualDelayMinutes: 12, predictedDelayMinutes: 14 },
  { time: "09:00", actualDelayMinutes: 22, predictedDelayMinutes: 20 },
  { time: "10:00", actualDelayMinutes: 31, predictedDelayMinutes: 27 },
  { time: "11:00", actualDelayMinutes: 24, predictedDelayMinutes: 26 },
  { time: "12:00", actualDelayMinutes: 15, predictedDelayMinutes: 18 },
  { time: "13:00", actualDelayMinutes: 20, predictedDelayMinutes: 17 },
  { time: "14:00", actualDelayMinutes: 33, predictedDelayMinutes: 29 },
  { time: "15:00", actualDelayMinutes: 26, predictedDelayMinutes: 28 },
  { time: "16:00", actualDelayMinutes: 17, predictedDelayMinutes: 19 },
];

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
