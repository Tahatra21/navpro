import { Router } from 'express';
import { Queue } from 'bullmq';
import { authRequired, requireRoles } from '../middleware/auth.js';
import { isQueueEnabled, getRedisConnection } from '../services/queue.js';

const router = Router();
router.use(authRequired);

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
    res.json({
      job_id: jobId,
      state,
      project_id: job.data?.projectId || null,
      failed_reason: job.failedReason || null,
    });
  } finally {
    await queue.close();
    connection.disconnect();
  }
});

export default router;
