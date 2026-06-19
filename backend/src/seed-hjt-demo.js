/**
 * Isi ulang 12 penawaran demo HJT (DEMO-HJT-001 … 012) tanpa reset password / proyek KKF.
 * Jalankan di VPS setelah deploy: npm run seed:hjt-demo
 */
import dotenv from 'dotenv';
import { pool, initDb, query } from './db.js';
import { seedHjt } from './hjt/seedHjt.js';
import { seedHjtDemoQuotations } from './hjt/seedHjtDemo.js';

dotenv.config();

const DEMO_SA_ID = '11111111-1111-1111-1111-111111111103';

async function main() {
  await initDb();
  const { versionId } = await seedHjt(query);

  const { rows: userRows } = await query(`SELECT id FROM users WHERE id = $1`, [DEMO_SA_ID]);
  if (!userRows[0]) {
    console.error(
      '[seed:hjt-demo] User demo Rian (SA) belum ada. Jalankan dulu: npm run seed atau npm run seed:e2e'
    );
    process.exit(1);
  }

  const { inserted } = await seedHjtDemoQuotations(query, { versionId, createdBy: DEMO_SA_ID });
  console.log(`[seed:hjt-demo] ${inserted} penawaran DEMO-HJT-* (draft/submitted/approved/tidak layak).`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
