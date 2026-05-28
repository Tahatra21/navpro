import { computeCashflowMonthly } from '../services/calculationEngine.js';

function getKursUsd(p) {
  const o = p?.kurs_usd_override;
  if (o != null && Number.isFinite(Number(o))) return Number(o);
  const k = p?.kpi?.kurs_usd_used;
  if (k != null && Number.isFinite(Number(k))) return Number(k);
  return 16500;
}

export function sumCapexTotal(p) {
  if (p.kpi?.capex_total != null && Number.isFinite(Number(p.kpi.capex_total))) {
    return Number(p.kpi.capex_total);
  }
  const kurs = getKursUsd(p);
  return (p.capex || []).reduce((s, c) => {
    const amt = parseFloat(String(c.amount || 0));
    return s + (c.currency === 'USD' ? amt * kurs : amt);
  }, 0);
}

/** Agregat dari baris cashflow hasil engine KKF (bulan 1..N). */
export function totalsFromCashflowMonthly(cashflowMonthly) {
  if (!Array.isArray(cashflowMonthly) || cashflowMonthly.length === 0) return null;

  let revenue = 0;
  let opex = 0;
  let capex = 0;

  for (const row of cashflowMonthly) {
    const m = Number(row.period_number ?? 0);
    const rev = Number(row.revenue) || 0;
    const op = Number(row.opex) || 0;
    const cap = Number(row.capex) || 0;

    if (m === 0) {
      capex += cap;
    } else {
      revenue += rev;
      opex += op;
    }
  }

  if (capex <= 0 && revenue === 0 && opex === 0) return null;

  return {
    capex,
    opex,
    revenue,
    cost: capex + opex,
  };
}

function totalsFromPeriods(periods, totalCapexM0) {
  if (!Array.isArray(periods) || periods.length === 0) return null;

  let revenue = 0;
  let opex = 0;
  let capex = Number(totalCapexM0) || 0;

  for (const row of periods) {
    const m = Number(row.period_number ?? 0);
    if (m === 0) {
      if (!capex) capex += Number(row.capex) || 0;
      continue;
    }
    revenue += Number(row.revenue) || 0;
    opex += Number(row.opex) || 0;
  }

  return {
    capex,
    opex,
    revenue,
    cost: capex + opex,
  };
}

function hasFinancialInputs(p) {
  return (
    (p.capex && p.capex.length > 0) ||
    (p.revenue && p.revenue.length > 0) ||
    (p.opex && p.opex.length > 0)
  );
}

/**
 * Revenue & OPEX = total sepanjang durasi kontrak (lifetime cashflow).
 * Cost = CAPEX (M0) + OPEX lifetime — selaras logika KKF / kesimpulan LAYAK.
 */
export function getProjectLifetimeFinancials(project, globalAss = null) {
  const fromCashflow = totalsFromCashflowMonthly(project.cashflow_monthly);
  if (fromCashflow) return fromCashflow;

  if (
    project.kpi?.lifetime_revenue_total != null &&
    Number.isFinite(Number(project.kpi.lifetime_revenue_total))
  ) {
    const capex = sumCapexTotal(project);
    const opex = Number(project.kpi.lifetime_opex_total) || 0;
    const revenue = Number(project.kpi.lifetime_revenue_total) || 0;
    return { capex, opex, revenue, cost: capex + opex };
  }

  if (globalAss && hasFinancialInputs(project)) {
    try {
      const { periods, total_capex_m0 } = computeCashflowMonthly(project, globalAss);
      const computed = totalsFromPeriods(periods, total_capex_m0);
      if (computed) return computed;
    } catch {
      /* fall through */
    }
  }

  return null;
}

export function attachLifetimeTotalsToKpi(project, globalAss = null) {
  const totals = getProjectLifetimeFinancials(project, globalAss);
  if (!totals || !project.kpi) return project.kpi;
  return {
    ...project.kpi,
    lifetime_revenue_total: totals.revenue,
    lifetime_opex_total: totals.opex,
    capex_total: project.kpi.capex_total ?? totals.capex,
  };
}
