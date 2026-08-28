"use strict";

/**
 * status.js — Delay classification and "HH:MM" clock arithmetic.
 *
 * The thresholds here mirror src/lib/status.ts exactly; a train must never be
 * labelled "minor" by the API and "significant" by the UI.
 */

/** Indian Standard Time is a fixed UTC+05:30 — no DST, so a constant offset is correct year-round. */
const IST_OFFSET_MINUTES = 330;

function delayMinutesToStatus(minutes) {
  const value = Number(minutes) || 0;
  if (value <= 5) return "on-time";
  if (value <= 15) return "minor";
  if (value <= 30) return "significant";
  return "severe";
}

function parseTimeToMinutes(time) {
  if (!time) return null;
  const match = String(time).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatMinutesToTime(totalMinutes) {
  if (!Number.isFinite(totalMinutes)) return "—";
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function addMinutesToTime(time, minutesToAdd) {
  const base = parseTimeToMinutes(time);
  if (base === null) return "—";
  return formatMinutesToTime(base + (Number(minutesToAdd) || 0));
}

/** Current wall-clock time in India, as { minutesOfDay, dayIndex } where dayIndex counts days since the epoch in IST. */
function nowInIST(reference = new Date()) {
  const istMs = reference.getTime() + IST_OFFSET_MINUTES * 60_000;
  const totalMinutes = Math.floor(istMs / 60_000);
  return {
    dayIndex: Math.floor(totalMinutes / 1440),
    minutesOfDay: totalMinutes % 1440,
    /** Absolute minutes since epoch in IST — the scale all journey math uses. */
    absoluteMinutes: totalMinutes,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

module.exports = {
  IST_OFFSET_MINUTES,
  delayMinutesToStatus,
  parseTimeToMinutes,
  formatMinutesToTime,
  addMinutesToTime,
  nowInIST,
  clamp,
};
