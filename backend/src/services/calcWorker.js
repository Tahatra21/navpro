import { query, rowToProject, projectToDetail } from '../db.js';
import { runCalculationOnProject } from './calculationEngine.js';
import { addAuditLog, addNotification } from '../utils/audit.js';

async function getAssumptions() {
  const { rows } = await query(`SELECT data FROM assumptions_master ORDER BY id DESC LIMIT 1`);
  return rows[0]?.data || {
    wacc_annual: 9.72,
    inflation_annual: 3.0,
    inflation_monthly: 0.2466,
    bcr_mandatory: 1.23,
    bcr_minimum: 1.08,
    kurs_usd: 16500,
  };
}

export async function processCalcJob(job) {
  const { projectId, actor } = job.data || {};
  if (!projectId) throw new Error('projectId required');

  const { rows: existing } = await query(`SELECT * FROM projects WHERE id = $1`, [projectId]);
  if (!existing[0]) throw new Error('project not found');

  let proj = rowToProject(existing[0]);
  const assumptions = await getAssumptions();
  proj = runCalculationOnProject(proj, assumptions);
  proj.status = 'COMPUTED';

  const { rows: lastVer } = await query(
    `SELECT COALESCE(MAX(version_number), 0)::int AS v FROM calculation_versions WHERE project_id = $1`,
    [projectId]
  );
  const verNum = (lastVer[0]?.v || 0) + 1;

  const inputSnapshot = {
    project_code: proj.project_code,
    project_name: proj.project_name,
    customer_name: proj.customer_name,
    contract_number: proj.contract_number,
    pic_sales: proj.pic_sales,
    contract_start_date: proj.contract_start_date,
    project_duration_months: proj.project_duration_months,
    duration_category: proj.duration_category,
    wacc_override: proj.wacc_override,
    inflation_rate_override: proj.inflation_rate_override,
    kurs_usd_override: proj.kurs_usd_override,
    bcr_threshold_override: proj.bcr_threshold_override,
    otc_amount: proj.otc_amount,
    capex: proj.capex || [],
    opex: proj.opex || [],
    revenue: proj.revenue || [],
  };
  const resultSnapshot = { kpi: proj.kpi, cashflow_monthly: proj.cashflow_monthly };

  await query(
    `INSERT INTO calculation_versions
      (project_id, version_number, duration_months, input_snapshot, result_snapshot, created_by, created_by_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      projectId,
      verNum,
      proj.project_duration_months,
      JSON.stringify(inputSnapshot),
      JSON.stringify(resultSnapshot),
      actor?.userId || null,
      actor?.userName || 'Async Worker',
    ]
  );

  proj.versions = proj.versions || [];
  proj.versions.push({
    version_number: verNum,
    duration_months: proj.project_duration_months,
    created_at: new Date().toISOString(),
    created_by_name: actor?.userName || 'Async Worker',
    xirr: proj.kpi.xirr,
    xnpv: proj.kpi.xnpv,
    bcr: proj.kpi.bcr,
    conclusion: proj.kpi.conclusion,
  });

  await query(`UPDATE projects SET status = 'COMPUTED', detail = $1, updated_at = NOW() WHERE id = $2`, [
    JSON.stringify(projectToDetail(proj)),
    projectId,
  ]);

  await addAuditLog({
    userId: actor?.userId || null,
    userName: actor?.userName || 'Async Worker',
    projectId,
    action: 'CALCULATE_ASYNC',
    oldVal: null,
    newVal: `${proj.project_code} (Versi ${verNum}, XIRR: ${(proj.kpi.xirr * 100).toFixed(2)}%)`,
  });

  await addNotification({
    userId: actor?.userId || null,
    title: 'Kalkulasi Selesai (Async)',
    body: `Kalkulasi versi ${verNum} selesai untuk proyek ${proj.project_code} — ${proj.project_name}.`,
    projectId,
  });

  return { projectId, versionNumber: verNum };
}

