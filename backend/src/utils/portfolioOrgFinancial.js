/** Agregat CAPEX / OPEX / Revenue per unit organisasi — lifetime cashflow KKF */

import { getProjectLifetimeFinancials } from './projectLifetimeFinancials.js';

function unitKey(id) {
  return id ? String(id) : '__unassigned__';
}

function sumProjectFinancials(projects, globalAss) {
  return projects.reduce(
    (acc, p) => {
      const fin = getProjectLifetimeFinancials(p, globalAss);
      if (!fin) return acc;
      return {
        capex: acc.capex + fin.capex,
        opex: acc.opex + fin.opex,
        revenue: acc.revenue + fin.revenue,
      };
    },
    { capex: 0, opex: 0, revenue: 0 }
  );
}

/**
 * @param {object[]} projects
 * @param {{ id: string, code: string, name: string, type: string }[]} orgUnits
 * @param {object|null} globalAss assumptions_master untuk proyek tanpa cashflow tersimpan
 */
export function buildPortfolioOrgFinancial(projects, orgUnits, globalAss = null) {
  const byUnit = new Map();
  for (const p of projects) {
    const key = unitKey(p.org_unit_id);
    const list = byUnit.get(key) || [];
    list.push(p);
    byUnit.set(key, list);
  }

  function rowsForType(type) {
    const units = orgUnits.filter((u) => u.type === type);
    const rows = units
      .map((u) => {
        const projs = byUnit.get(unitKey(u.id)) || [];
        const fin = sumProjectFinancials(projs, globalAss);
        return {
          id: u.id,
          code: u.code,
          name: u.name,
          type: u.type,
          project_count: projs.length,
          capex: fin.capex,
          opex: fin.opex,
          revenue: fin.revenue,
          cost: fin.capex + fin.opex,
        };
      })
      .filter((r) => r.project_count > 0);

    return rows.sort((a, b) => b.revenue + b.cost - (a.revenue + a.cost));
  }

  return {
    pusat: rowsForType('PUSAT'),
    sbu: rowsForType('SBU'),
  };
}
