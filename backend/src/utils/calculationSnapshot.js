import { query } from '../db.js';

export function buildSnapshotsFromProject(proj) {
  const inputSnapshot = {
    snapshot_type: proj.snapshot_type || 'CALC',
    project_code: proj.project_code,
    project_name: proj.project_name,
    customer_name: proj.customer_name,
    contract_number: proj.contract_number,
    pic_sales: proj.pic_sales,
    contract_start_date: proj.contract_start_date,
    project_duration_months: proj.project_duration_months,
    duration_category: proj.duration_category,
    org_unit_id: proj.org_unit_id || null,
    segment: proj.segment || null,
    wacc_override: proj.wacc_override,
    inflation_rate_override: proj.inflation_rate_override,
    kurs_usd_override: proj.kurs_usd_override,
    bcr_threshold_override: proj.bcr_threshold_override,
    otc_amount: proj.otc_amount,
    capex: proj.capex || [],
    opex: proj.opex || [],
    revenue: proj.revenue || [],
    submit_comment: proj.submit_comment || null,
  };
  const resultSnapshot = {
    kpi: proj.kpi,
    cashflow_monthly: proj.cashflow_monthly,
  };
  return { inputSnapshot, resultSnapshot };
}

/**
 * Persist calculation version + bump projects.current_version.
 * @returns {Promise<number>} new version_number
 */
export async function createCalculationSnapshot({
  projectId,
  proj,
  userId,
  userName,
  snapshotType = 'CALC',
}) {
  const { rows: lastVer } = await query(
    `SELECT COALESCE(MAX(version_number), 0)::int AS v FROM calculation_versions WHERE project_id = $1`,
    [projectId]
  );
  const verNum = (lastVer[0]?.v || 0) + 1;

  const projWithType = { ...proj, snapshot_type: snapshotType };
  const { inputSnapshot, resultSnapshot } = buildSnapshotsFromProject(projWithType);

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
      userId,
      userName,
    ]
  );

  await query(`UPDATE projects SET current_version = $1, updated_at = NOW() WHERE id = $2`, [
    verNum,
    projectId,
  ]);

  return verNum;
}
