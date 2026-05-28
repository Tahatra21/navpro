import { AsyncLocalStorage } from 'async_hooks';

export const rlsStorage = new AsyncLocalStorage();

export function isRlsEnabled() {
  return String(process.env.NAVPRO_RLS_ENABLED || '').toLowerCase() === 'true';
}

export function runWithRlsContext(ctx, fn) {
  return rlsStorage.run(ctx, fn);
}

export async function applyRlsContext(client, ctx) {
  const userId = ctx?.userId || '';
  const role = ctx?.role || '';
  const orgUnitId = ctx?.orgUnitId || '';
  const segment = ctx?.segment || '';

  await client.query(`SELECT set_config('navpro.user_id', $1, true)`, [userId]);
  await client.query(`SELECT set_config('navpro.role', $1, true)`, [role]);
  await client.query(`SELECT set_config('navpro.org_unit_id', $1, true)`, [orgUnitId]);
  await client.query(`SELECT set_config('navpro.segment', $1, true)`, [segment]);
}

export function buildRlsContextFromRequest(req) {
  const dbUser = req.dbUser;
  return {
    userId: req.user?.sub || '',
    role: req.user?.role || '',
    orgUnitId: dbUser?.org_unit_id || '',
    segment: dbUser?.org_segment || '',
  };
}
