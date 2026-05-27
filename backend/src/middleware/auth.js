import jwt from 'jsonwebtoken';
import { query } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'navpro-dev-jwt-secret-change-in-production';

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.full_name },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Token diperlukan' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized', message: 'Token tidak valid atau kedaluwarsa' });
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Akses ditolak untuk role ini' });
    }
    next();
  };
}

export async function getMaintenanceMode() {
  const { rows } = await query(
    `SELECT config_val FROM system_config WHERE config_key = 'maintenance_mode'`
  );
  return rows[0]?.config_val === 'true';
}

export async function maintenanceGuard(req, res, next) {
  if (req.path === '/health' || req.path.startsWith('/api/v1/auth/login')) {
    return next();
  }
  const on = await getMaintenanceMode();
  if (on) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Sistem sedang dalam mode pemeliharaan.',
    });
  }
  next();
}

export async function loadUser(req, res, next) {
  if (!req.user?.sub) return next();
  const { rows } = await query(`SELECT * FROM users WHERE id = $1 AND is_active = true`, [req.user.sub]);
  req.dbUser = rows[0] || null;
  next();
}
