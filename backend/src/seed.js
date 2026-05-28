import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { pool, initDb, query } from './db.js';
import { runCalculationOnProject } from './services/calculationEngine.js';
import { getDemoProjectDefinitions } from './data/demoProjects.js';
import { loadOrgUnitByCode, resolveOrgUnitFromCode } from './utils/demoProjectOrg.js';
import { getSeedDemoPassword } from './config/security.js';

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
  notes: 'Memo DirKeu 16 Sep 2025 & VP Keuangan April 2026',
};

const DEMO_USER_IDS = {
  'budi.santoso@navpro.app': '11111111-1111-1111-1111-111111111101',
  'ani.lestari@navpro.app': '11111111-1111-1111-1111-111111111102',
  'rian.hidayat@navpro.app': '11111111-1111-1111-1111-111111111103',
  'sari.wulandari@navpro.app': '11111111-1111-1111-1111-111111111104',
  'dewi.sartika@navpro.app': '11111111-1111-1111-1111-111111111105',
  'irwan.setiawan@navpro.app': '11111111-1111-1111-1111-111111111106',
};

async function seed() {
  await initDb();

  await query(
    `UPDATE users SET email = REPLACE(email, '@iconplus.co.id', '@navpro.app')
     WHERE email LIKE '%@iconplus.co.id'`
  );

  // Ensure organization units exist (BRD KKF v2.0), even if DB was previously seeded.
  const orgUnits = [
    // PUSAT (4)
    { code: 'SOLAR-ENT-1', name: 'Sub Bid SA Enterprise 1', type: 'PUSAT', segment: 'ENT1' },
    { code: 'SOLAR-ENT-2', name: 'Sub Bid SA Enterprise 2', type: 'PUSAT', segment: 'ENT2' },
    { code: 'SOLAR-PLN-1', name: 'Sub Bid SA PLN 1', type: 'PUSAT', segment: 'PLN1' },
    { code: 'SOLAR-PLN-2', name: 'Sub Bid SA PLN 2', type: 'PUSAT', segment: 'PLN2' },
    // SBU REGIONAL (9) — segment ENT2
    { code: 'REG-SBU', name: 'Tch/Jtc Solar SBU', type: 'SBU', segment: 'ENT2' },
    { code: 'REG-SBT', name: 'Tch/Jtc Solar SBT', type: 'SBU', segment: 'ENT2' },
    { code: 'REG-SBS', name: 'Tch/Jtc Solar SBS', type: 'SBU', segment: 'ENT2' },
    { code: 'REG-JBR', name: 'Tch/Jtc Solar JBB', type: 'SBU', segment: 'ENT2' },
    { code: 'REG-JBTG', name: 'Tch/Jtc Solar JTG', type: 'SBU', segment: 'ENT2' },
    { code: 'REG-JBTM', name: 'Tch/Jtc Solar JTM', type: 'SBU', segment: 'ENT2' },
    { code: 'REG-BNR', name: 'Tch/Jtc Solar BNR', type: 'SBU', segment: 'ENT2' },
    { code: 'REG-KLM', name: 'Tch/Jtc Solar KLM', type: 'SBU', segment: 'ENT2' },
    { code: 'REG-SIBT', name: 'Tch/Jtc Solar SIBT', type: 'SBU', segment: 'ENT2' },
  ];
  for (const ou of orgUnits) {
    await query(
      `INSERT INTO organization_units (code, name, type, segment, is_active)
       VALUES ($1,$2,$3,$4,true)
       ON CONFLICT (code) DO NOTHING`,
      [ou.code, ou.name, ou.type, ou.segment]
    );
  }

  // Assign demo org units even when DB was already seeded (idempotent).
  const { rows: regSbu } = await query(`SELECT id FROM organization_units WHERE code = 'REG-SBU' LIMIT 1`);
  const { rows: ent2 } = await query(`SELECT id FROM organization_units WHERE code = 'SOLAR-ENT-2' LIMIT 1`);
  if (regSbu[0]) {
    await query(
      `UPDATE users SET org_unit_id = COALESCE(org_unit_id, $1), org_level = COALESCE(org_level, 'L4')
       WHERE email = 'rian.hidayat@navpro.app'`,
      [regSbu[0].id]
    );
    await query(
      `UPDATE users SET org_unit_id = COALESCE(org_unit_id, $1), org_level = COALESCE(org_level, 'L3')
       WHERE email = 'sari.wulandari@navpro.app'`,
      [regSbu[0].id]
    );
  }
  if (ent2[0]) {
    await query(
      `UPDATE users SET org_unit_id = COALESCE(org_unit_id, $1), org_level = COALESCE(org_level, 'L2')
       WHERE email = 'dewi.sartika@navpro.app'`,
      [ent2[0].id]
    );
  }
  await query(
    `UPDATE projects AS p
     SET org_unit_id = u.org_unit_id, segment = ou.segment, updated_at = NOW()
     FROM users u
     JOIN organization_units ou ON ou.id = u.org_unit_id
     WHERE p.created_by = u.id
       AND (p.org_unit_id IS NULL OR p.segment IS NULL)
       AND u.org_unit_id IS NOT NULL`
  );

  const slaV2 = [
    {
      role_key: 'ASMAN',
      role_name: 'Assistant Manager SA',
      sla_working_days: 2,
      reminder_hours: 24,
      escalation_hours: 48,
      escalate_to_role: 'MANAGER',
    },
    {
      role_key: 'MANAGER',
      role_name: 'Manager SA Segment',
      sla_working_days: 1,
      reminder_hours: 12,
      escalation_hours: 24,
      escalate_to_role: 'VP_SA',
    },
  ];
  for (const s of slaV2) {
    await query(
      `INSERT INTO sla_config (role_key, role_name, sla_working_days, reminder_hours, escalation_hours, escalate_to_role)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (role_key) DO UPDATE SET
         role_name = EXCLUDED.role_name,
         sla_working_days = EXCLUDED.sla_working_days,
         reminder_hours = EXCLUDED.reminder_hours,
         escalation_hours = EXCLUDED.escalation_hours,
         escalate_to_role = EXCLUDED.escalate_to_role`,
      [
        s.role_key,
        s.role_name,
        s.sla_working_days,
        s.reminder_hours,
        s.escalation_hours,
        s.escalate_to_role,
      ]
    );
  }

  const seedPassword = getSeedDemoPassword();

  // Ensure BRD v2 demo users exist even if DB was seeded before ASMAN was added.
  const demoHash = await bcrypt.hash(seedPassword, 10);
  const demoUsers = [
    { email: 'sari.wulandari@navpro.app', full_name: 'Sari Wulandari', role: 'ASMAN' },
    { email: 'dewi.sartika@navpro.app', full_name: 'Dewi Sartika', role: 'MANAGER' },
  ];
  for (const u of demoUsers) {
    const userId = DEMO_USER_IDS[u.email] || uuidv4();
    await query(
      `INSERT INTO users (id, email, password_hash, full_name, role, is_active)
       VALUES ($1,$2,$3,$4,$5,true)
       ON CONFLICT (email) DO NOTHING`,
      [userId, u.email, demoHash, u.full_name, u.role]
    );
  }
  if (
    process.env.SEED_RESET_DEMO_PASSWORDS === 'true' &&
    process.env.NODE_ENV !== 'production'
  ) {
    await query(
      `UPDATE users SET password_hash = $1
       WHERE email = ANY($2::text[])`,
      [
        demoHash,
        [
          'budi.santoso@navpro.app',
          'ani.lestari@navpro.app',
          'rian.hidayat@navpro.app',
          'sari.wulandari@navpro.app',
          'dewi.sartika@navpro.app',
          'irwan.setiawan@navpro.app',
        ],
      ]
    );
    console.log('SEED_RESET_DEMO_PASSWORDS=true — demo user passwords updated.');
  }

  const seeded = await query(`SELECT value FROM app_meta WHERE key = 'seeded'`);
  if (seeded.rows[0]?.value === '1') {
    console.log('Database already seeded.');
    await pool.end();
    return;
  }

  const passwordHash = await bcrypt.hash(seedPassword, 10);

  const users = [
    { email: 'budi.santoso@navpro.app', full_name: 'Budi Santoso', role: 'SUPER_ADMIN' },
    { email: 'ani.lestari@navpro.app', full_name: 'Ani Lestari', role: 'FINANCE_ADMIN' },
    { email: 'rian.hidayat@navpro.app', full_name: 'Rian Hidayat', role: 'SA' },
    { email: 'sari.wulandari@navpro.app', full_name: 'Sari Wulandari', role: 'ASMAN' },
    { email: 'dewi.sartika@navpro.app', full_name: 'Dewi Sartika', role: 'MANAGER' },
    { email: 'irwan.setiawan@navpro.app', full_name: 'Irwan Setiawan', role: 'GM_SRM' },
  ];

  for (const u of users) {
    const userId = DEMO_USER_IDS[u.email] || uuidv4();
    await query(
      `INSERT INTO users (id, email, password_hash, full_name, role) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (email) DO NOTHING`,
      [userId, u.email, passwordHash, u.full_name, u.role]
    );
  }

  await query(`INSERT INTO assumptions_master (data) VALUES ($1)`, [JSON.stringify(defaultAssumptions)]);
  await query(`INSERT INTO assumptions_history (data, updated_by_name) VALUES ($1, $2)`, [
    JSON.stringify(defaultAssumptions),
    'Finance Admin',
  ]);

  const presets = [
    { id: 'pre-1', preset_name: 'Short Term (12 Bulan)', duration_months: 12, category: 'SHORT_TERM' },
    { id: 'pre-2', preset_name: 'Mid Term (24 Bulan)', duration_months: 24, category: 'MID_TERM' },
    { id: 'pre-3', preset_name: 'Mid Term (36 Bulan)', duration_months: 36, category: 'MID_TERM' },
    { id: 'pre-4', preset_name: 'Long Term (60 Bulan)', duration_months: 60, category: 'LONG_TERM' },
    { id: 'pre-5', preset_name: 'Extended (120 Bulan)', duration_months: 120, category: 'EXTENDED' },
  ];
  for (const p of presets) {
    await query(
      `INSERT INTO duration_presets (id, preset_name, duration_months, category) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [p.id, p.preset_name, p.duration_months, p.category]
    );
  }

  const sla = [
    { role_key: 'MANAGER', role_name: 'Manager', sla_working_days: 2, reminder_hours: 24, escalation_hours: 48, escalate_to_role: 'GM_SRM' },
    { role_key: 'GM_SRM', role_name: 'GM / SRM', sla_working_days: 1, reminder_hours: 12, escalation_hours: 24, escalate_to_role: 'FINANCE_ADMIN' },
  ];
  for (const s of sla) {
    await query(
      `INSERT INTO sla_config (role_key, role_name, sla_working_days, reminder_hours, escalation_hours, escalate_to_role)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
      [s.role_key, s.role_name, s.sla_working_days, s.reminder_hours, s.escalation_hours, s.escalate_to_role]
    );
  }

  const capexCats = ['HARDWARE', 'SOFTWARE', 'CIVIL', 'NETWORK', 'POWER', 'VEHICLE', 'INTEGRATION', 'OTHER'];
  const opexCats = ['LABOR', 'MAINTENANCE', 'ELECTRICITY', 'BANDWIDTH', 'RENT', 'INSURANCE', 'ADMIN', 'TRANSPORT', 'OVERHEAD', 'OTHER'];
  for (const c of capexCats) {
    await query(`INSERT INTO categories (type, code) VALUES ('capex', $1) ON CONFLICT DO NOTHING`, [c]);
  }
  for (const c of opexCats) {
    await query(`INSERT INTO categories (type, code) VALUES ('opex', $1) ON CONFLICT DO NOTHING`, [c]);
  }

  const sysParams = [
    ['xirr_max_iterations', '1000', 'FORMULA', 'integer'],
    ['maintenance_mode', 'false', 'FEATURE_FLAG', 'boolean'],
    ['jwt_expiry_minutes', '60', 'SECURITY', 'integer'],
  ];
  for (const [key, val, cat, type] of sysParams) {
    await query(
      `INSERT INTO system_config (config_key, config_val, category, data_type) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [key, val, cat, type]
    );
  }

  // Legacy demo used predictable UUIDs (security risk) — remove before re-seeding.
  await query(`DELETE FROM projects WHERE id::text LIKE '22222222-2222-2222-2222-%'`);

  const mockProjects = getDemoProjectDefinitions();
  const orgByCode = await loadOrgUnitByCode(query);

  for (const raw of mockProjects) {
    const { rows: existing } = await query(`SELECT id FROM projects WHERE project_code = $1`, [
      raw.project_code,
    ]);
    if (existing.length) continue;

    const { orgUnitId, segment } = resolveOrgUnitFromCode(orgByCode, raw.org_unit_code);
    const projectId = uuidv4();
    let proj = { ...raw, wacc_override: null, inflation_rate_override: null, bcr_threshold_override: null };
    proj = runCalculationOnProject(proj, defaultAssumptions);
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
  }

  const { rows: ftthRows } = await query(
    `SELECT id FROM projects WHERE project_code = 'NAVPRO-2026-0001' LIMIT 1`
  );
  if (ftthRows[0]?.id) {
    await query(
      `INSERT INTO notifications (user_id, title, body, project_id) VALUES ($1,$2,$3,$4)`,
      [
        '11111111-1111-1111-1111-111111111104',
        'Proyek NAVPRO Baru',
        'Proyek FTTH Expansion Jakarta Selatan menunggu review Anda.',
        ftthRows[0].id,
      ]
    );
  }

  await query(
    `INSERT INTO audit_logs (user_name, action, old_val, new_val) VALUES
     ('Rian Hidayat', 'CREATE_PROJECT', null, 'NAVPRO-2026-0001 (FTTH Expansion)'),
     ('Rian Hidayat', 'CALCULATE', null, 'NAVPRO-2026-0001 (XIRR: 18.52%)'),
     ('Dewi Sartika', 'APPROVE_L1', 'SUBMITTED', 'APPROVED_L1'),
     ('Irwan Setiawan', 'APPROVE_FINAL', 'APPROVED_L1', 'APPROVED_FINAL')`
  );

  await query(`INSERT INTO app_meta (key, value) VALUES ('seeded', '1')`);
  console.log('Seed completed. Use SEED_DEMO_PASSWORD from backend/.env to sign in (password is not logged).');
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
