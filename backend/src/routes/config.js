import { Router } from 'express';
import { query } from '../db.js';
import { authRequired, loadUser } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);
router.use(loadUser);

router.get('/assumptions', async (_req, res) => {
  const { rows } = await query(`SELECT data FROM assumptions_master ORDER BY id DESC LIMIT 1`);
  res.json(rows[0]?.data || {});
});

router.get('/presets', async (_req, res) => {
  const { rows } = await query(
    `SELECT * FROM duration_presets WHERE is_active = true ORDER BY duration_months`
  );
  res.json({ presets: rows });
});

router.get('/categories', async (_req, res) => {
  const { rows: capex } = await query(`SELECT code FROM categories WHERE type = 'capex' ORDER BY code`);
  const { rows: opex } = await query(`SELECT code FROM categories WHERE type = 'opex' ORDER BY code`);
  res.json({
    capex: capex.map((r) => r.code),
    opex: opex.map((r) => r.code),
  });
});

/** Active org units for wizard (scoped for non-admin users with assigned unit). */
router.get('/org-units', async (req, res) => {
  const role = req.user.role;
  const userOrgId = req.dbUser?.org_unit_id || null;
  const params = [];
  let sql = `SELECT id, code, name, type, segment
             FROM organization_units
             WHERE is_active = true`;

  if (!['SUPER_ADMIN', 'FINANCE_ADMIN', 'VP_SA'].includes(role) && userOrgId) {
    params.push(userOrgId);
    sql += ` AND id = $${params.length}`;
  }

  sql += ` ORDER BY type, code`;
  const { rows } = await query(sql, params);
  res.json({ org_units: rows });
});

export default router;
