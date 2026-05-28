/**
 * Backfill org_unit_id + segment untuk semua proyek aktif, lalu hitung ulang KPI.
 * Menyelaraskan 26+ proyek demo ke unit Pusat & SBU.
 *
 * Usage: node src/seed-enrich-portfolio.js
 */
import dotenv from 'dotenv';
import { pool, initDb, query, rowToProject } from './db.js';
import { getDemoProjectDefinitions } from './data/demoProjects.js';
import { runCalculationOnProject } from './services/calculationEngine.js';
import { loadOrgUnitByCode, resolveOrgUnitFromCode, fallbackOrgCodeForProject } from './utils/demoProjectOrg.js';

dotenv.config();

const defaultAssumptions = {
  wacc_annual: 9.72,
  inflation_annual: 3.0,
  inflation_monthly: parseFloat(((Math.pow(1 + 3.0 / 100, 1 / 12) - 1) * 100).toFixed(6)),
  bcr_mandatory: 1.23,
  bcr_minimum: 1.08,
  ppn_rate: 12.0,
  kurs_usd: 16500,
  currency: 'IDR',
  effective_date: '2026-04-01',
  notes: 'Portfolio enrich',
};

function projectToDetail(proj) {
  return {
    customer_name: proj.customer_name,
    contract_number: proj.contract_number,
    pic_sales: proj.pic_sales,
    capex: proj.capex || [],
    opex: proj.opex || [],
    revenue: proj.revenue || [],
    otc_amount: proj.otc_amount,
    approval_chain: proj.approval_chain || [],
    versions: (proj.versions || []).map((v) => ({
      ...v,
      xirr: proj.kpi?.xirr,
      xnpv: proj.kpi?.xnpv,
      bcr: proj.kpi?.bcr,
    })),
    cashflow_monthly: proj.cashflow_monthly,
    kpi: proj.kpi,
  };
}

async function enrich() {
  await initDb();

  const orgByCode = await loadOrgUnitByCode(query);
  const defByCode = new Map(getDemoProjectDefinitions().map((d) => [d.project_code, d]));

  const { rows: assumptionsRows } = await query(
    `SELECT data FROM assumptions_master ORDER BY updated_at DESC LIMIT 1`
  );
  const assumptions = assumptionsRows[0]?.data || defaultAssumptions;

  let orgUpdated = 0;
  let recalculated = 0;
  let inserted = 0;
  const byType = { PUSAT: 0, SBU: 0, other: 0 };

  // Insert missing demo definitions (seq 21–26 jika belum ada)
  for (const raw of getDemoProjectDefinitions()) {
    const { rows: existing } = await query(`SELECT id FROM projects WHERE project_code = $1`, [
      raw.project_code,
    ]);
    if (existing.length) continue;

    const { orgUnitId, segment } = resolveOrgUnitFromCode(orgByCode, raw.org_unit_code);
    let proj = { ...raw };
    proj = runCalculationOnProject(proj, assumptions);

    await query(
      `INSERT INTO projects (
         id, created_by, org_unit_id, segment, project_code, project_name, status,
         project_duration_months, duration_category, contract_start_date, detail
       ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        raw.created_by,
        orgUnitId,
        segment,
        raw.project_code,
        raw.project_name,
        raw.status,
        raw.project_duration_months,
        raw.duration_category,
        raw.contract_start_date,
        JSON.stringify(projectToDetail(proj)),
      ]
    );
    inserted += 1;
  }

  const { rows: allRows } = await query(
    `SELECT * FROM projects WHERE status NOT IN ('ARCHIVED', 'CANCELLED') ORDER BY project_code`
  );

  let fallbackIdx = 0;
  for (const row of allRows) {
    const def = defByCode.get(row.project_code);
    const orgCode =
      def?.org_unit_code || fallbackOrgCodeForProject(rowToProject(row), fallbackIdx++);
    const ou = resolveOrgUnitFromCode(orgByCode, orgCode);

    if (ou.type === 'PUSAT') byType.PUSAT += 1;
    else if (ou.type === 'SBU') byType.SBU += 1;
    else byType.other += 1;

    let proj = rowToProject(row);
    proj.org_unit_id = ou.orgUnitId;
    proj.segment = ou.segment;

    if (!proj.capex?.length && def) {
      proj.capex = def.capex;
      proj.opex = def.opex;
      proj.revenue = def.revenue;
      proj.otc_amount = def.otc_amount;
      proj.customer_name = def.customer_name || proj.customer_name;
      proj.contract_number = def.contract_number || proj.contract_number;
      proj.pic_sales = def.pic_sales || proj.pic_sales;
    }

    proj = runCalculationOnProject(proj, assumptions);
    const detail = projectToDetail(proj);

    await query(
      `UPDATE projects SET
         org_unit_id = $1,
         segment = $2,
         detail = $3,
         updated_at = NOW()
       WHERE id = $4`,
      [ou.orgUnitId, ou.segment, JSON.stringify(detail), row.id]
    );
    orgUpdated += 1;
    recalculated += 1;
  }

  console.log('Portfolio enrich selesai.');
  console.log(`  Proyek aktif     : ${allRows.length}`);
  console.log(`  Baru di-insert   : ${inserted}`);
  console.log(`  Di-update (org+KPI): ${orgUpdated}`);
  console.log(`  Per Pusat        : ${byType.PUSAT}`);
  console.log(`  Per SBU          : ${byType.SBU}`);
  if (byType.other) console.log(`  Lainnya          : ${byType.other}`);

  await pool.end();
}

enrich().catch((err) => {
  console.error(err);
  process.exit(1);
});
