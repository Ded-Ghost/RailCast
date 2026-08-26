import type { AlertItem } from "@/types";

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export const alerts: AlertItem[] = [
  {
    id: "alert-1",
    title: "Potential Delay Detected",
    message:
      "Delay anticipated between Cuttack and Jajpur due to reduced section speed limit enforcement.",
    severity: "critical",
    category: "delay",
    trainId: "12345",
    timestamp: minutesAgo(0.5),
    read: false,
  },
  {
    id: "alert-2",
    title: "ETA Improved",
    message: "Expected arrival at Bhubaneswar adjusted to 14:32 (previously 14:36).",
    severity: "info",
    category: "eta-change",
    trainId: "89012",
    timestamp: minutesAgo(12),
    read: false,
  },
  {
    id: "alert-3",
    title: "Departure Delayed",
    message: "Departure from Khurda Road held due to platform congestion. Monitoring for clearance.",
    severity: "warning",
    category: "delay",
    trainId: "45678",
    location: "Platform 3",
    timestamp: minutesAgo(45),
    read: true,
  },
  {
    id: "alert-4",
    title: "Power Failure: Sec 4B",
    message: "Traction power lost. 3 trains halted. Repair crews dispatched.",
    severity: "critical",
    category: "critical",
    location: "North Corridor Sec 4B",
    timestamp: minutesAgo(12),
    read: false,
  },
  {
    id: "alert-5",
    title: "Severe Weather: North Zone",
    message: "Heavy rainfall. Speed restrictions implemented (max 40 km/h).",
    severity: "warning",
    category: "critical",
    location: "North Zone",
    timestamp: minutesAgo(60),
    read: true,
  },
];

export function getAlertsForTrain(trainId: string): AlertItem[] {
  return alerts.filter((alert) => alert.trainId === trainId);
}
