import { useEffect, useRef } from "react";
import type { AlertItem, Train } from "@/types";
import { trainService } from "@/services/trainService";
import { alertService, type AlertEvaluationSnapshot } from "@/services/alertService";
import { useNetworkStore } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";

function toSnapshot(train: Train): AlertEvaluationSnapshot {
  return {
    delayMinutes: train.delayMinutes,
    delayStatus: train.delayStatus,
    predictedEta: train.predictedEta,
    currentSpeedKmh: train.currentSpeedKmh,
    currentStationName: train.currentStationName,
  };
}

/** Short, unobtrusive beep — no bundled audio asset needed. */
function playAlertTone() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.35);
    oscillator.onended = () => void ctx.close();
  } catch {
    // Audio isn't available in every environment (e.g. no user gesture yet) — silently skip.
  }
}

/**
 * The network-wide counterpart to alertService.evaluate — previously that
 * function only ever ran against the one train being actively simulated on
 * Train Details, so the Alert Center stayed empty for anyone who hadn't
 * opened a specific train. This polls the full browse list independently
 * (on the same cadence as Settings' "Live Refresh Interval") and diffs every
 * train's state against its own previous poll, so alerts accumulate for the
 * whole network exactly like a real operations feed would.
 *
 * Mounted once at the App root. Also accumulates the real network-average
 * delay into useNetworkStore.delayTrendHistory — see that store for why it
 * starts empty rather than seeded.
 */
export function useNetworkAlertWatcher() {
  const previousRef = useRef<Map<string, AlertEvaluationSnapshot>>(new Map());
  const prependAlerts = useNetworkStore((s) => s.prependAlerts);
  const pushDelayTrendPoint = useNetworkStore((s) => s.pushDelayTrendPoint);
  const refreshIntervalSeconds = useSettingsStore((s) => s.refreshIntervalSeconds);
  const criticalDelayAlerts = useSettingsStore((s) => s.criticalDelayAlerts);
  const audioPrompts = useSettingsStore((s) => s.audioPrompts);
  const settingsRef = useRef({ criticalDelayAlerts, audioPrompts });
  settingsRef.current = { criticalDelayAlerts, audioPrompts };

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      const trains = await trainService.listTrains();
      if (cancelled || trains.length === 0) return;

      const previous = previousRef.current;
      const next = new Map<string, AlertEvaluationSnapshot>();
      const collected: AlertItem[] = [];

      for (const train of trains) {
        const current = toSnapshot(train);
        next.set(train.id, current);

        const found = alertService.evaluate({
          trainId: train.id,
          trainName: train.name,
          previous: previous.get(train.id) ?? null,
          current,
        });
        collected.push(...found);
      }

      const { criticalDelayAlerts: wantsCritical, audioPrompts: wantsAudio } = settingsRef.current;
      const filtered = wantsCritical ? collected : collected.filter((a) => a.severity !== "critical");

      if (filtered.length > 0) {
        prependAlerts(filtered);
        if (wantsAudio && filtered.some((a) => a.severity === "critical")) playAlertTone();
      }

      previousRef.current = next;

      const avgDelayMinutes = trains.reduce((sum, t) => sum + t.delayMinutes, 0) / trains.length;
      const now = new Date();
      pushDelayTrendPoint({
        time: now.toLocaleTimeString("en-IN", { hour12: false }),
        avgDelayMinutes: Math.round(avgDelayMinutes * 10) / 10,
        trackedTrains: trains.length,
      });
    }

    void tick();
    const interval = setInterval(() => void tick(), refreshIntervalSeconds * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refreshIntervalSeconds, prependAlerts, pushDelayTrendPoint]);
}
