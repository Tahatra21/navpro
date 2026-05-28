import type { PortfolioOrgFinancialUnit, Project } from "@/types/navpro";
import { getProjectLifetimeFinancials } from "@/lib/project-lifetime-financials";
import { isDashboardNoiseProject } from "@/lib/dashboard-stats";

export type OrgUnitMeta = {
  id: string;
  code: string;
  name: string;
  type: string;
  segment?: string;
  is_active?: boolean;
};

export type OrgUnitFinancialRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  segment?: string;
  projectCount: number;
  CAPEX: number;
  OPEX: number;
  Revenue: number;
};

export type FinancialChartRow = {
  name: string;
  fullName?: string;
  CAPEX: number;
  OPEX: number;
  Revenue: number;
};

const UNASSIGNED_ID = "__unassigned__";

function unitKey(id: string | null | undefined): string {
  return id ? String(id) : UNASSIGNED_ID;
}

function sumProjectFinancials(projects: Project[]) {
  return projects.reduce(
    (acc, p) => {
      const fin = getProjectLifetimeFinancials(p);
      if (!fin) return acc;
      return {
        CAPEX: acc.CAPEX + fin.capex,
        OPEX: acc.OPEX + fin.opex,
        Revenue: acc.Revenue + fin.revenue,
      };
    },
    { CAPEX: 0, OPEX: 0, Revenue: 0 }
  );
}

export function groupProjectsByOrgUnit(projects: Project[]): Map<string, Project[]> {
  const map = new Map<string, Project[]>();
  for (const p of projects) {
    if (isDashboardNoiseProject(p)) continue;
    const key = unitKey(p.org_unit_id);
    const list = map.get(key) || [];
    list.push(p);
    map.set(key, list);
  }
  return map;
}

/** Agregat CAPEX/OPEX/Revenue per unit organisasi untuk tipe PUSAT atau SBU */
export function buildOrgUnitFinancialRows(
  projects: Project[],
  orgUnits: OrgUnitMeta[],
  unitType: "PUSAT" | "SBU"
): OrgUnitFinancialRow[] {
  const byUnit = groupProjectsByOrgUnit(projects);
  const units = orgUnits.filter((u) => u.type === unitType);

  const rows: OrgUnitFinancialRow[] = units.map((u) => {
    const projs = byUnit.get(unitKey(u.id)) || [];
    const fin = sumProjectFinancials(projs);
    return {
      id: u.id,
      code: u.code,
      name: u.name,
      type: u.type,
      segment: u.segment,
      projectCount: projs.length,
      ...fin,
    };
  });

  const unassigned = byUnit.get(UNASSIGNED_ID) || [];
  if (unassigned.length > 0) {
    const fin = sumProjectFinancials(unassigned);
    rows.push({
      id: UNASSIGNED_ID,
      code: "N/A",
      name: "Belum ada unit org",
      type: unitType,
      projectCount: unassigned.length,
      ...fin,
    });
  }

  return rows.sort(
    (a, b) => b.CAPEX + b.OPEX + b.Revenue - (a.CAPEX + a.OPEX + a.Revenue)
  );
}

export function orgRowsToChartRows(rows: OrgUnitFinancialRow[]): FinancialChartRow[] {
  return rows.map((r) => ({
    name: r.code,
    fullName: r.name,
    CAPEX: r.CAPEX,
    OPEX: r.OPEX,
    Revenue: r.Revenue,
  }));
}

export type RevenueVsCostRow = {
  name: string;
  fullName: string;
  Revenue: number;
  Cost: number;
  projectCount: number;
};

export function apiOrgFinancialToRows(units: PortfolioOrgFinancialUnit[]): RevenueVsCostRow[] {
  return units.map((u) => ({
    name: u.code,
    fullName: u.name,
    Revenue: u.revenue,
    Cost: u.cost,
    projectCount: u.project_count,
  }));
}

export function apiOrgFinancialTotals(units: PortfolioOrgFinancialUnit[]): RevenueVsCostRow[] {
  if (!units.length) return [];
  const totals = units.reduce(
    (acc, u) => ({
      Revenue: acc.Revenue + u.revenue,
      Cost: acc.Cost + u.cost,
      projectCount: acc.projectCount + u.project_count,
    }),
    { Revenue: 0, Cost: 0, projectCount: 0 }
  );
  return [
    {
      name: "Total",
      fullName: `${units.length} unit · ${totals.projectCount} proyek`,
      Revenue: totals.Revenue,
      Cost: totals.Cost,
      projectCount: totals.projectCount,
    },
  ];
}

export function orgRowsToRevenueCost(rows: OrgUnitFinancialRow[]): RevenueVsCostRow[] {
  return rows
    .filter((r) => r.projectCount > 0 && r.id !== UNASSIGNED_ID)
    .map((r) => ({
      name: r.code,
      fullName: r.name,
      Revenue: r.Revenue,
      Cost: r.CAPEX + r.OPEX,
      projectCount: r.projectCount,
    }));
}

/** Agregat satu baris untuk seluruh tab (Pusat atau SBU) */
export function aggregateRevenueCost(rows: OrgUnitFinancialRow[]): RevenueVsCostRow[] {
  const active = rows.filter((r) => r.projectCount > 0 && r.id !== UNASSIGNED_ID);
  if (!active.length) return [];
  const totals = active.reduce(
    (acc, r) => ({
      Revenue: acc.Revenue + r.Revenue,
      Cost: acc.Cost + r.CAPEX + r.OPEX,
      projectCount: acc.projectCount + r.projectCount,
    }),
    { Revenue: 0, Cost: 0, projectCount: 0 }
  );
  return [
    {
      name: "Total",
      fullName: `${active.length} unit · ${totals.projectCount} proyek`,
      Revenue: totals.Revenue,
      Cost: totals.Cost,
      projectCount: totals.projectCount,
    },
  ];
}

export function pickDefaultOrgSelection(rows: OrgUnitFinancialRow[], max = 8): string[] {
  return rows
    .filter((r) => r.id !== UNASSIGNED_ID && r.projectCount > 0)
    .slice(0, max)
    .map((r) => r.id);
}
