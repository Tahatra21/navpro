import { query } from '../db.js';
import { addNotification } from './audit.js';
import { notifyApprovalEvent } from '../services/email.js';

const TITLES = {
  SUBMITTED: 'Proyek Diajukan untuk Approval',
  APPROVED: 'Proyek Disetujui',
  REJECTED: 'Proyek Ditolak',
  REMINDER: 'Pengingat SLA Approval',
  ESCALATION: 'Escalation SLA Approval',
};

/**
 * In-app + email (if SMTP configured) for approval/SLA events.
 */
export async function notifyMatrix({
  event,
  projectId,
  projectCode,
  projectName,
  userIds = [],
  roles = [],
  comment,
}) {
  const title = TITLES[event] || `NAVPRO — ${event}`;
  const body = `${projectCode} — ${projectName}${comment ? `. ${comment}` : ''}`;
  const notified = new Set();

  async function notifyOne(userId, email) {
    if (!userId || notified.has(userId)) return;
    notified.add(userId);
    await addNotification({ userId, title, body, projectId });
    if (email) {
      await notifyApprovalEvent({
        to: email,
        projectName,
        projectCode,
        event,
        comment,
      });
    }
  }

  for (const userId of userIds) {
    const { rows } = await query(`SELECT id, email FROM users WHERE id = $1 AND is_active = true`, [
      userId,
    ]);
    if (rows[0]) await notifyOne(rows[0].id, rows[0].email);
  }

  for (const role of roles) {
    const { rows } = await query(
      `SELECT id, email FROM users WHERE role = $1 AND is_active = true`,
      [role]
    );
    for (const u of rows) {
      await notifyOne(u.id, u.email);
    }
  }
}
