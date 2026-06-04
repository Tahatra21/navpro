import { Router } from 'express';
import { Queue } from 'bullmq';
import { authRequired, loadUser, requireRoles, rlsAfterLoadUser } from '../middleware/auth.js';
import { isQueueEnabled, getRedisConnection } from '../services/queue.js';
import { query } from '../db.js';
import { getProjectScopeSql } from '../utils/globalOrg.js';

const router = Router();
router.use(authRequired);
router.use(loadUser);
router.use(rlsAfterLoadUser);

router.get('/:id', requireRoles('SUPER_ADMIN', 'FINANCE_ADMIN', 'SA'), async (req, res) => {
  if (!isQueueEnabled()) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Queue belum aktif. Set REDIS_URL.',
    });
  }

  const jobId = String(req.params.id);
  const connection = getRedisConnection();
  const queue = new Queue('navpro-calc', { connection });

  try {
    const job = await queue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Not Found', message: 'Job tidak ditemukan' });
    }
    const state = await job.getState();

    // Ensure caller can see the underlying project, if job has projectId.
    const projectId = job.data?.projectId || null;
    if (projectId) {
      const params = [projectId];
      const scope = getProjectScopeSql({ role: req.user.role, dbUser: req.dbUser, params });
      const { rows } = await query(`SELECT id FROM projects WHERE id = $1 AND ${scope.where}`, scope.params);
      if (!rows[0]) {
        return res.status(404).json({ error: 'Not Found', message: 'Job tidak ditemukan' });
      }
    }

    res.json({
      job_id: jobId,
      state,
      project_id: projectId,
      failed_reason: job.failedReason || null,
    });
  } finally {
    await queue.close();
    connection.disconnect();
  }
});

export default router;
