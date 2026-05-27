import { Router } from 'express';
import { query } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT id, title, body, project_id, is_read, created_at AS timestamp
     FROM notifications WHERE user_id = $1
     ORDER BY created_at DESC LIMIT 50`,
    [req.user.sub]
  );
  res.json({ notifications: rows });
});

router.patch('/:id/read', async (req, res) => {
  await query(`UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`, [
    req.params.id,
    req.user.sub,
  ]);
  res.json({ ok: true });
});

router.post('/read-all', async (req, res) => {
  await query(`UPDATE notifications SET is_read = true WHERE user_id = $1`, [req.user.sub]);
  res.json({ ok: true });
});

export default router;
