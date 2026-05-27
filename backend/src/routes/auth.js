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

export default router;
