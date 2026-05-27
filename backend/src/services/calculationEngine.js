/** Financial calculation engine — aligned with frontend NAVPRO logic */

export function calculateXNPV(rate, cashflows, dates) {
  let npv = 0;
  const t0 = dates[0].getTime();
  for (let i = 0; i < cashflows.length; i++) {
    const t = (dates[i].getTime() - t0) / (365 * 24 * 60 * 60 * 1000);
    npv += cashflows[i] / Math.pow(1 + rate, t);
  }
  return npv;
}

function calculateDXNPV(rate, cashflows, dates) {
  let dnpv = 0;
  const t0 = dates[0].getTime();
  for (let i = 0; i < cashflows.length; i++) {
    const t = (dates[i].getTime() - t0) / (365 * 24 * 60 * 60 * 1000);
    dnpv -= t * cashflows[i] / Math.pow(1 + rate, t + 1);
  }
  return dnpv;
}

export function calculateXIRR(cashflows, dates) {
  let r = 0.1;
  const tol = 1e-7;
  const max_iter = 1000;

  let hasPos = false;
  let hasNeg = false;
  for (const cf of cashflows) {
    if (cf > 0) hasPos = true;
    if (cf < 0) hasNeg = true;
  }
  if (!hasPos || !hasNeg) return 0;

  for (let i = 0; i < max_iter; i++) {
    const npv = calculateXNPV(r, cashflows, dates);
    const dnpv = calculateDXNPV(r, cashflows, dates);
    if (Math.abs(dnpv) < 1e-12) break;
    const rNext = r - npv / dnpv;
    if (Math.abs(rNext - r) < tol) return rNext;
    r = rNext;
  }

  if (Number.isNaN(r) || r < -0.99 || r > 10.0) {
    let low = -0.99;
    let high = 10.0;
    for (let i = 0; i < 100; i++) {
      const mid = (low + high) / 2;
      const npv = calculateXNPV(mid, cashflows, dates);
      if (Math.abs(npv) < tol) return mid;
      if (npv > 0) low = mid;
      else high = mid;
    }
    return (low + high) / 2;
  }
  return r;
}

function calculatePayback(cumulative_cashflow, net_cashflows) {
  if (cumulative_cashflow[0] >= 0) return 0;
  for (let i = 0; i < cumulative_cashflow.length - 1; i++) {
    if (cumulative_cashflow[i] < 0 && cumulative_cashflow[i + 1] >= 0) {
      const fraction = Math.abs(cumulative_cashflow[i]) / (net_cashflows[i + 1] || 1);
      return i + fraction;
    }
  }
  return -1;
}

export function deriveMonthlyInflationRate(globalAss, { inflation_rate_override = null } = {}) {
  if (inflation_rate_override != null && inflation_rate_override !== undefined) {
    return inflation_rate_override / 100;
  }
  if (globalAss.inflation_annual !== undefined) {
    return Math.pow(1 + globalAss.inflation_annual / 100, 1 / 12) - 1;
  }
  return globalAss.inflation_monthly / 100;
}

export function computeCashflowMonthly(proj, globalAss) {
  const wacc = proj.wacc_override != null ? proj.wacc_override / 100 : globalAss.wacc_annual / 100;
  const inflation = deriveMonthlyInflationRate(globalAss, { inflation_rate_override: proj.inflation_rate_override });

  const N = proj.project_duration_months;
  const start_date = new Date(proj.contract_start_date);

  const dates = [];
  for (let m = 0; m <= N; m++) {
    const d = new Date(start_date);
    d.setMonth(d.getMonth() + m);
    dates.push(d);
  }

  const kurs_usd =
    proj.kurs_usd_override != null && proj.kurs_usd_override !== undefined
      ? parseFloat(proj.kurs_usd_override)
      : globalAss.kurs_usd || 16500;

  let otc = 0;
  if (proj.revenue && proj.revenue.length > 0) {
    let hasRowOtc = false;
    for (const r of proj.revenue) {
      if (r.otc !== undefined) {
        const rate_conv = r.currency === 'USD' ? kurs_usd : 1;
        otc += parseFloat(r.otc || 0) * rate_conv;
        hasRowOtc = true;
      }
    }
    if (!hasRowOtc) otc = parseFloat(proj.otc_amount || 0);
  } else {
    otc = parseFloat(proj.otc_amount || 0);
  }

  let total_recurring_revenue_baseline = 0;
  if (proj.revenue) {
    for (const item of proj.revenue) {
      const harsat = parseFloat(item.harsat !== undefined ? item.harsat : item.monthly_amount || 0);
      const qty = parseFloat(item.qty !== undefined ? item.qty : 1);
      const rate_conv = item.currency === 'USD' ? kurs_usd : 1;
      total_recurring_revenue_baseline += harsat * qty * rate_conv;
    }
  }

  const periods = [];
  let total_capex_m0 = 0;

  for (let m = 0; m <= N; m++) {
    const active_flag = m <= N && m > 0 ? 1 : 0;

    let capex = 0;
    for (const item of proj.capex || []) {
      if (item.period === m) {
        const amt = parseFloat(item.amount || 0);
        const rate_conv = item.currency === 'USD' ? kurs_usd : 1;
        capex += amt * rate_conv;
      }
    }
    if (m === 0) total_capex_m0 = capex;

    let opex = 0;
    if (active_flag) {
      for (const item of proj.opex || []) {
        if (m >= item.start_period && m <= item.end_period) {
          let base_amt = 0;
          if (item.is_percent) {
            const coef = parseFloat(item.coefficient_rate || 0);
            base_amt = coef * total_recurring_revenue_baseline;
          } else {
            base_amt = parseFloat(item.baseline_amount || 0);
            const rate_conv = item.currency === 'USD' ? kurs_usd : 1;
            base_amt = base_amt * rate_conv;
          }
          const item_inflation = item.inflation_rate !== undefined ? item.inflation_rate : inflation;
          opex += base_amt * Math.pow(1 + item_inflation, m - item.start_period);
        }
      }
    }

    let revenue = 0;
    if (active_flag) {
      for (const item of proj.revenue || []) {
        if (m >= item.start_period && m <= item.end_period) {
          const harsat = parseFloat(item.harsat !== undefined ? item.harsat : item.monthly_amount || 0);
          const qty = parseFloat(item.qty !== undefined ? item.qty : 1);
          const rate_conv = item.currency === 'USD' ? kurs_usd : 1;
          const baseline = harsat * qty * rate_conv;
          const item_esc = item.escalation_rate !== undefined ? item.escalation_rate : 0;
          revenue += baseline * Math.pow(1 + item_esc, m - item.start_period);
        }
      }
      if (m === 1 && otc > 0) revenue += otc;
    }

    const net_cashflow = revenue - opex - capex;
    periods.push({
      period_number: m,
      period_date: dates[m].toISOString().substring(0, 10),
      revenue: Math.round(revenue),
      otc: m === 1 ? Math.round(otc) : 0,
      opex: Math.round(opex),
      capex: Math.round(capex),
      net_cashflow: Math.round(net_cashflow),
      active_flag: m === 0 ? 1 : active_flag,
    });
  }

  let cum = 0;
  const net_cfs = [];
  for (let m = 0; m <= N; m++) {
    cum += periods[m].net_cashflow;
    periods[m].cumulative_cashflow = Math.round(cum);
    net_cfs.push(periods[m].net_cashflow);
  }

  return { dates, periods, net_cfs, wacc, inflation, kurs_usd, otc_amount: otc, total_capex_m0 };
}

export function computeProjectKpi({ dates, periods, net_cfs, wacc, kurs_usd, total_capex_m0 }, proj, globalAss) {
  const bcr_mandatory = proj.bcr_threshold_override?.mandatory || globalAss.bcr_mandatory;
  const bcr_minimum = proj.bcr_threshold_override?.minimum || globalAss.bcr_minimum;
  const N = proj.project_duration_months;

  const xnpv_val = calculateXNPV(wacc, net_cfs, dates);
  const xirr_val = calculateXIRR(net_cfs, dates);

  const t0 = dates[0].getTime();
  let pv_revenue_m1_mn = 0;
  for (let m = 1; m <= N; m++) {
    const t = (dates[m].getTime() - t0) / (365 * 24 * 60 * 60 * 1000);
    pv_revenue_m1_mn += periods[m].revenue / Math.pow(1 + wacc, t);
  }

  const capex_denom =
    total_capex_m0 > 0
      ? total_capex_m0
      : (proj.capex || []).reduce((s, c) => {
          const rate_conv = c.currency === 'USD' ? kurs_usd : 1;
          return s + parseFloat(c.amount || 0) * rate_conv;
        }, 0);

  const bcr_val = capex_denom === 0 ? 0 : pv_revenue_m1_mn / capex_denom;

  let total_net_inflow = 0;
  for (let m = 1; m <= N; m++) total_net_inflow += periods[m].net_cashflow;
  const simple_roi = capex_denom === 0 ? 0 : total_net_inflow / capex_denom;

  const payback_val = calculatePayback(
    periods.map((p) => p.cumulative_cashflow),
    net_cfs
  );

  let conclusion = 'TIDAK_LAYAK';
  if (xnpv_val > 0 && xirr_val >= wacc && bcr_val >= bcr_mandatory && payback_val > 0 && payback_val < N) {
    conclusion = 'LAYAK';
  } else if (xnpv_val > 0 && xirr_val >= wacc && bcr_val >= bcr_minimum) {
    conclusion = 'BERSYARAT';
  } else if (xnpv_val > 0 && xirr_val >= wacc && bcr_val > 1) {
    conclusion = 'MARGINAL';
  }

  return {
    xirr: Number.isNaN(xirr_val) ? 0 : xirr_val,
    xnpv: xnpv_val,
    bcr: bcr_val,
    simple_roi,
    payback_months: payback_val,
    conclusion,
    wacc_used: wacc,
    inflation_used: (proj.inflation_rate_override != null ? proj.inflation_rate_override / 100 : (globalAss.inflation_annual !== undefined ? (Math.pow(1 + globalAss.inflation_annual / 100, 1 / 12) - 1) : globalAss.inflation_monthly / 100)),
    kurs_usd_used: kurs_usd,
    capex_total: capex_denom,
    calculated_at: new Date().toISOString(),
  };
}

export function runCalculationOnProject(proj, globalAss) {
  const { dates, periods, net_cfs, wacc, inflation, kurs_usd, otc_amount, total_capex_m0 } = computeCashflowMonthly(proj, globalAss);
  proj.otc_amount = otc_amount;
  proj.cashflow_monthly = periods;
  proj.kpi = computeProjectKpi({ dates, periods, net_cfs, wacc, kurs_usd, total_capex_m0 }, proj, globalAss);
  // Preserve legacy field expected elsewhere
  proj.kpi.inflation_used = inflation;
  return proj;
}
