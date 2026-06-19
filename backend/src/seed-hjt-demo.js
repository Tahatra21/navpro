/**
 * Isi ulang 12 penawaran demo HJT (DEMO-HJT-001 … 012) tanpa reset password / proyek KKF.
 * Jalankan di VPS setelah deploy: npm run seed:hjt-demo
 */
import dotenv from 'dotenv';
import { pool, initDb, query } from './db.js';
import { seedHjt } from './hjt/seedHjt.js';
import { seedHjtDemoQuotations } from './hjt/seedHjtDemo.js';

dotenv.config();

const DEMO_SA_EMAIL = 'rian.hidayat@navpro.app';
const DEMO_SA_ID = '11111111-1111-1111-1111-111111111103';

async function ensureOrgUnits() {
  const units = [
    { code: 'REG-SBU', name: 'Tch/Jtc Solar SBU', type: 'SBU', segment: 'ENT2' },
    { code: 'SOLAR-ENT-2', name: 'Sub Bid SA Enterprise 2', type: 'PUSAT', segment: 'ENT2' },
  ];
  for (const ou of units) {
    await query(
      `INSERT INTO organization_units (code, name, type, segment)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (code) DO NOTHING`,
      [ou.code, ou.name, ou.type, ou.segment]
    );
  }
}

async function resolveDemoCreator() {
  const { rows: byEmail } = await query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [DEMO_SA_EMAIL]);
  if (byEmail[0]?.id) return byEmail[0].id;

  const { rows: byId } = await query(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [DEMO_SA_ID]);
  if (byId[0]?.id) return byId[0].id;

  return null;
}

async function main() {
  await initDb();
  await ensureOrgUnits();

  const { versionId } = await seedHjt(query);
  if (!versionId) {
    console.error('[seed:hjt-demo] Gagal — versi tarif HJT tidak ada.');
    process.exit(1);
  }

  const createdBy = await resolveDemoCreator();
  if (!createdBy) {
    console.error(
      `[seed:hjt-demo] User ${DEMO_SA_EMAIL} belum ada. Jalankan: npm run seed:e2e`
    );
    process.exit(1);
  }

  const { rows: ouRows } = await query(
    `SELECT id, segment FROM organization_units WHERE code = 'REG-SBU' LIMIT 1`
  );
  const orgUnitId = ouRows[0]?.id ?? null;
  const segment = ouRows[0]?.segment ?? 'ENT2';

  const { inserted, skipped, regions } = await seedHjtDemoQuotations(query, {
    versionId,
    createdBy,
    orgUnitId,
    segment,
  });

  const { rows: verifyRows } = await query(
    `SELECT COUNT(*)::int AS c FROM hjt_quotation WHERE contract_no LIKE 'DEMO-HJT-%'`
  );
  const inDb = verifyRows[0]?.c ?? 0;

  console.log(
    `[seed:hjt-demo] inserted=${inserted} skipped=${skipped} regions=${regions} verified_in_db=${inDb} creator=${createdBy}`
  );

  if (inDb === 0) {
    console.error('[seed:hjt-demo] GAGAL — tidak ada baris DEMO-HJT di database.');
    process.exit(1);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('[seed:hjt-demo]', err);
  process.exit(1);
});
