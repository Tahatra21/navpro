import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { signToken, authRequired } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import { addAuditLog } from '../utils/audit.js';
import { validatePasswordPolicy } from '../config/security.js';

// Max field lengths
const MAX_EMAIL_LEN = 254;
const MAX_PASSWORD_LEN = 128;
const MAX_NAME_LEN = 200;

const router = Router();

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};

  // Sanitize & length-limit
  if (!email || !password) {
    return res.status(400).json({ error: 'Bad Request', message: 'Email dan password wajib diisi' });
  }
  if (typeof email !== 'string' || email.length > MAX_EMAIL_LEN) {
    return res.status(400).json({ error: 'Bad Request', message: 'Format email tidak valid' });
  }
  if (typeof password !== 'string' || password.length > MAX_PASSWORD_LEN) {
    // Do NOT reveal the reason — use generic message to prevent enumeration
    return res.status(401).json({ error: 'Unauthorized', message: 'Email atau password salah' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const { rows } = await query(`SELECT * FROM users WHERE email = $1 AND is_active = true`, [
    normalizedEmail,
  ]);
  const user = rows[0];

  // Always run bcrypt to prevent timing attacks even if user not found
  const dummyHash = '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
  const passwordOk = await bcrypt.compare(password, user?.password_hash || dummyHash);

  if (!user || !passwordOk) {
    // Generic message — do not reveal whether email exists
    return res.status(401).json({ error: 'Unauthorized', message: 'Email atau password salah' });
  }

  await query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);
  await addAuditLog({
    userId: user.id,
    userName: user.full_name,
    action: 'LOGIN',
    oldVal: null,
    newVal: null, // Do not log email in audit log (privacy/data minimization)
  });

  const token = signToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      is_active: user.is_active,
      employee_id: user.employee_id || null,
      org_unit_id: user.org_unit_id || null,
      org_level: user.org_level || null,
    },
  });
});

router.post('/logout', authRequired, async (req, res) => {
  await addAuditLog({
    userId: req.user.sub,
    userName: req.user.name,
    action: 'LOGOUT',
    oldVal: req.user.email,
    newVal: null,
  });
  res.json({ ok: true });
});

router.get('/me', authRequired, async (req, res) => {
  const { rows } = await query(
    `SELECT
       u.id, u.email, u.full_name, u.role, u.is_active,
       u.employee_id, u.org_unit_id, u.org_level,
       ou.code AS org_unit_code, ou.name AS org_unit_name, ou.type AS org_unit_type, ou.segment AS org_unit_segment
     FROM users u
     LEFT JOIN organization_units ou ON ou.id = u.org_unit_id
     WHERE u.id = $1 AND u.is_active = true`,
    [req.user.sub]
  );
  // Return 401 (not 404) so client triggers re-login when account deactivated
  if (!rows[0]) return res.status(401).json({ error: 'Unauthorized', message: 'Akun tidak aktif atau tidak ditemukan' });
  res.json({ user: rows[0] });
});

// Update basic profile (currently: full_name only)
router.patch('/me', authRequired, async (req, res) => {
  const fullName = String(req.body?.full_name || '').trim();
  if (!fullName) {
    return res.status(400).json({ error: 'Bad Request', message: 'Nama lengkap wajib diisi' });
  }
  if (fullName.length > MAX_NAME_LEN) {
    return res.status(400).json({ error: 'Bad Request', message: `Nama maksimal ${MAX_NAME_LEN} karakter` });
  }

  await query(`UPDATE users SET full_name = $1 WHERE id = $2`, [fullName, req.user.sub]);
  await addAuditLog({
    userId: req.user.sub,
    userName: req.user.name,
    action: 'PROFILE_UPDATE',
    oldVal: null,
    newVal: fullName,
  });

  const { rows } = await query(`SELECT id, email, full_name, role, is_active FROM users WHERE id = $1`, [
    req.user.sub,
  ]);
  res.json({ user: rows[0] });
});

// Change password (requires current password)
router.patch('/password', authRequired, async (req, res) => {
  const current = String(req.body?.current_password || '');
  const next = String(req.body?.new_password || '');

  if (!current || !next) {
    return res.status(400).json({ error: 'Bad Request', message: 'current_password dan new_password wajib diisi' });
  }
  if (current.length > MAX_PASSWORD_LEN || next.length > MAX_PASSWORD_LEN) {
    return res.status(400).json({ error: 'Bad Request', message: 'Password tidak valid' });
  }

  // Enforce enterprise password policy
  const policy = validatePasswordPolicy(next, { fieldName: 'Password baru' });
  if (!policy.ok) {
    return res.status(400).json({ error: 'Bad Request', message: policy.message });
  }

  const { rows } = await query(`SELECT id, password_hash, full_name, email FROM users WHERE id = $1`, [
    req.user.sub,
  ]);
  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'Not Found' });

  const ok = await bcrypt.compare(current, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Password saat ini salah' });
  }

  const hash = await bcrypt.hash(next, 10);
  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, req.user.sub]);
  await addAuditLog({
    userId: req.user.sub,
    userName: user.full_name,
    action: 'PASSWORD_CHANGE',
    oldVal: null,
    newVal: user.email,
  });

  res.json({ ok: true });
});

export default router;
