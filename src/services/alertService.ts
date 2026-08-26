import type { AlertItem } from "@/types";
import { alerts } from "@/data";
import { resolveAfter } from "./mockDelay";

export const alertService = {
  async listAlerts(): Promise<AlertItem[]> {
    return resolveAfter(alerts);
  },

  async listCriticalAlerts(): Promise<AlertItem[]> {
    return resolveAfter(alerts.filter((alert) => alert.category === "critical"));
  },
};
