import { query } from '../../db.js';
import { addNotification } from '../../utils/audit.js';
import { logHjtAudit } from '../seedHjt.js';
import { getQuotationFull } from './quotationService.js';

/** Mode A — SA → Mgr SA → Mgr Pemasaran → SR Manager (mapped to NAVPRO roles). */
export const HJT_APPROVAL_CHAIN_STANDARD = [
  { role: 'ASMAN', label: 'Manager SA' },
  { role: 'MANAGER', label: 'Manager Pemasaran & Penjualan' },
  { role: 'GM_SRM', label: 'Senior Regional Manager' },
];

/** Mode B — Mgr Pemasaran → GM (revenue sharing, shorter chain). */
export const HJT_APPROVAL_CHAIN_REVSHARE = [
  { role: 'MANAGER', label: 'Manager Pemasaran & Penjualan' },
  { role: 'GM_SRM', label: 'General Manager' },
];

export const HJT_APPROVAL_CHAIN = HJT_APPROVAL_CHAIN_STANDARD;

export function getApprovalChain(calcMode) {
  return calcMode === 'revenue_sharing' ? HJT_APPROVAL_CHAIN_REVSHARE : HJT_APPROVAL_CHAIN_STANDARD;
}

function roleCanAct(currentRole, userRole) {
  if (userRole === 'SUPER_ADMIN') return true;
  return currentRole === userRole;
}

async function findUsersByRole(role) {
  const { rows } = await query(
    `SELECT id, email, full_name FROM users WHERE role = $1 AND is_active = true`,
    [role]
  );
  return rows;
}

async function notifyRole(role, { title, body, quotationId }) {
  const users = await findUsersByRole(role);
  for (const u of users) {
    await addNotification({ userId: u.id, title, body, projectId: null });
  }
}

export async function getApprovalTimeline(quotationId) {
  const { rows } = await query(
    `SELECT a.*, u.full_name AS approver_name
     FROM hjt_approval a
     LEFT JOIN users u ON u.id = a.approver_id
     WHERE a.quotation_id = $1
     ORDER BY a.decided_at NULLS LAST, a.role_level`,
    [quotationId]
  );
  return rows;
}

export async function getApprovalQueue({ role, userId }) {
  if (!['ASMAN', 'MANAGER', 'GM_SRM', 'SUPER_ADMIN', 'FINANCE_ADMIN'].includes(role)) {
    return [];
  }
  const params = [];
  let sql = `
    SELECT q.*, r.region_code,
           u.full_name AS creator_name
    FROM hjt_quotation q
    LEFT JOIN hjt_region r ON r.id = q.region_id
    LEFT JOIN users u ON u.id = q.created_by
    WHERE q.status = 'submitted'`;
  if (role !== 'SUPER_ADMIN' && role !== 'FINANCE_ADMIN') {
    params.push(role);
    sql += ` AND q.current_approval_role = $${params.length}`;
  }
  sql += ` ORDER BY q.submitted_at ASC NULLS LAST`;
  const { rows } = await query(sql, params);
  return rows;
}

function parseCalcSnapshot(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function resolveOfferFloor(quotation) {
  const floor = Number(quotation.offer_floor);
  if (Number.isFinite(floor) && floor > 0) return floor;
  const snap = parseCalcSnapshot(quotation.calc_snapshot);
  if (quotation.calc_mode === 'revenue_sharing') {
    return Number(snap?.result?.revenue_split?.min_quot_final || 0);
  }
  return Number(snap?.result?.offer?.floor || 0);
}

function resolveDefaultFinalPrice(quotation) {
  const recommended = Number(quotation.offer_recommended);
  if (Number.isFinite(recommended) && recommended > 0) return recommended;
  const snap = parseCalcSnapshot(quotation.calc_snapshot);
  if (quotation.calc_mode === 'revenue_sharing') {
    return Number(snap?.result?.harga_negosiasi || snap?.result?.revenue_split?.min_quot_final || 0);
  }
  return Number(snap?.result?.offer?.recommended || 0);
}

export async function submitQuotation(id, userId, { harga_final, floor_override_justification } = {}) {
  const full = await getQuotationFull(id);
  if (!full) return { error: 'NOT_FOUND' };
  const { quotation } = full;
  if (quotation.status !== 'draft') return { error: 'INVALID_STATUS' };
  if (quotation.grand_total_all == null) {
    return { error: 'NOT_CALCULATED', message: 'Jalankan kalkulasi terlebih dahulu' };
  }

  const finalPrice = harga_final != null ? Number(harga_final) : resolveDefaultFinalPrice(quotation);
  if (!Number.isFinite(finalPrice) || finalPrice <= 0) {
    return { error: 'INVALID_PRICE', message: 'Harga final harus lebih dari 0' };
  }
  const floor = resolveOfferFloor(quotation);
  if (finalPrice < floor && !floor_override_justification?.trim()) {
    return {
      error: 'FLOOR_VIOLATION',
      message: 'Harga di bawah batas bawah — justifikasi wajib',
      offer_floor: floor,
    };
  }

  const firstRole = getApprovalChain(quotation.calc_mode)[0].role;
  await query(
    `UPDATE hjt_quotation SET
       status = 'submitted',
       harga_final = $2,
       floor_override_justification = $3,
       current_approval_role = $4,
       submitted_at = NOW(),
       updated_at = NOW()
     WHERE id = $1`,
    [id, finalPrice, floor_override_justification || null, firstRole]
  );

  await query(`DELETE FROM hjt_approval WHERE quotation_id = $1`, [id]);
  for (const step of getApprovalChain(quotation.calc_mode)) {
    await query(
      `INSERT INTO hjt_approval (quotation_id, role_level, decision)
       VALUES ($1,$2,'pending')`,
      [id, step.role]
    );
  }

  await logHjtAudit(query, {
    entity: 'hjt_quotation',
    entityId: id,
    action: 'SUBMIT',
    actorId: userId,
    payload: { harga_final: finalPrice },
  });

  await notifyRole(firstRole, {
    title: 'Penawaran HJT menunggu approval',
    body: `${quotation.customer_name || 'Pelanggan'} — submit untuk review ${getApprovalChain(quotation.calc_mode)[0].label}`,
    quotationId: id,
  });

  return { ok: true, current_approval_role: firstRole };
}

export async function approveQuotation(id, userId, userRole, { note } = {}) {
  const full = await getQuotationFull(id);
  if (!full) return { error: 'NOT_FOUND' };
  const { quotation } = full;
  if (quotation.status !== 'submitted') return { error: 'INVALID_STATUS' };
  if (!roleCanAct(quotation.current_approval_role, userRole)) {
    return { error: 'FORBIDDEN', message: 'Bukan giliran approval Anda' };
  }

  await query(
    `UPDATE hjt_approval SET decision = 'approved', approver_id = $2, note = $3, decided_at = NOW()
     WHERE quotation_id = $1 AND role_level = $4`,
    [id, userId, note || null, quotation.current_approval_role]
  );

  const chain = getApprovalChain(quotation.calc_mode);
  const idx = chain.findIndex((s) => s.role === quotation.current_approval_role);
  const next = chain[idx + 1];

  if (next) {
    await query(
      `UPDATE hjt_quotation SET current_approval_role = $2, updated_at = NOW() WHERE id = $1`,
      [id, next.role]
    );
    await notifyRole(next.role, {
      title: 'Penawaran HJT — approval lanjutan',
      body: `${quotation.customer_name || 'Pelanggan'} menunggu ${next.label}`,
      quotationId: id,
    });
    await logHjtAudit(query, {
      entity: 'hjt_quotation',
      entityId: id,
      action: 'APPROVE_STEP',
      actorId: userId,
      payload: { role: quotation.current_approval_role, next: next.role },
    });
    return { ok: true, status: 'submitted', current_approval_role: next.role };
  }

  await query(
    `UPDATE hjt_quotation SET status = 'approved', current_approval_role = NULL, approved_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [id]
  );

  if (quotation.created_by) {
    await addNotification({
      userId: quotation.created_by,
      title: 'Penawaran HJT disetujui',
      body: `${quotation.customer_name || 'Pelanggan'} — approved final`,
      projectId: null,
    });
  }

  await logHjtAudit(query, {
    entity: 'hjt_quotation',
    entityId: id,
    action: 'APPROVE_FINAL',
    actorId: userId,
  });

  return { ok: true, status: 'approved' };
}

export async function rejectQuotation(id, userId, userRole, { note } = {}) {
  if (!note?.trim()) return { error: 'NOTE_REQUIRED' };
  const full = await getQuotationFull(id);
  if (!full) return { error: 'NOT_FOUND' };
  const { quotation } = full;
  if (quotation.status !== 'submitted') return { error: 'INVALID_STATUS' };
  if (!roleCanAct(quotation.current_approval_role, userRole) && userRole !== 'SUPER_ADMIN') {
    return { error: 'FORBIDDEN' };
  }

  await query(
    `UPDATE hjt_approval SET decision = 'rejected', approver_id = $2, note = $3, decided_at = NOW()
     WHERE quotation_id = $1 AND role_level = $4`,
    [id, userId, note, quotation.current_approval_role]
  );

  await query(
    `UPDATE hjt_quotation SET
       status = 'rejected',
       current_approval_role = NULL,
       rejected_at = NOW(),
       rejected_note = $2,
       updated_at = NOW()
     WHERE id = $1`,
    [id, note]
  );

  if (quotation.created_by) {
    await addNotification({
      userId: quotation.created_by,
      title: 'Penawaran HJT ditolak',
      body: note,
      projectId: null,
    });
  }

  await logHjtAudit(query, {
    entity: 'hjt_quotation',
    entityId: id,
    action: 'REJECT',
    actorId: userId,
    payload: { note },
  });

  return { ok: true, status: 'rejected' };
}
