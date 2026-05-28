import { orgUnitCodeForIndex } from '../data/demoOrgUnits.js';

export async function loadOrgUnitByCode(query) {
  const { rows } = await query(
    `SELECT id, code, name, type, segment FROM organization_units WHERE is_active = true`
  );
  return new Map(rows.map((r) => [r.code, r]));
}

export function resolveOrgUnitFromCode(orgByCode, code) {
  const ou = orgByCode.get(code);
  if (!ou) {
    throw new Error(`Organization unit not found: ${code}`);
  }
  return { orgUnitId: ou.id, segment: ou.segment, type: ou.type, code: ou.code };
}

/** Proyek uji/smoke — tetap dapat unit SBU agar chart tidak kosong */
export function fallbackOrgCodeForProject(project, index = 0) {
  const name = project.project_name || '';
  const code = project.project_code || '';
  if (/^SMOKE-/i.test(code) || /^Smoke \d+$/i.test(name.trim())) {
    return orgUnitCodeForIndex(index, true);
  }
  return orgUnitCodeForIndex(index, false);
}
