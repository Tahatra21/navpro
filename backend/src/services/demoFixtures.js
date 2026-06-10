/**
 * Idempotent demo projects + E2E notifications.
 * Safe to run on every `node src/seed.js` — fixes empty DB after early-exit seed.
 */
import { v4 as uuidv4 } from 'uuid';
import { runCalculationOnProject } from './calculationEngine.js';
import { getDemoProjectDefinitions } from '../data/demoProjects.js';
import { loadOrgUnitByCode, resolveOrgUnitFromCode } from '../utils/demoProjectOrg.js';

export const DEMO_USER_IDS = {
  'admin@navpro.app': '11111111-1111-1111-1111-111111111100',
  'sari.wulandari@navpro.app': '11111111-1111-1111-1111-111111111104',
  'dewi.sartika@navpro.app': '11111111-1111-1111-1111-111111111105',
};

const E2E_NOTIFICATIONS = [
  {
    id: '33333333-3333-3333-3333-333333333301',
    userId: DEMO_USER_IDS['admin@navpro.app'],
    title: 'Approval menunggu review',
    body: 'Proyek NAVPRO-2026-0001 (FTTH Expansion Jakarta Selatan) menunggu persetujuan.',
    projectCode: 'NAVPRO-2026-0001',
  },
  {
    id: '33333333-3333-3333-3333-333333333302',
    userId: DEMO_USER_IDS['sari.wulandari@navpro.app'],
    title: 'Proyek menunggu review ASMAN',
    body: 'Proyek FTTH Expansion Jakarta Selatan menunggu review Anda.',
    projectCode: 'NAVPRO-2026-0001',
  },
  {
    id: '33333333-3333-3333-3333-333333333303',
    userId: DEMO_USER_IDS['dewi.sartika@navpro.app'],
    title: 'Approval Manager — SLA aktif',
    body: 'Review kelayakan finansial proyek NAVPRO-2026-0002 dalam batas SLA.',
    projectCode: 'NAVPRO-2026-0002',
  },
];

export async function ensureDemoProjects(query, assumptions) {
  await query(`DELETE FROM projects WHERE id::text LIKE '22222222-2222-2222-2222-%'`);

  const orgByCode = await loadOrgUnitByCode(query);
  let inserted = 0;

  for (const raw of getDemoProjectDefinitions()) {
    const { rows: existing } = await query(`SELECT id FROM projects WHERE project_code = $1`, [
      raw.project_code,
    ]);
    if (existing.length) continue;

    const { orgUnitId, segment } = resolveOrgUnitFromCode(orgByCode, raw.org_unit_code);
    const projectId = uuidv4();
    let proj = { ...raw, wacc_override: null, inflation_rate_override: null, bcr_threshold_override: null };
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
        xirr: proj.kpi.xirr,
        xnpv: proj.kpi.xnpv,
        bcr: proj.kpi.bcr,
      })),
      cashflow_monthly: proj.cashflow_monthly,
      kpi: proj.kpi,
    };

    await query(
      `INSERT INTO projects (id, created_by, org_unit_id, segment, project_code, project_name, status,
        project_duration_months, duration_category, contract_start_date, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        projectId,
        raw.created_by,
        orgUnitId,
        segment,
        raw.project_code,
        raw.project_name,
        raw.status,
        raw.project_duration_months,
        raw.duration_category,
        raw.contract_start_date,
        JSON.stringify(detail),
      ]
    );
    inserted += 1;
  }

  return inserted;
}

export async function ensureE2eNotifications(query) {
  let upserted = 0;
  for (const n of E2E_NOTIFICATIONS) {
    const { rows: proj } = await query(`SELECT id FROM projects WHERE project_code = $1 LIMIT 1`, [
      n.projectCode,
    ]);
    if (!proj[0]?.id) continue;

    await query(
      `INSERT INTO notifications (id, user_id, title, body, project_id, is_read)
       VALUES ($1,$2,$3,$4,$5,false)
       ON CONFLICT (id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         title = EXCLUDED.title,
         body = EXCLUDED.body,
         project_id = EXCLUDED.project_id,
         is_read = false`,
      [n.id, n.userId, n.title, n.body, proj[0].id]
    );
    upserted += 1;
  }
  return upserted;
}

export async function refreshDemoFixtures(query, assumptions) {
  const projects = await ensureDemoProjects(query, assumptions);
  const notifications = await ensureE2eNotifications(query);
  return { projects, notifications };
}
