/**
 * Insert ~20 demo projects (all statuses). Safe to re-run — skips existing project_code.
 * Usage: node src/seed-demo-projects.js
 */
import dotenv from 'dotenv';
import { pool, initDb, query } from './db.js';
import { runCalculationOnProject } from './services/calculationEngine.js';
import { getDemoProjectDefinitions } from './data/demoProjects.js';

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
  notes: 'Demo seed',
};

async function seedDemoProjects() {
  await initDb();

  const { rows: assumptionsRows } = await query(
    `SELECT data FROM assumptions_master ORDER BY updated_at DESC LIMIT 1`
  );
  const assumptions = assumptionsRows[0]?.data || defaultAssumptions;

  let inserted = 0;
  let skipped = 0;

  for (const raw of getDemoProjectDefinitions()) {
    const { rows: existing } = await query(`SELECT id FROM projects WHERE project_code = $1`, [
      raw.project_code,
    ]);
    if (existing.length) {
      skipped += 1;
      continue;
    }

    let proj = { ...raw };
    proj = runCalculationOnProject(proj, assumptions);

    const detail = {
      customer_name: proj.customer_name,
      contract_number: proj.contract_number,
      pic_sales: proj.pic_sales,
      capex: proj.capex,
      opex: proj.opex,
      revenue: proj.revenue,
      otc_amount: proj.otc_amount,
      approval_chain: proj.approval_chain,
      versions: proj.versions.map((v) => ({
        ...v,
        xirr: proj.kpi?.xirr,
        xnpv: proj.kpi?.xnpv,
        bcr: proj.kpi?.bcr,
      })),
      cashflow_monthly: proj.cashflow_monthly,
      kpi: proj.kpi,
    };

    await query(
      `INSERT INTO projects (id, created_by, project_code, project_name, status,
        project_duration_months, duration_category, contract_start_date, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        raw.id,
        raw.created_by,
        raw.project_code,
        raw.project_name,
        raw.status,
        raw.project_duration_months,
        raw.duration_category,
        raw.contract_start_date,
        JSON.stringify(detail),
      ]
    );

    if (proj.kpi && ['COMPUTED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED_L1', 'APPROVED_FINAL', 'REJECTED'].includes(raw.status)) {
      const inputSnapshot = {
        project_name: raw.project_name,
        contract_start_date: raw.contract_start_date,
        project_duration_months: raw.project_duration_months,
        capex: raw.capex,
        opex: raw.opex,
        revenue: raw.revenue,
        otc_amount: raw.otc_amount,
      };
      const resultSnapshot = { kpi: proj.kpi, cashflow_monthly: proj.cashflow_monthly };
      await query(
        `INSERT INTO calculation_versions (project_id, version_number, duration_months, input_snapshot, result_snapshot, created_by_name)
         VALUES ($1, 1, $2, $3, $4, 'Demo Seed')`,
        [raw.id, raw.project_duration_months, JSON.stringify(inputSnapshot), JSON.stringify(resultSnapshot)]
      );
    }

    inserted += 1;
  }

  console.log(`Demo projects: ${inserted} inserted, ${skipped} skipped (already exist).`);
  await pool.end();
}

seedDemoProjects().catch((err) => {
  console.error(err);
  process.exit(1);
});
