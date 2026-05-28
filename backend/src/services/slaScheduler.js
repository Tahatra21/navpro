import { query } from '../db.js';
import { addAuditLog } from '../utils/audit.js';
import { computeDueAtFromSlaRow, getSlaConfigMap } from '../utils/sla.js';
import { notifyMatrix } from '../utils/notifyMatrix.js';

function getQueueRoleForProjectStatus(status) {
  if (status === 'SUBMITTED' || status === 'UNDER_REVIEW') return 'MANAGER';
  if (status === 'APPROVED_L1') return 'GM_SRM';
  if (status === 'IN_REVIEW_ASMAN') return 'ASMAN';
  if (status === 'IN_REVIEW_MANAGER') return 'MANAGER';
  return null;
}

function getSlaStartTs(proj, roleKey) {
  const chain = proj?.approval_chain || [];
  const submit = chain.find((x) => x.level === 'SUBMIT');
  const l1 = chain.find((x) => x.level === 'MANAGER');
  if (roleKey === 'GM_SRM') return l1?.decided_at || submit?.decided_at || proj.updated_at || proj.created_at;
  return submit?.decided_at || proj.updated_at || proj.created_at;
}

async function hasStepEvent(approvalStepId, eventType) {
  const { rows } = await query(
    `SELECT 1 FROM sla_events WHERE approval_step_id = $1 AND event_type = $2 LIMIT 1`,
    [approvalStepId, eventType]
  );
  return rows.length > 0;
}

async function hasLegacyEvent(projectId, roleKey, eventType) {
  const { rows } = await query(
    `SELECT 1 FROM sla_events
     WHERE project_id = $1 AND role_key = $2 AND event_type = $3 AND approval_step_id IS NULL
     LIMIT 1`,
    [projectId, roleKey, eventType]
  );
  return rows.length > 0;
}

async function markStepEvent(projectId, approvalStepId, roleKey, eventType, dueAt) {
  await query(
    `INSERT INTO sla_events (project_id, approval_step_id, role_key, event_type, due_at, is_sent, sent_at)
     VALUES ($1,$2,$3,$4,$5,true,NOW())
     ON CONFLICT (project_id, approval_step_id, role_key, event_type) DO NOTHING`,
    [projectId, approvalStepId, roleKey, eventType, dueAt ? new Date(dueAt).toISOString() : null]
  );
}

async function markLegacyEvent(projectId, roleKey, eventType, dueAt) {
  await query(
    `INSERT INTO sla_events (project_id, role_key, event_type, due_at, is_sent, sent_at)
     VALUES ($1,$2,$3,$4,true,NOW())`,
    [projectId, roleKey, eventType, dueAt ? new Date(dueAt).toISOString() : null]
  );
}

async function processApprovalStepSla(step, proj, slaByRole, now) {
  const queueRole = step.approver_role;
  const sla = slaByRole.get(queueRole);
  if (!sla) return;

  let dueAt = step.due_at ? new Date(step.due_at) : null;
  if (!dueAt) {
    dueAt = computeDueAtFromSlaRow(sla, new Date(step.created_at || now));
    await query(`UPDATE approval_steps SET due_at = $1 WHERE id = $2`, [dueAt.toISOString(), step.id]);
  }

  const hoursToDue = (dueAt.getTime() - now.getTime()) / (60 * 60 * 1000);
  const hoursOverdue = (now.getTime() - dueAt.getTime()) / (60 * 60 * 1000);

  const label = `${proj.project_code} — ${proj.project_name}`;

  if (hoursToDue <= (sla.reminder_hours ?? 24) && hoursToDue > 0) {
    const eventType = 'REMINDER';
    if (!(await hasStepEvent(step.id, eventType))) {
      await notifyMatrix({
        event: 'REMINDER',
        projectId: proj.id,
        projectCode: proj.project_code,
        projectName: proj.project_name,
        userIds: [step.assigned_to],
        comment: `Due: ${dueAt.toLocaleString('id-ID')}`,
      });
      await addAuditLog({
        userId: null,
        userName: 'System',
        projectId: proj.id,
        action: 'SLA_REMINDER',
        oldVal: null,
        newVal: `${queueRole} step:${step.id} due ${dueAt.toISOString()}`,
      });
      await markStepEvent(proj.id, step.id, queueRole, eventType, dueAt);
    }
  }

  if (hoursOverdue >= (sla.escalation_hours ?? 48)) {
    const eventType = 'ESCALATION';
    if (!(await hasStepEvent(step.id, eventType))) {
      await query(
        `UPDATE approval_steps SET status = 'ESCALATED' WHERE id = $1 AND status = 'PENDING'`,
        [step.id]
      );
      const escalateTo = sla.escalate_to_role;
      await notifyMatrix({
        event: 'ESCALATION',
        projectId: proj.id,
        projectCode: proj.project_code,
        projectName: proj.project_name,
        userIds: [step.assigned_to],
        roles: escalateTo ? [escalateTo] : [],
        comment: `Level ${queueRole} terlewat. Due: ${dueAt.toLocaleString('id-ID')}`,
      });
      await addAuditLog({
        userId: null,
        userName: 'System',
        projectId: proj.id,
        action: 'SLA_ESCALATION',
        oldVal: null,
        newVal: `${queueRole} -> ${sla.escalate_to_role || 'ALL'} step:${step.id}`,
      });
      await markStepEvent(proj.id, step.id, queueRole, eventType, dueAt);
    }
  }
}

export async function runSlaTick({ now = new Date() } = {}) {
  const slaByRole = await getSlaConfigMap();

  const { rows: stepRows } = await query(
    `SELECT ast.*, p.project_code, p.project_name, p.status
     FROM approval_steps ast
     JOIN projects p ON p.id = ast.project_id
     WHERE ast.status = 'PENDING'
       AND p.status IN ('IN_REVIEW_ASMAN', 'IN_REVIEW_MANAGER', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED_L1')`
  );

  for (const step of stepRows) {
    const proj = {
      id: step.project_id,
      project_code: step.project_code,
      project_name: step.project_name,
      status: step.status,
    };
    await processApprovalStepSla(step, proj, slaByRole, now);
  }

  // Legacy projects without approval_steps rows
  const { rows: projRows } = await query(
    `SELECT p.* FROM projects p
     WHERE p.status IN ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED_L1')
       AND NOT EXISTS (
         SELECT 1 FROM approval_steps ast
         WHERE ast.project_id = p.id AND ast.status = 'PENDING'
       )`
  );

  for (const row of projRows) {
    const detail = row.detail || {};
    const proj = {
      id: row.id,
      project_code: row.project_code,
      project_name: row.project_name,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      approval_chain: detail.approval_chain || [],
    };

    const queueRole = getQueueRoleForProjectStatus(proj.status);
    if (!queueRole) continue;

    const sla = slaByRole.get(queueRole);
    if (!sla) continue;

    const startTs = getSlaStartTs(proj, queueRole);
    const startDate = startTs ? new Date(startTs) : new Date(proj.updated_at || proj.created_at || now);
    const dueAt = computeDueAtFromSlaRow(sla, startDate);

    const hoursToDue = (dueAt.getTime() - now.getTime()) / (60 * 60 * 1000);
    const hoursOverdue = (now.getTime() - dueAt.getTime()) / (60 * 60 * 1000);

    if (hoursToDue <= (sla.reminder_hours ?? 24) && hoursToDue > 0) {
      const eventType = 'REMINDER';
      if (!(await hasLegacyEvent(proj.id, queueRole, eventType))) {
        await notifyMatrix({
          event: 'REMINDER',
          projectId: proj.id,
          projectCode: proj.project_code,
          projectName: proj.project_name,
          roles: [queueRole],
        });
        await markLegacyEvent(proj.id, queueRole, eventType, dueAt);
      }
    }

    if (hoursOverdue >= (sla.escalation_hours ?? 48)) {
      const eventType = 'ESCALATION';
      if (!(await hasLegacyEvent(proj.id, queueRole, eventType))) {
        const escalateTo = sla.escalate_to_role;
        await notifyMatrix({
          event: 'ESCALATION',
          projectId: proj.id,
          projectCode: proj.project_code,
          projectName: proj.project_name,
          roles: escalateTo ? [queueRole, escalateTo] : [queueRole],
        });
        await markLegacyEvent(proj.id, queueRole, eventType, dueAt);
      }
    }
  }
}

export function startSlaScheduler({
  intervalMs = Number(process.env.SLA_TICK_MS || 5 * 60 * 1000),
} = {}) {
  const timer = setInterval(() => {
    runSlaTick().catch((err) => console.error('SLA tick failed:', err));
  }, intervalMs);

  setTimeout(() => {
    runSlaTick().catch((err) => console.error('SLA initial tick failed:', err));
  }, 2500);

  return () => clearInterval(timer);
}
