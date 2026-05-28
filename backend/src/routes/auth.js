import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { signToken, authRequired } from '../middleware/auth.js';
import { addAuditLog } from '../utils/audit.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Bad Request', message: 'Email dan password wajib diisi' });
  }

  const { rows } = await query(`SELECT * FROM users WHERE email = $1 AND is_active = true`, [
    email.toLowerCase().trim(),
  ]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Email atau password salah' });
  }

  await query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);
  await addAuditLog({
    userId: user.id,
    userName: user.full_name,
    action: 'LOGIN',
    oldVal: null,
    newVal: user.email,
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
  const { rows } = await query(`SELECT id, email, full_name, role, is_active FROM users WHERE id = $1`, [
    req.user.sub,
  ]);
  if (!rows[0]) return res.status(404).json({ error: 'Not Found' });
  res.json({ user: rows[0] });
});

// Update basic profile (currently: full_name only)
router.patch('/me', authRequired, async (req, res) => {
  const fullName = String(req.body?.full_name || '').trim();
  if (!fullName) {
    return res.status(400).json({ error: 'Bad Request', message: 'Nama lengkap wajib diisi' });
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
  if (next.length < 8) {
    return res.status(400).json({ error: 'Bad Request', message: 'Password baru minimal 8 karakter' });
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
