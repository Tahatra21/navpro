import { clamp, safeInt } from './math.js';

/** Fits PostgreSQL NUMERIC(12, 8) — max 4 digits before decimal. */
const IRR_DB_MAX = 9999.99999999;
const IRR_DB_MIN = -0.99999999;

export function sanitizeIrrForDb(irr) {
  if (irr == null || !Number.isFinite(irr)) return null;
  if (Math.abs(irr) > IRR_DB_MAX) return null;
  return clamp(irr, IRR_DB_MIN, IRR_DB_MAX);
}

export function sanitizeBcrForDb(bcr) {
  if (bcr == null || !Number.isFinite(bcr)) return null;
  return clamp(bcr, -999999.999999, 999999.999999);
}

/** NPV at annual rate for cashflows CF[1..n] (Excel NPV semantics: periods 1..n). */
export function npvAnnual(rate, cashflowsFromYear1) {
  let npv = 0;
  for (let t = 0; t < cashflowsFromYear1.length; t++) {
    npv += cashflowsFromYear1[t] / Math.pow(1 + rate, t + 1);
  }
  return npv;
}

function cashflowsHaveSignChange(cashflows) {
  let hasPos = false;
  let hasNeg = false;
  for (const cf of cashflows) {
    if (cf > 0) hasPos = true;
    else if (cf < 0) hasNeg = true;
    if (hasPos && hasNeg) return true;
  }
  return false;
}

/** IRR via Newton-Raphson on annual cashflows including CF[0]. Returns null if not meaningful. */
export function irrAnnual(cashflows, guess = 0.1) {
  if (!cashflows?.length || cashflows.length < 2) return null;
  if (!cashflowsHaveSignChange(cashflows)) return null;
  let rate = clamp(guess, IRR_DB_MIN, IRR_DB_MAX);
  for (let iter = 0; iter < 100; iter++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < cashflows.length; t++) {
      const cf = cashflows[t];
      const denom = Math.pow(1 + rate, t);
      npv += cf / denom;
      if (t > 0) {
        dnpv -= (t * cf) / Math.pow(1 + rate, t + 1);
      }
    }
    if (Math.abs(npv) < 1e-8) return sanitizeIrrForDb(rate);
    if (Math.abs(dnpv) < 1e-12) break;
    const next = rate - npv / dnpv;
    if (!Number.isFinite(next)) return null;
    if (Math.abs(next - rate) < 1e-9) return sanitizeIrrForDb(next);
    rate = clamp(next, IRR_DB_MIN, IRR_DB_MAX);
  }
  return sanitizeIrrForDb(rate);
}

/**
 * Map API body (snake_case) to engine params (camelCase).
 */
export function mapLastmileKkfInput(body = {}) {
  return {
    capex: body.capex,
    depreciationYears: body.depreciation_years ?? body.depreciationYears ?? 8,
    revShare: body.rev_share ?? body.revShare ?? 0.2,
    overhead: body.overhead,
    koefBackbone: body.koef_backbone ?? body.koefBackbone ?? 0.3,
    koefPort: body.koef_port ?? body.koefPort ?? 1.0,
    waccAnnual: body.wacc_annual ?? body.waccAnnual,
    horizonYears: body.horizon_years ?? body.horizonYears ?? 2,
    monthlyRevenue: body.monthly_revenue ?? body.monthlyRevenue ?? 0,
    capacity: body.capacity ?? 1,
    backboneUnit: body.backbone_unit ?? body.backboneUnit ?? 0,
    uplinkUnit: body.uplink_unit ?? body.uplinkUnit ?? 0,
    bcrThreshold: body.bcr_threshold ?? body.bcrThreshold ?? 1.4,
  };
}

/**
 * KKF lastmile Simple IRR (PRDHJT §5.4).
 */
export function calcLastmileKkf({
  capex,
  depreciationYears = 8,
  revShare = 0.2,
  overhead = 0.2435,
  koefBackbone = 0.3,
  koefPort = 1.0,
  waccAnnual = 0.1043,
  horizonYears = 2,
  monthlyRevenue = 0,
  capacity = 1,
  backboneUnit = 0,
  uplinkUnit = 0,
  bcrThreshold = 1.4,
}) {
  const capEx = safeInt(capex, 0);
  const depYears = Math.max(1, safeInt(depreciationYears, 8));
  const horizon = Math.max(1, safeInt(horizonYears, 2));
  const D = Number(capacity) || 1;
  const revMonthly = safeInt(monthlyRevenue, 0);
  const penyusutan = Math.round(capEx / depYears);

  const bottomLines = [];
  for (let y = 1; y <= horizon; y++) {
    const revenue = revMonthly * 12;
    const rev_share = Math.round(revShare * revenue);
    const port_inet = Math.round(D * uplinkUnit * 12 * koefPort);
    const backbone_cost = Math.round(D * backboneUnit * 12 * koefBackbone);
    const overheadAmt = Math.round(overhead * revenue);
    const subtotal =
      rev_share + port_inet + backbone_cost + overheadAmt + penyusutan;
    const bottom_line = revenue - subtotal;
    bottomLines.push(bottom_line);
  }

  const cashflows = [-capEx, ...bottomLines];
  const irr = irrAnnual(cashflows);
  const npv = Math.round(npvAnnual(waccAnnual, bottomLines));
  const bcr = sanitizeBcrForDb(capEx > 0 ? npv / capEx : 0);
  const is_feasible = bcr >= bcrThreshold;

  return {
    cashflows,
    irr,
    npv,
    bcr,
    is_feasible,
    recommended_lastmile: revMonthly,
  };
}
