/**
 * Revenue pricing modes (P2): flat, monthly escalation, step yearly (Y1/Y2/…).
 */

export const REVENUE_MODES = ['flat', 'escalation', 'step_yearly'];

export function normalizeRevenueMode(item) {
  const mode = item?.revenue_mode;
  if (mode && REVENUE_MODES.includes(mode)) return mode;
  if (item?.harsat_year_1 != null && item?.harsat_year_2 != null) return 'step_yearly';
  const esc = parseFloat(item?.escalation_rate ?? 0);
  if (esc > 0) return 'escalation';
  return 'flat';
}

export function getYearlyHarsatList(item, durationMonths) {
  if (Array.isArray(item?.harsat_by_year) && item.harsat_by_year.length > 0) {
    return item.harsat_by_year.map((v) => parseFloat(v) || 0);
  }
  const y1 = parseFloat(
    item?.harsat_year_1 ?? item?.harsat ?? item?.monthly_amount ?? 0
  );
  const y2 = parseFloat(item?.harsat_year_2 ?? y1);
  const years = [y1, y2];
  const yearCount = Math.max(1, Math.ceil((durationMonths || 12) / 12));
  while (years.length < yearCount) {
    years.push(y2);
  }
  return years;
}

/** Harsat per unit for month m (1-based), relative to item.start_period. */
export function getHarsatForMonth(item, m, durationMonths) {
  const mode = normalizeRevenueMode(item);
  const start = parseInt(item?.start_period ?? 1, 10);
  if (mode !== 'step_yearly') {
    return parseFloat(item?.harsat ?? item?.monthly_amount ?? 0);
  }
  const years = getYearlyHarsatList(item, durationMonths);
  const yearIdx = Math.floor((m - start) / 12);
  const idx = Math.min(Math.max(yearIdx, 0), years.length - 1);
  return years[idx];
}

/** Start month of the current 12-month tariff block (for escalation reset). */
export function yearSegmentStartMonth(m, startPeriod) {
  const offset = m - startPeriod;
  return startPeriod + Math.floor(offset / 12) * 12;
}

export function monthlyRevenueAmount(item, m, kurs_usd, durationMonths) {
  const qty = parseFloat(item?.qty ?? 1);
  const rate_conv = item?.currency === 'USD' ? kurs_usd : 1;
  const harsat = getHarsatForMonth(item, m, durationMonths);
  const baseline = harsat * qty * rate_conv;
  const mode = normalizeRevenueMode(item);
  if (mode === 'flat') return baseline;
  const item_esc = parseFloat(item?.escalation_rate ?? 0);
  if (mode === 'step_yearly') {
    const segStart = yearSegmentStartMonth(m, item.start_period ?? 1);
    return baseline * Math.pow(1 + item_esc, m - segStart);
  }
  return baseline * Math.pow(1 + item_esc, m - (item.start_period ?? 1));
}

/** Average monthly recurring baseline (for % OPEX). */
export function recurringBaselineForItem(item, startMonth, endMonth, kurs_usd, durationMonths) {
  const qty = parseFloat(item?.qty ?? 1);
  const rate_conv = item?.currency === 'USD' ? kurs_usd : 1;
  const mode = normalizeRevenueMode(item);
  if (mode !== 'step_yearly') {
    const harsat = parseFloat(item?.harsat ?? item?.monthly_amount ?? 0);
    return harsat * qty * rate_conv;
  }
  let sum = 0;
  let count = 0;
  for (let m = startMonth; m <= endMonth; m++) {
    sum += getHarsatForMonth(item, m, durationMonths) * qty * rate_conv;
    count++;
  }
  return count > 0 ? sum / count : 0;
}
