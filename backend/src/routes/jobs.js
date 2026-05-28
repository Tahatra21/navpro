import { Router } from 'express';
import { Queue } from 'bullmq';
import { authRequired, loadUser, requireRoles, rlsAfterLoadUser } from '../middleware/auth.js';
import { isQueueEnabled, getRedisConnection } from '../services/queue.js';
import { query } from '../db.js';

const router = Router();
router.use(authRequired);
router.use(loadUser);
router.use(rlsAfterLoadUser);

function getProjectScopeSql({ role, dbUser, params }) {
  if (role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN') return { where: '1=1', params };
  if (role === 'SA' || role === 'STAFF') {
    params.push(dbUser?.id || null);
    return { where: `created_by = $${params.length}`, params };
  }
  if (role === 'ASMAN') {
    if (dbUser?.org_unit_id) {
      params.push(dbUser.org_unit_id);
      return { where: `org_unit_id = $${params.length}`, params };
    }
    params.push(dbUser?.id || null);
    return { where: `created_by = $${params.length}`, params };
  }
  if (role === 'MANAGER' || role === 'GM_SRM') {
    if (dbUser?.org_unit_id) {
      params.push(dbUser.org_unit_id);
      const idx = params.length;
      return { where: `segment = (SELECT segment FROM organization_units WHERE id = $${idx})`, params };
    }
    return { where: '1=1', params };
  }
  return { where: '1=0', params };
}

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
