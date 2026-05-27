import { Router } from 'express';
import { query } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

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

export default router;
