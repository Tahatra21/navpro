#!/usr/bin/env node
/**
 * Dump embedded/dev PostgreSQL to db/navpro_db_<timestamp>.sql (repo root).
 * Requires: dev DB data in .pgdata (npm run dev pernah jalan).
 * Usage: node scripts/dump-db.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const databaseDir = process.env.PG_DATA_DIR || path.join(repoRoot, '.pgdata');
const outDir = path.join(repoRoot, 'db');

const PG_PORT = parseInt(process.env.PG_PORT || '5435', 10);
const PG_USER = process.env.PG_USER || 'navpro';
const PG_PASSWORD = process.env.PG_PASSWORD || 'navpro_dev';
const PG_DB = process.env.PG_DB || 'navpro_db';

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${cmd} exited ${code}: ${stderr}`));
    });
  });
}

function findPgDump() {
  const candidates = [
    process.env.PG_DUMP,
    '/opt/homebrew/opt/postgresql@18/bin/pg_dump',
    '/opt/homebrew/bin/pg_dump',
    '/opt/homebrew/opt/postgresql@17/bin/pg_dump',
    '/usr/local/bin/pg_dump',
    'pg_dump',
  ].filter(Boolean);
  for (const c of candidates) {
    if (c === 'pg_dump' || fs.existsSync(c)) return c;
  }
  return 'pg_dump';
}

async function main() {
  if (!fs.existsSync(path.join(databaseDir, 'PG_VERSION'))) {
    console.error(`No database found at ${databaseDir}. Run npm run dev first.`);
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `navpro_db_${timestamp()}.sql`);

  const localTmpDir = path.join(repoRoot, 'backend', '.tmp');
  fs.mkdirSync(localTmpDir, { recursive: true });

  const postgres = new EmbeddedPostgres({
    databaseDir,
    user: PG_USER,
    password: PG_PASSWORD,
    port: PG_PORT,
    persistent: true,
    postgresFlags: ['-k', databaseDir, '-c', 'shared_memory_type=mmap'],
  });

  console.log(`Starting Postgres on port ${PG_PORT}…`);
  await postgres.start();

  const pgDump = findPgDump();
  console.log(`Dumping ${PG_DB} → ${outFile}`);
  console.log(`Using ${pgDump}`);

  await new Promise((resolve, reject) => {
    const args = [
      '-h', '127.0.0.1',
      '-p', String(PG_PORT),
      '-U', PG_USER,
      '-d', PG_DB,
      '--no-owner',
      '--no-acl',
      '-F', 'p',
      '-f', outFile,
    ];
    const child = spawn(pgDump, args, {
      env: { ...process.env, PGPASSWORD: PG_PASSWORD },
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`pg_dump exit ${code}`))));
  });

  await postgres.stop();

  const stat = fs.statSync(outFile);
  console.log(`Done: ${outFile} (${(stat.size / 1024).toFixed(1)} KiB)`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
