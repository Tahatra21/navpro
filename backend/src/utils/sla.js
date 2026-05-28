import { query } from '../db.js';

const WORK_START_HOUR = 8;
const WORK_END_HOUR = 17;

function isWeekend(d) {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/** Snap to next business window (Mon–Fri 08:00–17:00). */
export function normalizeToBusinessStart(date) {
  const d = new Date(date);
  let guard = 0;
  while (guard++ < 14) {
    if (isWeekend(d)) {
      d.setDate(d.getDate() + 1);
      d.setHours(WORK_START_HOUR, 0, 0, 0);
      continue;
    }
    const h = d.getHours();
    if (h >= WORK_END_HOUR) {
      d.setDate(d.getDate() + 1);
      d.setHours(WORK_START_HOUR, 0, 0, 0);
      continue;
    }
    if (h < WORK_START_HOUR) {
      d.setHours(WORK_START_HOUR, 0, 0, 0);
    }
    break;
  }
  return d;
}

/**
 * Due at end of Nth working day (17:00), counting from start within business hours.
 * BRD §13: Senin–Jumat, jam kerja 08:00–17:00.
 */
export function addWorkingDaysBusiness(startDate, days) {
  let d = normalizeToBusinessStart(new Date(startDate));
  let remaining = Math.max(0, Number(days) || 0);

  if (remaining === 0) {
    if (d.getHours() >= WORK_END_HOUR) {
      d.setDate(d.getDate() + 1);
      d.setHours(WORK_START_HOUR, 0, 0, 0);
      while (isWeekend(d)) d.setDate(d.getDate() + 1);
    }
    d.setHours(WORK_END_HOUR, 0, 0, 0);
    return d;
  }

  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    while (isWeekend(d)) d.setDate(d.getDate() + 1);
    remaining -= 1;
  }
  d.setHours(WORK_END_HOUR, 0, 0, 0);
  return d;
}

/** @deprecated alias — uses business calendar */
export function addWorkingDays(startDate, days) {
  return addWorkingDaysBusiness(startDate, days);
}

export function computeDueAtFromSlaRow(sla, startDate = new Date()) {
  if (!sla) return null;
  return addWorkingDaysBusiness(startDate, sla.sla_working_days || 2);
}

export async function getSlaConfigMap() {
  const { rows } = await query(`SELECT * FROM sla_config ORDER BY role_key`);
  return new Map(rows.map((r) => [r.role_key, r]));
}

export async function computeDueAtForRole(roleKey, startDate = new Date()) {
  const map = await getSlaConfigMap();
  return computeDueAtFromSlaRow(map.get(roleKey), startDate);
}
