import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { migrateHjtColumns } from './migrateColumns.js';

export async function initHjtSchema(query) {
  const sqlPath = path.join(__dirname, '../../sql/hjt-schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await query(sql);
  await migrateHjtColumns(query);
}
