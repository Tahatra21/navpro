import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runCalculationOnProject } from '../src/services/calculationEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJson(rel) {
  const p = path.join(__dirname, 'fixtures', rel);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

test('calculationEngine: deterministic KPI and cashflow shape', () => {
  const proj = readJson('project-basic.json');
  const assumptions = readJson('assumptions-default.json');

  const out = runCalculationOnProject(structuredClone(proj), assumptions);

  assert.equal(out.cashflow_monthly.length, proj.project_duration_months + 1);
  assert.ok(out.kpi);
  assert.ok(Number.isFinite(out.kpi.xnpv));
  assert.ok(Number.isFinite(out.kpi.xirr));
  assert.ok(Number.isFinite(out.kpi.bcr));
  assert.ok(['LAYAK', 'BERSYARAT', 'MARGINAL', 'TIDAK_LAYAK'].includes(out.kpi.conclusion));

  // Regression-ish guards: values should stay within sane ranges
  assert.ok(out.kpi.xirr > -0.99 && out.kpi.xirr < 10);
  assert.ok(out.kpi.bcr >= 0);

  // Key invariants: month0 revenue should be 0, month1 should include OTC
  assert.equal(out.cashflow_monthly[0].revenue, 0);
  assert.equal(out.cashflow_monthly[0].otc, 0);
  assert.ok(out.cashflow_monthly[1].revenue >= out.cashflow_monthly[1].otc);
});

test('calculationEngine: stable KPI snapshot for fixture', () => {
  const proj = readJson('project-basic.json');
  const assumptions = readJson('assumptions-default.json');
  const out = runCalculationOnProject(structuredClone(proj), assumptions);

  // If these ever change, it indicates calculation logic drift.
  // Update intentionally with a clear explanation and keep fixture in sync.
  assert.equal(out.kpi.conclusion, 'LAYAK');
  assert.equal(Math.round(out.kpi.xnpv), 102139760);
  assert.equal(Number(out.kpi.bcr.toFixed(2)), 1.6);
  assert.equal(Number((out.kpi.xirr * 100).toFixed(2)), 136.12);
});

