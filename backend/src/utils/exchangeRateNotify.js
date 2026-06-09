import { query } from '../db.js';
import { addNotification } from './audit.js';

const FINANCE_ROLES = ['FINANCE_ADMIN', 'SUPER_ADMIN'];

async function notifyRoles({ title, body, roles = FINANCE_ROLES }) {
  const { rows } = await query(
    `SELECT id FROM users WHERE is_active = true AND role = ANY($1::text[])`,
    [roles]
  );
  for (const u of rows) {
    await addNotification({ userId: u.id, title, body, projectId: null });
  }
}

export async function notifyFinanceAdminsSyncFailure(streak) {
  await notifyRoles({
    title: 'Sync kurs USD gagal',
    body: `Sync otomatis kurs USD gagal ${streak}× berturut-turut. Periksa provider atau lakukan sync manual.`,
  });
}

export async function notifyFinanceAdminsPendingApproval({ rate, previousRate, deltaPercent }) {
  await notifyRoles({
    title: 'Kurs USD menunggu persetujuan',
    body: `Kurs baru Rp ${rate.toLocaleString('id-ID')} (${deltaPercent.toFixed(2)}% dari Rp ${previousRate.toLocaleString('id-ID')}). Setujui di Admin → Asumsi Master.`,
  });
}
