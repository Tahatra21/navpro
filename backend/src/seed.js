import bcrypt from 'bcryptjs';
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
  notes: 'Memo DirKeu 16 Sep 2025 & VP Keuangan April 2026',
};

async function seed() {
  await initDb();

  await query(
    `UPDATE users SET email = REPLACE(email, '@iconplus.co.id', '@navpro.app')
     WHERE email LIKE '%@iconplus.co.id'`
  );

  const seeded = await query(`SELECT value FROM app_meta WHERE key = 'seeded'`);
  if (seeded.rows[0]?.value === '1') {
    console.log('Database already seeded.');
    await pool.end();
    return;
  }

  const passwordHash = await bcrypt.hash('Navpro@2026', 10);

  const users = [
    { id: '11111111-1111-1111-1111-111111111101', email: 'budi.santoso@navpro.app', full_name: 'Budi Santoso', role: 'SUPER_ADMIN' },
    { id: '11111111-1111-1111-1111-111111111102', email: 'ani.lestari@navpro.app', full_name: 'Ani Lestari', role: 'FINANCE_ADMIN' },
    { id: '11111111-1111-1111-1111-111111111103', email: 'rian.hidayat@navpro.app', full_name: 'Rian Hidayat', role: 'SA' },
    { id: '11111111-1111-1111-1111-111111111104', email: 'dewi.sartika@navpro.app', full_name: 'Dewi Sartika', role: 'MANAGER' },
    { id: '11111111-1111-1111-1111-111111111105', email: 'irwan.setiawan@navpro.app', full_name: 'Irwan Setiawan', role: 'GM_SRM' },
  ];

  for (const u of users) {
    await query(
      `INSERT INTO users (id, email, password_hash, full_name, role) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (email) DO NOTHING`,
      [u.id, u.email, passwordHash, u.full_name, u.role]
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

  const mockProjects = getDemoProjectDefinitions();

  for (const raw of mockProjects) {
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
      versions: proj.versions.map((v, i) => ({
        ...v,
        xirr: proj.kpi.xirr,
        xnpv: proj.kpi.xnpv,
        bcr: proj.kpi.bcr,
      })),
      cashflow_monthly: proj.cashflow_monthly,
      kpi: proj.kpi,
    };

    await query(
      `INSERT INTO projects (id, created_by, project_code, project_name, status,
        project_duration_months, duration_category, contract_start_date, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
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
  }

  await query(
    `INSERT INTO notifications (user_id, title, body, project_id) VALUES ($1,$2,$3,$4)`,
    [
      '11111111-1111-1111-1111-111111111104',
      'Proyek NAVPRO Baru',
      'Proyek FTTH Expansion Jakarta Selatan menunggu review Anda.',
      '22222222-2222-2222-2222-222222222201',
    ]
  );

  await query(
    `INSERT INTO audit_logs (user_name, action, old_val, new_val) VALUES
     ('Rian Hidayat', 'CREATE_PROJECT', null, 'NAVPRO-2026-0001 (FTTH Expansion)'),
     ('Rian Hidayat', 'CALCULATE', null, 'NAVPRO-2026-0001 (XIRR: 18.52%)'),
     ('Dewi Sartika', 'APPROVE_L1', 'SUBMITTED', 'APPROVED_L1'),
     ('Irwan Setiawan', 'APPROVE_FINAL', 'APPROVED_L1', 'APPROVED_FINAL')`
  );

  await query(`INSERT INTO app_meta (key, value) VALUES ('seeded', '1')`);
  console.log('Seed completed. Default password: Navpro@2026');
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
