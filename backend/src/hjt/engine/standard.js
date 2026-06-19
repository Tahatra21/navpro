import { lookupHppStandard } from './lookup.js';
import { roundup1000, safeInt } from './math.js';

/**
 * Hitung satu baris Mode A (§5.2).
 */
export function calcLineStandard({ capacity, qty, lastmile = 0, tariffRow, region }) {
  const D = Number(capacity) || 0;
  const F = safeInt(qty, 1);
  const { backbone, uplink, vas } = lookupHppStandard(tariffRow, region);
  const lm = safeInt(lastmile, 0);
  const harga_dasar = Math.round(D * (backbone + uplink) * F + lm + vas);
  return { backbone, uplink, vas, lastmile: lm, harga_dasar };
}

/**
 * Agregasi & margin Mode A (§5.3–§5.5).
 */
export function calcQuotationStandard({
  lines,
  scheme,
  durationYears,
  otherExpenses = [],
  marginFloor = 0.1,
  marginRecommended = 0.2,
}) {
  const total_per_month = lines.reduce((s, l) => s + safeInt(l.harga_dasar, 0), 0);
  const dur = Math.max(1, safeInt(durationYears, 1));
  const grand_total_hjt =
    scheme === 'Subscription' ? total_per_month * dur * 12 : total_per_month;
  const other_expense_total = otherExpenses.reduce(
    (s, e) => s + safeInt(e.total ?? e.harsat * e.jumlah, 0),
    0
  );
  const grand_total_all = grand_total_hjt + other_expense_total;

  let offer_floor;
  let offer_recommended;
  if (scheme === 'OTC') {
    offer_floor = Math.round(grand_total_all * (1 + marginFloor));
    offer_recommended = Math.round(grand_total_all * (1 + marginRecommended));
  } else {
    offer_floor = roundup1000((grand_total_all * (1 + marginFloor)) / (12 * dur));
    offer_recommended = roundup1000((grand_total_all * (1 + marginRecommended)) / (12 * dur));
  }

  return {
    lines,
    total_per_month,
    grand_total_hjt,
    other_expense_total,
    grand_total_all,
    offer: { floor: offer_floor, recommended: offer_recommended },
    margin: { nominal: 0, percent: 0 },
  };
}

export function validateStandardLine({ capacity, qty, productId, regionId }) {
  const errors = [];
  if (!productId) errors.push('PRODUCT_REQUIRED');
  if (!regionId) errors.push('REGION_REQUIRED');
  if (!(Number(capacity) > 0)) errors.push('CAPACITY_INVALID');
  if (!(safeInt(qty, 0) >= 1)) errors.push('QTY_INVALID');
  return errors;
}

export function validateStandardQuotation({ durationYears }) {
  const errors = [];
  if (!(safeInt(durationYears, 0) >= 1)) errors.push('DURATION_INVALID');
  return errors;
}
