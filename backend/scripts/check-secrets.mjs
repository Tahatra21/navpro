#!/usr/bin/env node
/**
 * Fail if known demo secrets appear in tracked application source.
 * Usage: node scripts/check-secrets.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.tools',
  'legacy',
  'db',
  '.next',
  'dist',
]);

const FORBIDDEN = [
  /Navpro@2026/i,
  /navpro-dev-jwt-secret-change-in-production/,
  /postgresql:\/\/navpro:navpro_dev@/,
];

const SCAN_EXT = new Set(['.js', '.mjs', '.ts', '.tsx', '.md', '.html', '.yml', '.yaml', '.example']);

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, files);
    else files.push(p);
  }
  return files;
}

let failed = false;

for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  const ext = rel.slice(rel.lastIndexOf('.'));
  if (!SCAN_EXT.has(ext)) continue;
  if (rel.startsWith('backend/scripts/check-secrets')) continue;
  if (rel === 'backend/src/config/security.js') continue;
  if (rel === 'docs/SECURITY.md') continue;
  if (rel === '.env.docker.example' || rel === 'backend/.env.example') continue;

  const text = readFileSync(file, 'utf8');
  for (const re of FORBIDDEN) {
    if (re.test(text)) {
      console.error(`FAIL ${rel}: matches ${re}`);
      failed = true;
    }
  }
}

if (failed) {
  console.error('\nRemove hardcoded secrets. See docs/SECURITY.md');
  process.exit(1);
}

console.log('OK  no forbidden secret patterns in application source');
