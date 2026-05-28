import { Router } from 'express';
import { query } from '../db.js';
import { authRequired, loadUser, requireRoles, rlsAfterLoadUser } from '../middleware/auth.js';
import { addAuditLog } from '../utils/audit.js';
import { notifyMatrix } from '../utils/notifyMatrix.js';

const router = Router();
router.use(authRequired);
router.use(loadUser);
router.use(rlsAfterLoadUser);

// Pending approval steps assigned to current user (BRD v2.0)
router.get('/queue', requireRoles('SUPER_ADMIN', 'FINANCE_ADMIN', 'ASMAN', 'MANAGER'), async (req, res) => {
  const { rows } = await query(
    `SELECT
       ast.id AS step_id,
       ast.project_id,
       ast.step_order,
       ast.approver_level,
       ast.status AS step_status,
       ast.due_at,
       p.project_code,
       p.project_name,
       p.status AS project_status,
       p.segment,
       p.org_unit_id,
       p.created_at,
       p.updated_at
     FROM approval_steps ast
     JOIN projects p ON p.id = ast.project_id
     WHERE ast.status IN ('PENDING', 'ESCALATED')
       AND ast.assigned_to = $1
     ORDER BY COALESCE(ast.due_at, p.updated_at) ASC`,
    [req.user.sub]
  );
  res.json({ items: rows });
});

router.get('/queue/summary', requireRoles('SUPER_ADMIN', 'FINANCE_ADMIN', 'ASMAN', 'MANAGER'), async (req, res) => {
  const { rows } = await query(
    `SELECT
       COUNT(*)::int AS pending_count,
       SUM(CASE WHEN ast.approver_level = 'ASMAN' THEN 1 ELSE 0 END)::int AS asman_count,
       SUM(CASE WHEN ast.approver_level = 'MANAGER' THEN 1 ELSE 0 END)::int AS manager_count
     FROM approval_steps ast
     WHERE ast.status IN ('PENDING', 'ESCALATED') AND ast.assigned_to = $1`,
    [req.user.sub]
  );
  res.json({ summary: rows[0] || { pending_count: 0, asman_count: 0, manager_count: 0 } });
});

/** Pending step for current user on a project (for delegate UI). */
router.get('/projects/:projectId/my-step', requireRoles('ASMAN', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_ADMIN'), async (req, res) => {
  const { rows } = await query(
    `SELECT ast.*, p.project_code, p.project_name, p.status AS project_status
     FROM approval_steps ast
     JOIN projects p ON p.id = ast.project_id
     WHERE ast.project_id = $1
       AND ast.assigned_to = $2
       AND ast.status IN ('PENDING', 'ESCALATED')
     ORDER BY ast.step_order ASC
     LIMIT 1`,
    [req.params.projectId, req.user.sub]
  );
  res.json({ step: rows[0] || null });
});

/** Users eligible to receive delegation (same role, active, not self). */
router.get('/steps/:stepId/delegate-candidates', requireRoles('ASMAN', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_ADMIN'), async (req, res) => {
  const { rows: stepRows } = await query(`SELECT * FROM approval_steps WHERE id = $1`, [req.params.stepId]);
  const step = stepRows[0];
  if (!step) return res.status(404).json({ error: 'Not Found' });

  if (
    step.assigned_to !== req.user.sub &&
    !['SUPER_ADMIN', 'FINANCE_ADMIN'].includes(req.user.role)
  ) {
    return res.status(403).json({ error: 'Forbidden', message: 'Bukan penanggung jawab step ini.' });
  }

  const { rows: candidates } = await query(
    `SELECT u.id, u.full_name, u.email, u.role
     FROM users u
     WHERE u.is_active = true
       AND u.id <> $1
       AND u.role = $2
       AND (
         $2 IN ('SUPER_ADMIN', 'FINANCE_ADMIN')
         OR ($2 = 'ASMAN' AND u.org_unit_id = $3)
         OR ($2 = 'MANAGER' AND EXISTS (
           SELECT 1 FROM organization_units ou
           JOIN projects p ON p.id = $4
           WHERE ou.id = u.org_unit_id AND ou.segment = p.segment
         ))
       )
     ORDER BY u.full_name`,
    [req.user.sub, step.approver_role, step.org_unit_id, step.project_id]
  );

  res.json({ candidates });
});

/** Delegate approval step to another user (cuti / overload). */
router.post('/steps/:stepId/delegate', requireRoles('ASMAN', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_ADMIN'), async (req, res) => {
  const toUserId = req.body?.to_user_id;
  const reason = String(req.body?.reason || '').trim();
  if (!toUserId) {
    return res.status(400).json({ error: 'Bad Request', message: 'to_user_id wajib' });
  }
  if (reason.length < 10) {
    return res.status(400).json({ error: 'Bad Request', message: 'Alasan delegasi minimal 10 karakter.' });
  }

  const { rows: stepRows } = await query(
    `SELECT ast.*, p.project_code, p.project_name
     FROM approval_steps ast
     JOIN projects p ON p.id = ast.project_id
     WHERE ast.id = $1`,
    [req.params.stepId]
  );
  const step = stepRows[0];
  if (!step) return res.status(404).json({ error: 'Not Found' });
  if (!['PENDING', 'ESCALATED'].includes(step.status)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Step tidak dapat didelegasikan.' });
  }

  if (
    step.assigned_to !== req.user.sub &&
    !['SUPER_ADMIN', 'FINANCE_ADMIN'].includes(req.user.role)
  ) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { rows: targetRows } = await query(
    `SELECT id, full_name, email, role, is_active FROM users WHERE id = $1`,
    [toUserId]
  );
  const target = targetRows[0];
  if (!target?.is_active || target.role !== step.approver_role) {
    return res.status(400).json({
      error: 'Bad Request',
      message: `User tujuan harus aktif dengan role ${step.approver_role}.`,
    });
  }

  const previousAssignee = step.assigned_to;
  const delegationNote = `[DELEGATED dari ${req.user.name}] ${reason}`;

  await query(
    `UPDATE approval_steps SET
       assigned_to = $1,
       delegated_to = $2,
       status = 'PENDING',
       comments = COALESCE(comments, '') || $3
     WHERE id = $4`,
    [toUserId, previousAssignee, `\n${delegationNote}`, step.id]
  );

  await addAuditLog({
    userId: req.user.sub,
    userName: req.user.name,
    projectId: step.project_id,
    action: 'DELEGATE_APPROVAL',
    oldVal: previousAssignee,
    newVal: `${toUserId} (${target.full_name})`,
  });

  await notifyMatrix({
    event: 'SUBMITTED',
    projectId: step.project_id,
    projectCode: step.project_code,
    projectName: step.project_name,
    userIds: [toUserId],
    comment: `Approval didelegasikan kepada Anda. ${reason}`,
  });

  res.json({ ok: true, assigned_to: toUserId });
});

export default router;
