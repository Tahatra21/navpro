import { query, rowToProject, projectToDetail } from '../db.js';
import { runCalculationOnProject } from './calculationEngine.js';
import { addAuditLog, addNotification } from '../utils/audit.js';
import { createCalculationSnapshot } from '../utils/calculationSnapshot.js';

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

  const verNum = await createCalculationSnapshot({
    projectId,
    proj,
    userId: actor?.userId || null,
    userName: actor?.userName || 'Async Worker',
    snapshotType: 'CALC',
  });

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

