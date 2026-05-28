import type { CashflowPeriod, Project } from "@/types/navpro";
import { getProjectCapexTotal } from "@/lib/project-mappers";

export type LifetimeFinancials = {
  capex: number;
  opex: number;
  revenue: number;
  cost: number;
};

export function totalsFromCashflowMonthly(
  cashflowMonthly?: CashflowPeriod[] | null
): LifetimeFinancials | null {
  if (!cashflowMonthly?.length) return null;

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

  return { capex, opex, revenue, cost: capex + opex };
}

/** Revenue & OPEX = total lifetime cashflow; Cost = CAPEX + OPEX lifetime. */
export function getProjectLifetimeFinancials(project: Project): LifetimeFinancials | null {
  const fromCashflow = totalsFromCashflowMonthly(project.cashflow_monthly);
  if (fromCashflow) return fromCashflow;

  if (
    project.kpi?.lifetime_revenue_total != null &&
    Number.isFinite(Number(project.kpi.lifetime_revenue_total))
  ) {
    const capex = getProjectCapexTotal(project);
    const opex = Number(project.kpi.lifetime_opex_total) || 0;
    const revenue = Number(project.kpi.lifetime_revenue_total) || 0;
    return { capex, opex, revenue, cost: capex + opex };
  }

  return null;
}
