import { Router } from 'express';
import { authRequired, requireRoles } from '../middleware/auth.js';
import { isQueueEnabled, getRedisConnection } from '../services/queue.js';
import { QueueEvents } from 'bullmq';

const router = Router();
router.use(authRequired);

// Minimal job status endpoint (BullMQ). Requires REDIS_URL.
router.get('/:id', requireRoles('SUPER_ADMIN', 'FINANCE_ADMIN', 'SA'), async (req, res) => {
  if (!isQueueEnabled()) {
    return res.status(400).json({ error: 'Bad Request', message: 'Queue belum aktif. Set REDIS_URL.' });
  }
  const jobId = String(req.params.id);
  const connection = getRedisConnection();
  const events = new QueueEvents('navpro-calc', { connection });

  // BullMQ does not have a simple "get status by id" without Queue+Job.
  // We expose events-based existence as a minimal status check.
  // Frontend can just poll project detail / versions after completion.
  let state = 'unknown';
  try {
    // Using events to wait a short time for completion/fail markers if they already happened.
    // If nothing is emitted, caller treats as "pending".
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 150));
    const done = Promise.race([
      events.once('completed', ({ jobId: jid }) => (jid === jobId ? 'completed' : null)),
      events.once('failed', ({ jobId: jid }) => (jid === jobId ? 'failed' : null)),
      timeout,
    ]);
    const v = await done;
    if (v) state = v;
    else state = 'pending';
  } finally {
    await events.close();
    connection.disconnect();
  }

  res.json({ job_id: jobId, state });
});

export default router;

