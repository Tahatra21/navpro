/** Unit organisasi admin global — kode & type di DB. */
export const GLOBAL_ORG_CODE = 'GLOBAL-ADMIN';

export const GLOBAL_SCOPE_ROLES = ['SUPER_ADMIN', 'FINANCE_ADMIN', 'VP_SA'];

export function isGlobalOrgUnit(orgUnit) {
  if (!orgUnit) return false;
  if (orgUnit.type === 'GLOBAL') return true;
  if (orgUnit.code === GLOBAL_ORG_CODE) return true;
  return false;
}

export function userHasGlobalOrgHome(dbUser) {
  if (!dbUser) return false;
  if (dbUser.org_unit_type === 'GLOBAL') return true;
  if (dbUser.org_unit_code === GLOBAL_ORG_CODE) return true;
  return false;
}

/** Akses lihat/ubah semua proyek & data lintas unit. */
export function hasGlobalOrgAccess(role, dbUser) {
  if (GLOBAL_SCOPE_ROLES.includes(role)) return true;
  return userHasGlobalOrgHome(dbUser);
}

/** Boleh memilih unit organisasi tujuan proyek (wizard Langkah 1). */
export function canPickAnyProjectOrg(role, dbUser) {
  return hasGlobalOrgAccess(role, dbUser) || !dbUser?.org_unit_id;
}

export function getProjectScopeSql({ role, dbUser, params }) {
  if (hasGlobalOrgAccess(role, dbUser)) {
    return { where: '1=1', params };
  }

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
    if (dbUser?.org_unit_id && dbUser.org_unit_type !== 'GLOBAL') {
      params.push(dbUser.org_unit_id);
      const idx = params.length;
      return {
        where: `segment = (SELECT segment FROM organization_units WHERE id = $${idx})`,
        params,
      };
    }
    return { where: '1=1', params };
  }

  return { where: '1=0', params };
}
