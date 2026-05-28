import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { authRequired, requireRoles } from '../middleware/auth.js';
import { addAuditLog } from '../utils/audit.js';
import { computeDueAtFromSlaRow, getSlaConfigMap } from '../utils/sla.js';
import { validatePasswordPolicy } from '../config/security.js';

const ORG_SEGMENTS = ['ENT1', 'ENT2', 'PLN1', 'PLN2'];
const ORG_TYPES = ['PUSAT', 'SBU'];

/** All valid user roles — FINANCE_ADMIN cannot escalate to SUPER_ADMIN */
const VALID_ROLES = ['SUPER_ADMIN', 'FINANCE_ADMIN', 'MANAGER', 'GM_SRM', 'ASMAN', 'SA', 'STAFF'];
/** Roles that only SUPER_ADMIN can assign */
const ELEVATED_ROLES = ['SUPER_ADMIN'];

/** Input field length limits */
const MAX_NAME_LEN = 255;
const MAX_EMAIL_LEN = 254;
const MAX_CODE_LEN = 30;
const MAX_ORG_NAME_LEN = 200;
const MAX_EMPLOYEE_ID_LEN = 50;
const MAX_ORG_LEVEL_LEN = 5;

const router = Router();
router.use(authRequired);
router.use(requireRoles('SUPER_ADMIN', 'FINANCE_ADMIN'));

// Organization units (BRD KKF v2.0)
router.get('/org-units', async (_req, res) => {
  const { rows } = await query(
    `SELECT id, code, name, type, segment, parent_id, is_active, created_at
     FROM organization_units
     ORDER BY type, code`
  );
  res.json({ org_units: rows });
});

router.post('/org-units', async (req, res) => {
  const b = req.body || {};
  const code = String(b.code || '')
    .trim()
    .toUpperCase();
  const name = String(b.name || '').trim();
  const type = String(b.type || '').toUpperCase();
  const segment = String(b.segment || '').toUpperCase();

  if (!code || !name) {
    return res.status(400).json({ error: 'Bad Request', message: 'Kode dan nama wajib diisi.' });
  }
  if (!ORG_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Tipe harus PUSAT atau SBU.' });
  }
  if (!ORG_SEGMENTS.includes(segment)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Segment tidak valid.' });
  }

  const id = uuidv4();
  try {
    await query(
      `INSERT INTO organization_units (id, code, name, type, segment, parent_id, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, code, name, type, segment, b.parent_id || null, b.is_active !== false]
    );
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Conflict', message: 'Kode unit sudah digunakan.' });
    }
    throw e;
  }

  await addAuditLog({
    userId: req.user.sub,
    userName: req.user.name,
    action: 'ORG_UNIT_CREATE',
    oldVal: null,
    newVal: code,
  });

  res.status(201).json({ id, code });
});

router.put('/org-units/:id', async (req, res) => {
  const b = req.body || {};
  const { rows: existing } = await query(`SELECT * FROM organization_units WHERE id = $1`, [
    req.params.id,
  ]);
  if (!existing[0]) return res.status(404).json({ error: 'Not Found' });

  const code = b.code != null ? String(b.code).trim().toUpperCase() : existing[0].code;
  const name = b.name != null ? String(b.name).trim() : existing[0].name;
  const type = b.type != null ? String(b.type).toUpperCase() : existing[0].type;
  const segment = b.segment != null ? String(b.segment).toUpperCase() : existing[0].segment;

  if (!ORG_TYPES.includes(type) || !ORG_SEGMENTS.includes(segment)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Tipe atau segment tidak valid.' });
  }

  try {
    await query(
      `UPDATE organization_units SET
         code = $1, name = $2, type = $3, segment = $4,
         parent_id = $5, is_active = $6
       WHERE id = $7`,
      [
        code,
        name,
        type,
        segment,
        b.parent_id !== undefined ? b.parent_id : existing[0].parent_id,
        b.is_active !== undefined ? !!b.is_active : existing[0].is_active,
        req.params.id,
      ]
    );
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Conflict', message: 'Kode unit sudah digunakan.' });
    }
    throw e;
  }

  await addAuditLog({
    userId: req.user.sub,
    userName: req.user.name,
    action: 'ORG_UNIT_UPDATE',
    oldVal: existing[0].code,
    newVal: code,
  });

  res.json({ ok: true });
});

router.delete('/org-units/:id', async (req, res) => {
  const { rows: existing } = await query(`SELECT * FROM organization_units WHERE id = $1`, [
    req.params.id,
  ]);
  if (!existing[0]) return res.status(404).json({ error: 'Not Found' });

  const { rows: userCount } = await query(
    `SELECT COUNT(*)::int AS c FROM users WHERE org_unit_id = $1`,
    [req.params.id]
  );
  const { rows: projectCount } = await query(
    `SELECT COUNT(*)::int AS c FROM projects WHERE org_unit_id = $1`,
    [req.params.id]
  );
  if ((userCount[0]?.c || 0) > 0 || (projectCount[0]?.c || 0) > 0) {
    await query(`UPDATE organization_units SET is_active = false WHERE id = $1`, [req.params.id]);
    return res.json({
      ok: true,
      soft_deleted: true,
      message: 'Unit dinonaktifkan karena masih dipakai user/proyek.',
    });
  }

  await query(`DELETE FROM organization_units WHERE id = $1`, [req.params.id]);
  await addAuditLog({
    userId: req.user.sub,
    userName: req.user.name,
    action: 'ORG_UNIT_DELETE',
    oldVal: existing[0].code,
    newVal: null,
  });
  res.json({ ok: true, soft_deleted: false });
});

// Backfill project org_unit_id/segment from creator's assigned org unit.
router.post('/projects/backfill-org', async (_req, res) => {
  const { rows } = await query(
    `UPDATE projects AS p
     SET
       org_unit_id = u.org_unit_id,
       segment = ou.segment,
       updated_at = NOW()
     FROM users u
     JOIN organization_units ou ON ou.id = u.org_unit_id
     WHERE p.created_by = u.id
       AND (p.org_unit_id IS NULL OR p.segment IS NULL)
       AND u.org_unit_id IS NOT NULL
     RETURNING p.id`
  );
  res.json({ updated: rows.length, project_ids: rows.map((r) => r.id) });
});

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

router.get('/sla-config/preview-due', async (req, res) => {
  const roleKey = String(req.query.role_key || '');
  if (!roleKey) {
    return res.status(400).json({ error: 'Bad Request', message: 'role_key wajib' });
  }
  const startAt = req.query.start_at ? new Date(String(req.query.start_at)) : new Date();
  if (Number.isNaN(startAt.getTime())) {
    return res.status(400).json({ error: 'Bad Request', message: 'start_at tidak valid' });
  }
  const map = await getSlaConfigMap();
  const sla = map.get(roleKey);
  if (!sla) return res.status(404).json({ error: 'Not Found', message: 'SLA role tidak ditemukan' });

  const dueAt = computeDueAtFromSlaRow(sla, startAt);
  res.json({
    role_key: roleKey,
    start_at: startAt.toISOString(),
    due_at: dueAt.toISOString(),
    sla_working_days: sla.sla_working_days,
    business_hours: '08:00-17:00 Mon-Fri',
  });
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

router.delete('/sla-config/:role_key', async (req, res) => {
  const roleKey = req.params.role_key;
  const result = await query(`DELETE FROM sla_config WHERE role_key = $1`, [roleKey]);
  if (!result.rowCount) return res.status(404).json({ error: 'Not Found' });
  await addAuditLog({
    userId: req.user.sub,
    userName: req.user.name,
    action: 'SLA_CONFIG_DELETE',
    oldVal: roleKey,
    newVal: null,
  });
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
    `SELECT
       u.id, u.email, u.full_name, u.role, u.is_active, u.last_login_at, u.created_at,
       u.employee_id, u.org_unit_id, u.org_level,
       ou.code AS org_unit_code, ou.name AS org_unit_name, ou.type AS org_unit_type, ou.segment AS org_unit_segment
     FROM users u
     LEFT JOIN organization_units ou ON ou.id = u.org_unit_id
     ORDER BY u.full_name`
  );
  res.json({ users: rows });
});

router.post('/users', async (req, res) => {
  const b = req.body;

  // Validate required fields with length limits
  const email = String(b.email || '').toLowerCase().trim();
  const fullName = String(b.full_name || '').trim();
  const role = String(b.role || '');

  if (!email || email.length > MAX_EMAIL_LEN) {
    return res.status(400).json({ error: 'Bad Request', message: 'Email tidak valid (max 254 karakter)' });
  }
  if (!fullName || fullName.length > MAX_NAME_LEN) {
    return res.status(400).json({ error: 'Bad Request', message: 'Nama lengkap wajib diisi (max 255 karakter)' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Role tidak valid' });
  }

  // Only SUPER_ADMIN can create users with elevated roles
  if (ELEVATED_ROLES.includes(role) && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Forbidden', message: 'Hanya SUPER_ADMIN yang dapat membuat user dengan role ini' });
  }

  if (!b.password) {
    return res.status(400).json({ error: 'Bad Request', message: 'Password wajib diisi' });
  }
  const policy = validatePasswordPolicy(b.password);
  if (!policy.ok) {
    return res.status(400).json({ error: 'Bad Request', message: policy.message });
  }

  const hash = await bcrypt.hash(String(b.password), 12); // bcrypt cost 12 for enterprise
  const id = uuidv4();

  try {
    await query(
      `INSERT INTO users (
         id, email, password_hash, full_name, role, is_active,
         employee_id, org_unit_id, org_level
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        email,
        hash,
        fullName,
        role,
        b.is_active !== false,
        b.employee_id ? String(b.employee_id).slice(0, MAX_EMPLOYEE_ID_LEN) : null,
        b.org_unit_id || null,
        b.org_level ? String(b.org_level).slice(0, MAX_ORG_LEVEL_LEN) : null,
      ]
    );
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Conflict', message: 'Email sudah digunakan.' });
    }
    throw e;
  }

  await addAuditLog({
    userId: req.user.sub,
    userName: req.user.name,
    action: 'USER_CREATE',
    oldVal: null,
    newVal: `${email} (${role})`,
  });

  res.status(201).json({ id });
});

router.put('/users/:id', async (req, res) => {
  const b = req.body;
  const isSuperAdmin = req.user.role === 'SUPER_ADMIN';

  // Validate role
  const role = String(b.role || '');
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Role tidak valid' });
  }

  // Only SUPER_ADMIN can assign elevated roles or change roles at all
  if (ELEVATED_ROLES.includes(role) && !isSuperAdmin) {
    return res.status(403).json({ error: 'Forbidden', message: 'Hanya SUPER_ADMIN yang dapat menetapkan role ini' });
  }

  // Fetch existing user to detect role change for audit
  const { rows: existing } = await query(`SELECT role, email FROM users WHERE id = $1`, [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Not Found' });
  const oldRole = existing[0].role;

  // Validate name & email
  const fullName = String(b.full_name || '').trim();
  if (!fullName || fullName.length > MAX_NAME_LEN) {
    return res.status(400).json({ error: 'Bad Request', message: 'Nama tidak valid' });
  }

  if (isSuperAdmin) {
    const email = String(b.email || '').toLowerCase().trim();
    if (!email || email.length > MAX_EMAIL_LEN) {
      return res.status(400).json({ error: 'Bad Request', message: 'Email tidak valid' });
    }
    // SUPER_ADMIN: can update all fields including email and role
    await query(
      `UPDATE users SET
         full_name=$1, role=$2, is_active=$3, email=$4,
         employee_id=$5, org_unit_id=$6, org_level=$7
       WHERE id=$8`,
      [
        fullName,
        role,
        !!b.is_active,
        email,
        b.employee_id ? String(b.employee_id).slice(0, MAX_EMPLOYEE_ID_LEN) : null,
        b.org_unit_id || null,
        b.org_level ? String(b.org_level).slice(0, MAX_ORG_LEVEL_LEN) : null,
        req.params.id,
      ]
    );
  } else {
    // FINANCE_ADMIN: cannot change role (prevent privilege escalation)
    await query(
      `UPDATE users SET
         full_name=$1, is_active=$2,
         employee_id=$3, org_unit_id=$4, org_level=$5
       WHERE id=$6`,
      [
        fullName,
        !!b.is_active,
        b.employee_id ? String(b.employee_id).slice(0, MAX_EMPLOYEE_ID_LEN) : null,
        b.org_unit_id || null,
        b.org_level ? String(b.org_level).slice(0, MAX_ORG_LEVEL_LEN) : null,
        req.params.id,
      ]
    );
  }

  // Audit role changes specifically
  if (isSuperAdmin && oldRole !== role) {
    await addAuditLog({
      userId: req.user.sub,
      userName: req.user.name,
      action: 'USER_ROLE_CHANGE',
      oldVal: oldRole,
      newVal: `${role} (user: ${req.params.id})`,
    });
  } else {
    await addAuditLog({
      userId: req.user.sub,
      userName: req.user.name,
      action: 'USER_UPDATE',
      oldVal: null,
      newVal: req.params.id,
    });
  }

  res.json({ ok: true });
});

// Reset password (SUPER_ADMIN only)
router.post('/users/:id/reset-password', requireRoles('SUPER_ADMIN'), async (req, res) => {
  const newPassword = req.body?.new_password;
  if (!newPassword) {
    return res.status(400).json({ error: 'Bad Request', message: 'new_password wajib diisi' });
  }
  const policy = validatePasswordPolicy(newPassword);
  if (!policy.ok) {
    return res.status(400).json({ error: 'Bad Request', message: policy.message });
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
