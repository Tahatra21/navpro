import { query } from '../db.js';
import { addAuditLog, addNotification } from '../utils/audit.js';

function addWorkingDays(startDate, days) {
  const d = new Date(startDate);
  let remaining = Math.max(0, Number(days) || 0);
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay(); // 0 Sun, 6 Sat
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return d;
}

async function notifyRole(role, { title, body, projectId }) {
  const { rows } = await query(`SELECT id FROM users WHERE role = $1 AND is_active = true`, [role]);
  for (const u of rows) {
    await addNotification({ userId: u.id, title, body, projectId });
  }
}

function getQueueRoleForProjectStatus(status) {
  if (status === 'SUBMITTED' || status === 'UNDER_REVIEW') return 'MANAGER';
  if (status === 'APPROVED_L1') return 'GM_SRM';
  return null;
}

function getSlaStartTs(proj, roleKey) {
  const chain = proj?.approval_chain || [];
  const submit = chain.find((x) => x.level === 'SUBMIT');
  const l1 = chain.find((x) => x.level === 'MANAGER');
  if (roleKey === 'GM_SRM') return l1?.decided_at || submit?.decided_at || proj.updated_at || proj.created_at;
  return submit?.decided_at || proj.updated_at || proj.created_at;
}

async function hasEvent(projectId, roleKey, eventType) {
  const { rows } = await query(
    `SELECT 1 FROM sla_events WHERE project_id = $1 AND role_key = $2 AND event_type = $3 LIMIT 1`,
    [projectId, roleKey, eventType]
  );
  return rows.length > 0;
}

async function markEvent(projectId, roleKey, eventType, dueAt) {
  await query(
    `INSERT INTO sla_events (project_id, role_key, event_type, due_at)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (project_id, role_key, event_type) DO NOTHING`,
    [projectId, roleKey, eventType, dueAt ? new Date(dueAt).toISOString() : null]
  );
}

export async function runSlaTick({ now = new Date() } = {}) {
  const { rows: slaRows } = await query(`SELECT * FROM sla_config ORDER BY role_key`);
  const slaByRole = new Map(slaRows.map((r) => [r.role_key, r]));

  // pending approvals only
  const { rows: projRows } = await query(
    `SELECT * FROM projects WHERE status IN ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED_L1')`
  );

  for (const row of projRows) {
    // row.detail contains approval_chain etc; we only need small bits
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
    const dueAt = addWorkingDays(startDate, sla.sla_working_days || 2);

    const hoursToDue = (dueAt.getTime() - now.getTime()) / (60 * 60 * 1000);
    const hoursOverdue = (now.getTime() - dueAt.getTime()) / (60 * 60 * 1000);

    // Reminder: once per project/role
    if (hoursToDue <= (sla.reminder_hours ?? 24) && hoursToDue > 0) {
      const eventType = 'REMINDER';
      if (!(await hasEvent(proj.id, queueRole, eventType))) {
        await notifyRole(queueRole, {
          title: 'Pengingat SLA Approval',
          body: `SLA hampir jatuh tempo untuk proyek ${proj.project_code} — ${proj.project_name}. Due: ${dueAt.toLocaleDateString('id-ID')}.`,
          projectId: proj.id,
        });
        await addAuditLog({
          userId: null,
          userName: 'System',
          projectId: proj.id,
          action: 'SLA_REMINDER',
          oldVal: null,
          newVal: `${queueRole} due ${dueAt.toISOString()}`,
        });
        await markEvent(proj.id, queueRole, eventType, dueAt);
      }
    }

    // Escalation: once per project/role
    if (hoursOverdue >= (sla.escalation_hours ?? 48)) {
      const eventType = 'ESCALATION';
      if (!(await hasEvent(proj.id, queueRole, eventType))) {
        const escalateTo = sla.escalate_to_role;
        if (escalateTo) {
          await notifyRole(escalateTo, {
            title: 'Escalation SLA Approval',
            body: `SLA terlewat untuk proyek ${proj.project_code} — ${proj.project_name}. Level saat ini: ${queueRole}. Due: ${dueAt.toLocaleDateString('id-ID')}.`,
            projectId: proj.id,
          });
        } else {
          // fallback: notify all actives (rare)
          await addNotification({
            userId: null,
            title: 'Escalation SLA Approval',
            body: `SLA terlewat untuk proyek ${proj.project_code} — ${proj.project_name}. Level saat ini: ${queueRole}.`,
            projectId: proj.id,
          });
        }

        await addAuditLog({
          userId: null,
          userName: 'System',
          projectId: proj.id,
          action: 'SLA_ESCALATION',
          oldVal: null,
          newVal: `${queueRole} -> ${sla.escalate_to_role || 'ALL'} due ${dueAt.toISOString()}`,
        });
        await markEvent(proj.id, queueRole, eventType, dueAt);
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

  // first tick quickly after startup
  setTimeout(() => {
    runSlaTick().catch((err) => console.error('SLA initial tick failed:', err));
  }, 2500);

  return () => clearInterval(timer);
}

