import { canPickAnyProjectOrg } from '../utils/globalOrg.js';

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

router.get('/opex-catalog', async (req, res) => {
  const q = String(req.query.q || '')
    .trim()
    .toLowerCase();
  const params = [];
  let sql = `SELECT code, name, category, icon_key, unit, default_type, default_amount, default_currency, description
             FROM opex_service_catalog
             WHERE is_active = true`;
  if (q) {
    params.push(`%${q}%`);
    sql += ` AND (
      lower(code) LIKE $1 OR lower(name) LIKE $1 OR lower(category) LIKE $1
      OR lower(coalesce(description, '')) LIKE $1
    )`;
  }
  sql += ` ORDER BY sort_order, name LIMIT 100`;
  const { rows } = await query(sql, params);
  res.json({
    items: rows.map((r) => ({
      code: r.code,
      name: r.name,
      category: r.category,
      icon_key: r.icon_key,
      unit: r.unit,
      default_type: r.default_type,
      default_amount: parseFloat(r.default_amount),
      default_currency: r.default_currency,
      description: r.description,
    })),
  });
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
  const dbUser = req.dbUser;
  const params = [];
  let sql = `SELECT id, code, name, type, segment
             FROM organization_units
             WHERE is_active = true AND type <> 'GLOBAL'`;

  if (!canPickAnyProjectOrg(role, dbUser) && dbUser?.org_unit_id) {
    params.push(dbUser.org_unit_id);
    sql += ` AND id = $${params.length}`;
  }

  sql += ` ORDER BY type, code`;
  const { rows } = await query(sql, params);
  res.json({ org_units: rows });
});

export default router;
