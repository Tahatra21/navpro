import { query } from '../../db.js';

let activeVersionCache = { at: 0, data: null };
const CACHE_MS = 30_000;

export async function getActiveTariffVersion() {
  const now = Date.now();
  if (activeVersionCache.data && now - activeVersionCache.at < CACHE_MS) {
    return activeVersionCache.data;
  }
  const { rows } = await query(
    `SELECT id, kepdir_ref, effective_date, status
     FROM hjt_tariff_version WHERE status = 'active'
     ORDER BY effective_date DESC LIMIT 1`
  );
  activeVersionCache = { at: now, data: rows[0] || null };
  return rows[0] || null;
}

export function clearTariffVersionCache() {
  activeVersionCache = { at: 0, data: null };
}

export async function listTariffVersions({ status } = {}) {
  const params = [];
  let sql = `SELECT id, kepdir_ref, effective_date, status, created_at
             FROM hjt_tariff_version`;
  if (status) {
    params.push(status);
    sql += ` WHERE status = $${params.length}`;
  }
  sql += ` ORDER BY effective_date DESC, created_at DESC`;
  const { rows } = await query(sql, params);
  return rows;
}

export async function createTariffVersion({ kepdirRef, effectiveDate, createdBy }) {
  const { rows } = await query(
    `INSERT INTO hjt_tariff_version (kepdir_ref, effective_date, status, created_by)
     VALUES ($1,$2,'draft',$3)
     RETURNING *`,
    [kepdirRef, effectiveDate, createdBy]
  );
  clearTariffVersionCache();
  return rows[0];
}

export async function activateTariffVersion(versionId, actorId) {
  await query(
    `UPDATE hjt_tariff_version SET status = 'archived' WHERE status = 'active' AND id <> $1`,
    [versionId]
  );
  const { rows } = await query(
    `UPDATE hjt_tariff_version SET status = 'active' WHERE id = $1 AND status = 'draft'
     RETURNING *`,
    [versionId]
  );
  if (!rows[0]) return null;
  clearTariffVersionCache();
  return rows[0];
}

export async function lookupTariff({ versionId, productId, regionId }) {
  const { rows } = await query(
    `SELECT backbone, uplink, vas, access, tarif FROM hjt_tariff
     WHERE version_id = $1 AND product_id = $2 AND region_id = $3`,
    [versionId, productId, regionId]
  );
  if (rows[0]) return { found: true, ...rows[0] };
  return { found: false, backbone: 0, uplink: 0, vas: 0, access: 0, tarif: 0 };
}

export async function searchTariffGrid({ versionId, productId, regionId, q, limit = 50, offset = 0 }) {
  const params = [versionId];
  let sql = `
    SELECT t.id, t.backbone, t.uplink, t.vas, t.access, t.tarif,
           p.product_name, p.product_family, r.region_code
    FROM hjt_tariff t
    JOIN hjt_product p ON p.id = t.product_id
    JOIN hjt_region r ON r.id = t.region_id
    WHERE t.version_id = $1`;
  if (productId) {
    params.push(productId);
    sql += ` AND t.product_id = $${params.length}`;
  }
  if (regionId) {
    params.push(regionId);
    sql += ` AND t.region_id = $${params.length}`;
  }
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    sql += ` AND (lower(p.product_name) LIKE $${params.length} OR lower(r.region_code) LIKE $${params.length})`;
  }
  params.push(limit, offset);
  sql += ` ORDER BY p.product_name, r.region_code LIMIT $${params.length - 1} OFFSET $${params.length}`;
  const { rows } = await query(sql, params);
  return rows;
}

export async function upsertTariffRow({
  versionId,
  productId,
  regionId,
  backbone,
  uplink,
  vas,
  access = 0,
  tarif = 0,
}) {
  const { rows } = await query(
    `INSERT INTO hjt_tariff (version_id, product_id, region_id, backbone, uplink, vas, access, tarif)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (version_id, product_id, region_id) DO UPDATE SET
       backbone = EXCLUDED.backbone, uplink = EXCLUDED.uplink, vas = EXCLUDED.vas,
       access = EXCLUDED.access, tarif = EXCLUDED.tarif
     RETURNING *`,
    [versionId, productId, regionId, backbone, uplink, vas, access, tarif]
  );
  return rows[0];
}

export async function deleteTariffRow(id, versionId) {
  const { rowCount } = await query(
    `DELETE FROM hjt_tariff t
     USING hjt_tariff_version v
     WHERE t.id = $1 AND t.version_id = v.id AND v.id = $2 AND v.status = 'draft'`,
    [id, versionId]
  );
  return rowCount > 0;
}

export async function getBusinessParams(versionId) {
  const { rows } = await query(
    `SELECT * FROM hjt_business_param WHERE version_id = $1 LIMIT 1`,
    [versionId]
  );
  return rows[0] || { margin_floor: 0.1, margin_recommended: 0.2 };
}

export async function getOverheadParam(versionId) {
  const { rows } = await query(
    `SELECT overhead_plus_har_pct FROM hjt_overhead_param WHERE version_id = $1 ORDER BY fiscal_year DESC LIMIT 1`,
    [versionId]
  );
  return rows[0]?.overhead_plus_har_pct ?? 0.2435;
}

export async function getDiscountLevel(versionId, code) {
  if (!code) return null;
  const { rows } = await query(
    `SELECT * FROM hjt_discount_level WHERE version_id = $1 AND code = $2`,
    [versionId, code]
  );
  return rows[0] || null;
}

export async function lookupIbbc({ versionId, type, cir, bw }) {
  const params = [versionId];
  let sql = `SELECT * FROM hjt_ibbc_tariff WHERE version_id = $1`;
  if (type) {
    params.push(type);
    sql += ` AND type = $${params.length}`;
  }
  if (cir) {
    params.push(Number(cir));
    sql += ` AND cir = $${params.length}`;
  }
  if (bw) {
    params.push(Number(bw));
    sql += ` AND up_to_bw = $${params.length}`;
  }
  sql += ` ORDER BY cir, up_to_bw LIMIT 20`;
  const { rows } = await query(sql, params);
  return rows;
}

export async function listProducts(q) {
  const params = [];
  let sql = `SELECT id, product_name, product_family, default_unit FROM hjt_product`;
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    sql += ` WHERE lower(product_name) LIKE $1 OR lower(product_family) LIKE $1`;
  }
  sql += ` ORDER BY product_family, product_name LIMIT 200`;
  const { rows } = await query(sql, params);
  return rows;
}

export async function listRegions() {
  const { rows } = await query(
    `SELECT id, region_code, region_name, has_uplink, is_route FROM hjt_region ORDER BY id`
  );
  return rows;
}

export async function resolveProductByName(name) {
  const { rows } = await query(
    `SELECT id, product_name, product_family FROM hjt_product WHERE lower(trim(product_name)) = lower(trim($1))`,
    [name]
  );
  return rows[0] || null;
}

export async function resolveRegionByCode(code) {
  const { rows } = await query(
    `SELECT * FROM hjt_region WHERE lower(trim(region_code)) = lower(trim($1))`,
    [code]
  );
  return rows[0] || null;
}

export async function resolveRegionById(id) {
  const { rows } = await query(`SELECT * FROM hjt_region WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function getVersionById(id) {
  const { rows } = await query(`SELECT * FROM hjt_tariff_version WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function assertDraftVersion(versionId) {
  const v = await getVersionById(versionId);
  if (!v) return { ok: false, error: 'VERSION_NOT_FOUND' };
  if (v.status !== 'draft') return { ok: false, error: 'VERSION_NOT_DRAFT' };
  return { ok: true, version: v };
}
