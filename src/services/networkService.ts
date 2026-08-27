import {
  delayCauseBreakdown,
  delayIntelligenceSummary,
  delayTrend,
  networkSummary,
  routeSections,
  stations,
} from "@/data";
import { resolveAfter } from "./mockDelay";

export const networkService = {
  async getNetworkSummary() {
    return resolveAfter(networkSummary);
  },

  /** Station master data — powers map station markers/labels. */
  async getStations() {
    return resolveAfter(stations);
  },

  async getDelayIntelligenceSummary() {
    return resolveAfter(delayIntelligenceSummary);
  },

  async getDelayCauseBreakdown() {
    return resolveAfter(delayCauseBreakdown);
  },

  async getRouteSections() {
    return resolveAfter(routeSections);
  },

  /** Network-average delay over the day, actual vs. predicted — Delay Intelligence's trend chart. */
  async getDelayTrend() {
    return resolveAfter(delayTrend);
  },
};
