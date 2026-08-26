export type AlertSeverity = "critical" | "warning" | "info" | "success";

export type AlertCategory = "critical" | "delay" | "eta-change" | "recovery";

export interface AlertItem {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  category: AlertCategory;
  trainId?: string;
  location?: string;
  timestamp: string; // ISO timestamp
  read: boolean;
}
