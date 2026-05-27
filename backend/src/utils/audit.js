import { query } from '../db.js';

export async function addAuditLog({ userId, userName, projectId, action, oldVal, newVal }) {
  await query(
    `INSERT INTO audit_logs (user_id, user_name, project_id, action, old_val, new_val)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId || null, userName || 'System', projectId || null, action, oldVal, newVal]
  );
}

export async function addNotification({ userId, title, body, projectId }) {
  if (userId) {
    await query(
      `INSERT INTO notifications (user_id, title, body, project_id) VALUES ($1, $2, $3, $4)`,
      [userId, title, body, projectId || null]
    );
  } else {
    const { rows } = await query(`SELECT id FROM users WHERE is_active = true`);
    for (const u of rows) {
      await query(
        `INSERT INTO notifications (user_id, title, body, project_id) VALUES ($1, $2, $3, $4)`,
        [u.id, title, body, projectId || null]
      );
    }
  }
}
