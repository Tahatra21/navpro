import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { authRequired, requireRoles } from '../middleware/auth.js';
import { addAuditLog } from '../utils/audit.js';

const router = Router();
router.use(authRequired);
router.use(requireRoles('SUPER_ADMIN', 'FINANCE_ADMIN'));

// Assumptions
router.get('/assumptions', async (_req, res) => {
  const { rows } = await query(`SELECT data FROM assumptions_master ORDER BY id DESC LIMIT 1`);
  res.json(rows[0]?.data || {});
});

router.put('/assumptions', async (req, res) => {
  const data = req.body;
  if (data.inflation_annual != null) {
    data.inflation_monthly = parseFloat(
      (Math.pow(1 + data.inflation_annual / 100, 1 / 12) - 1) * 100
    ).toFixed(6);
  }
  await query(`INSERT INTO assumptions_master (data, updated_by) VALUES ($1, $2)`, [
    JSON.stringify(data),
    req.user.sub,
  ]);
  await query(`INSERT INTO assumptions_history (data, updated_by_name) VALUES ($1, $2)`, [
    JSON.stringify({ ...data, updated_at: new Date().toISOString(), updated_by: req.user.name }),
    req.user.name,
  ]);
  res.json({ assumptions: data });
});

router.put('/assumptions/:key', async (req, res) => {
  const { rows } = await query(`SELECT data FROM assumptions_master ORDER BY id DESC LIMIT 1`);
  const data = { ...(rows[0]?.data || {}), [req.params.key]: req.body.value };
  if (req.params.key === 'inflation_annual' && data.inflation_annual != null) {
    data.inflation_monthly = parseFloat(
      (Math.pow(1 + data.inflation_annual / 100, 1 / 12) - 1) * 100
    ).toFixed(6);
  }
  await query(`INSERT INTO assumptions_master (data, updated_by) VALUES ($1, $2)`, [
    JSON.stringify(data),
    req.user.sub,
  ]);
  await query(`INSERT INTO assumptions_history (data, updated_by_name) VALUES ($1, $2)`, [
    JSON.stringify(data),
    req.user.name,
  ]);
  res.json({ assumptions: data });
});

router.get('/assumptions/history', async (_req, res) => {
  const { rows } = await query(
    `SELECT data, updated_at, updated_by_name AS updated_by FROM assumptions_history ORDER BY id DESC LIMIT 50`
  );
  res.json({ history: rows });
});

// Duration presets
router.get('/duration-presets', async (_req, res) => {
  const { rows } = await query(`SELECT * FROM duration_presets ORDER BY duration_months`);
  res.json({ presets: rows });
});

router.post('/duration-presets', async (req, res) => {
  const b = req.body;
  const id = b.id || `pre-${uuidv4().slice(0, 8)}`;
  await query(
    `INSERT INTO duration_presets (id, preset_name, duration_months, category, bcr_mandatory, bcr_minimum, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      id,
      b.preset_name,
      b.duration_months,
      b.category,
      b.bcr_mandatory ?? 1.23,
      b.bcr_minimum ?? 1.08,
      b.is_active !== false,
    ]
  );
  res.status(201).json({ ok: true, id });
});

router.put('/duration-presets/:id', async (req, res) => {
  const b = req.body;
  await query(
    `UPDATE duration_presets SET preset_name=$1, duration_months=$2, category=$3,
     bcr_mandatory=$4, bcr_minimum=$5, is_active=$6 WHERE id=$7`,
    [
      b.preset_name,
      b.duration_months,
      b.category,
      b.bcr_mandatory,
      b.bcr_minimum,
      b.is_active,
      req.params.id,
    ]
  );
  res.json({ ok: true });
});

router.delete('/duration-presets/:id', async (req, res) => {
  await query(`UPDATE duration_presets SET is_active = false WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

// SLA
router.get('/sla-config', async (_req, res) => {
  const { rows } = await query(`SELECT * FROM sla_config ORDER BY role_key`);
  res.json({ sla: rows });
});

router.put('/sla-config/:role_key', async (req, res) => {
  const b = req.body;
  await query(
    `INSERT INTO sla_config (role_key, role_name, sla_working_days, reminder_hours, escalation_hours, escalate_to_role)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (role_key) DO UPDATE SET
       role_name=$2, sla_working_days=$3, reminder_hours=$4, escalation_hours=$5, escalate_to_role=$6`,
    [
      req.params.role_key,
      b.role_name,
      b.sla_working_days,
      b.reminder_hours,
      b.escalation_hours,
      b.escalate_to_role,
    ]
  );
  res.json({ ok: true });
});

// Categories
router.get('/capex-categories', async (_req, res) => {
  const { rows } = await query(`SELECT code FROM categories WHERE type = 'capex' ORDER BY code`);
  res.json({ categories: rows.map((r) => r.code) });
});

router.get('/opex-categories', async (_req, res) => {
  const { rows } = await query(`SELECT code FROM categories WHERE type = 'opex' ORDER BY code`);
  res.json({ categories: rows.map((r) => r.code) });
});

router.post('/capex-categories', async (req, res) => {
  await query(`INSERT INTO categories (type, code) VALUES ('capex', $1) ON CONFLICT DO NOTHING`, [
    req.body.code,
  ]);
  res.status(201).json({ ok: true });
});

router.post('/opex-categories', async (req, res) => {
  await query(`INSERT INTO categories (type, code) VALUES ('opex', $1) ON CONFLICT DO NOTHING`, [
    req.body.code,
  ]);
  res.status(201).json({ ok: true });
});

// System config
router.get('/system-config', async (_req, res) => {
  const { rows } = await query(`SELECT * FROM system_config ORDER BY category, config_key`);
  const grouped = {};
  for (const r of rows) {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push({
      key: r.config_key,
      val: r.config_val,
      type: r.data_type,
      desc: r.description,
    });
  }
  res.json({ config: rows, grouped });
});

router.put('/system-config/:key', async (req, res) => {
  await query(`UPDATE system_config SET config_val = $1 WHERE config_key = $2`, [
    String(req.body.val),
    req.params.key,
  ]);
  res.json({ ok: true });
});

// Users
router.get('/users', async (_req, res) => {
  const { rows } = await query(
    `SELECT id, email, full_name, role, is_active, last_login_at, created_at FROM users ORDER BY full_name`
  );
  res.json({ users: rows });
});

router.post('/users', async (req, res) => {
  const b = req.body;
  const hash = await bcrypt.hash(b.password || 'Navpro@2026', 10);
  const id = uuidv4();
  await query(
    `INSERT INTO users (id, email, password_hash, full_name, role, is_active) VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, b.email.toLowerCase(), hash, b.full_name, b.role, b.is_active !== false]
  );
  res.status(201).json({ id });
});

router.put('/users/:id', async (req, res) => {
  const b = req.body;
  // Email change is restricted to SUPER_ADMIN only.
  // FINANCE_ADMIN can still update name/role/active status for operational needs.
  if (req.user.role === 'SUPER_ADMIN') {
    await query(
      `UPDATE users SET full_name=$1, role=$2, is_active=$3, email=$4 WHERE id=$5`,
      [b.full_name, b.role, b.is_active, String(b.email || '').toLowerCase(), req.params.id]
    );
  } else {
    await query(
      `UPDATE users SET full_name=$1, role=$2, is_active=$3 WHERE id=$4`,
      [b.full_name, b.role, b.is_active, req.params.id]
    );
  }
  res.json({ ok: true });
});

// Reset password (SUPER_ADMIN only)
router.post('/users/:id/reset-password', requireRoles('SUPER_ADMIN'), async (req, res) => {
  const newPassword = String(req.body?.new_password || 'Navpro@2026');
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Bad Request', message: 'Password minimal 8 karakter' });
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, req.params.id]);
  await addAuditLog({
    userId: req.user.sub,
    userName: req.user.name,
    action: 'ADMIN_RESET_PASSWORD',
    oldVal: req.params.id,
    newVal: 'RESET',
  });

  res.json({ ok: true });
});

// Audit logs
router.get('/audit-logs', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
  const { rows } = await query(
    `SELECT id, created_at AS timestamp, user_name AS user, action, old_val, new_val, project_id
     FROM audit_logs ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  res.json({ logs: rows });
});

// System health
router.get('/system-health', async (_req, res) => {
  const { rows: projCount } = await query(
    `SELECT COUNT(*)::int AS c FROM projects WHERE status NOT IN ('ARCHIVED','CANCELLED')`
  );
  const { rows: calcToday } = await query(
    `SELECT COUNT(*)::int AS c FROM audit_logs WHERE action = 'CALCULATE' AND created_at::date = CURRENT_DATE`
  );
  const maintenance =
    (
      await query(`SELECT config_val FROM system_config WHERE config_key = 'maintenance_mode'`)
    ).rows[0]?.config_val === 'true';

  res.json({
    services: [
      { name: 'backend', status: 'healthy', port: 4000 },
      { name: 'postgres', status: 'healthy', port: 5432 },
    ],
    stats: {
      active_projects: projCount[0]?.c || 0,
      calculations_today: calcToday[0]?.c || 0,
    },
    maintenance_mode: maintenance,
  });
});

router.post('/system-health/maintenance', requireRoles('SUPER_ADMIN'), async (req, res) => {
  const enabled = !!req.body.enabled;
  await query(
    `INSERT INTO system_config (config_key, config_val, category, data_type, description)
     VALUES ('maintenance_mode', $1, 'FEATURE_FLAG', 'boolean', 'Mode pemeliharaan')
     ON CONFLICT (config_key) DO UPDATE SET config_val = $1`,
    [enabled ? 'true' : 'false']
  );
  await addAuditLog({
    userId: req.user.sub,
    userName: req.user.name,
    action: 'MAINTENANCE_TOGGLE',
    oldVal: null,
    newVal: enabled ? 'ON' : 'OFF',
  });
  res.json({ maintenance_mode: enabled });
});

export default router;
