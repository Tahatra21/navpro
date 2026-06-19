import { v4 as uuidv4 } from 'uuid';
import { initHjtSchema } from './schema.js';
import {
  HJT_REGIONS,
} from './data/regions.js';
import {
  HJT_PRODUCTS,
  GOLDEN_TARIFF_ROWS,
  HJT_IBBC_SEED,
  HJT_DISCOUNT_LEVELS,
} from './data/catalogSeed.js';

const KEPDIR_REF = '0015.SIR/DIR/2026';
const VERSION_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';

export async function seedHjt(query, { createdBy = null } = {}) {
  await initHjtSchema(query);

  for (const r of HJT_REGIONS) {
    await query(
      `INSERT INTO hjt_region (region_code, region_name, has_uplink, is_route)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (region_code) DO UPDATE SET
         region_name = EXCLUDED.region_name,
         has_uplink = EXCLUDED.has_uplink,
         is_route = EXCLUDED.is_route`,
      [r.region_code, r.region_name, r.has_uplink, r.is_route]
    );
  }

  for (const p of HJT_PRODUCTS) {
    await query(
      `INSERT INTO hjt_product (product_name, product_family, default_unit)
       VALUES ($1,$2,$3)
       ON CONFLICT (product_name) DO UPDATE SET
         product_family = EXCLUDED.product_family,
         default_unit = EXCLUDED.default_unit`,
      [p.product_name, p.product_family, p.default_unit]
    );
  }

  const { rows: existingVersion } = await query(
    `SELECT id FROM hjt_tariff_version WHERE kepdir_ref = $1 LIMIT 1`,
    [KEPDIR_REF]
  );

  let versionId = existingVersion[0]?.id;
  if (!versionId) {
    await query(
      `INSERT INTO hjt_tariff_version (id, kepdir_ref, effective_date, status, created_by)
       VALUES ($1,$2,$3,'active',$4)`,
      [VERSION_ID, KEPDIR_REF, '2026-01-01', createdBy]
    );
    versionId = VERSION_ID;
  }

  const { rows: regions } = await query(`SELECT id, region_code FROM hjt_region`);
  const regionByCode = Object.fromEntries(regions.map((r) => [r.region_code, r.id]));
  const { rows: products } = await query(`SELECT id, product_name FROM hjt_product`);
  const productByName = Object.fromEntries(products.map((p) => [p.product_name, p.id]));

  for (const block of GOLDEN_TARIFF_ROWS) {
    const productId = productByName[block.product_name];
    if (!productId) continue;
    for (const [regionCode, t] of Object.entries(block.regions)) {
      const regionId = regionByCode[regionCode];
      if (!regionId) continue;
      await query(
        `INSERT INTO hjt_tariff (version_id, product_id, region_id, backbone, uplink, vas, access, tarif)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (version_id, product_id, region_id) DO UPDATE SET
           backbone = EXCLUDED.backbone,
           uplink = EXCLUDED.uplink,
           vas = EXCLUDED.vas,
           access = EXCLUDED.access,
           tarif = EXCLUDED.tarif`,
        [
          versionId,
          productId,
          regionId,
          t.backbone ?? 0,
          t.uplink ?? 0,
          t.vas ?? 0,
          t.access ?? 0,
          t.tarif ?? 0,
        ]
      );
    }
  }

  for (const row of HJT_IBBC_SEED) {
    const per_mb = row.price_jawa_bali / row.up_to_bw;
    await query(
      `INSERT INTO hjt_ibbc_tariff
         (version_id, cir_bw_type, type, cir, up_to_bw, price_jawa_bali, per_mb, lastmile)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (version_id, cir_bw_type) DO UPDATE SET
         price_jawa_bali = EXCLUDED.price_jawa_bali,
         per_mb = EXCLUDED.per_mb`,
      [
        versionId,
        row.cir_bw_type,
        row.type,
        row.cir,
        row.up_to_bw,
        row.price_jawa_bali,
        per_mb,
        row.lastmile ?? 0,
      ]
    );
  }

  await query(
    `INSERT INTO hjt_overhead_param
       (version_id, fiscal_year, revenue_base, pemeliharaan, kepegawaian, pemasaran, adm_umum,
        markup, overhead_pct, overhead_plus_har_pct)
     VALUES ($1,2023,5332989000000,0.0767,0.1167,0.0115,0.0386,0.20,0.1668,0.2435)
     ON CONFLICT (version_id, fiscal_year) DO UPDATE SET overhead_plus_har_pct = EXCLUDED.overhead_plus_har_pct`,
    [versionId]
  );

  await query(
    `INSERT INTO hjt_business_param (version_id, margin_floor, margin_recommended)
     VALUES ($1, 0.10, 0.20)
     ON CONFLICT (version_id) DO NOTHING`,
    [versionId]
  );

  for (const d of HJT_DISCOUNT_LEVELS) {
    await query(
      `INSERT INTO hjt_discount_level (version_id, code, label, disc_rate)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (version_id, code) DO UPDATE SET disc_rate = EXCLUDED.disc_rate`,
      [versionId, d.code, d.label, d.disc_rate]
    );
  }

  return { versionId, kepdir_ref: KEPDIR_REF };
}

export async function logHjtAudit(query, { entity, entityId, action, actorId, payload }) {
  await query(
    `INSERT INTO hjt_audit_log (entity, entity_id, action, actor_id, payload)
     VALUES ($1,$2,$3,$4,$5)`,
    [entity, entityId || null, action, actorId || null, payload ? JSON.stringify(payload) : null]
  );
}
