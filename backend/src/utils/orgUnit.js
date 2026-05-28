import { query } from '../db.js';

/**
 * Resolve org_unit_id + segment for new projects (wizard / API create).
 */
export async function resolveProjectOrgUnit(req, bodyOrgUnitId) {
  const role = req.user.role;
  const userOrgId = req.dbUser?.org_unit_id || null;
  let orgUnitId = userOrgId;

  const requested = bodyOrgUnitId ? String(bodyOrgUnitId) : null;
  if (requested) {
    if (['SUPER_ADMIN', 'FINANCE_ADMIN'].includes(role)) {
      orgUnitId = requested;
    } else if (!userOrgId) {
      orgUnitId = requested;
    } else if (requested === userOrgId) {
      orgUnitId = requested;
    } else {
      return {
        error: 'ORG_FORBIDDEN',
        message: 'Unit organisasi harus sama dengan unit Anda yang terdaftar.',
      };
    }
  }

  if (!orgUnitId) {
    return {
      error: 'ORG_REQUIRED',
      message: 'Pilih unit organisasi pada langkah 1 wizard.',
    };
  }

  const { rows: ouRows } = await query(
    `SELECT id, segment FROM organization_units WHERE id = $1 AND is_active = true`,
    [orgUnitId]
  );
  if (!ouRows[0]) {
    return { error: 'ORG_INVALID', message: 'Unit organisasi tidak ditemukan atau tidak aktif.' };
  }

  return { orgUnitId, segment: ouRows[0].segment || null };
}
