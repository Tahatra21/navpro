import test from 'node:test';
import assert from 'node:assert/strict';
import { calcLastmileKkf, mapLastmileKkfInput } from '../../src/hjt/engine/lastmileSimpleIrr.js';

test('hjt lastmile: produces IRR NPV BCR', () => {
  const out = calcLastmileKkf({
    capex: 70_000_000,
    depreciationYears: 8,
    revShare: 0.2,
    overhead: 0.2429,
    koefBackbone: 0.3,
    waccAnnual: 0.1043,
    horizonYears: 2,
    monthlyRevenue: 5_000_000,
    capacity: 1,
    backboneUnit: 97000,
    uplinkUnit: 8800,
  });
  assert.ok(out.irr == null || Number.isFinite(out.irr));
  assert.ok(typeof out.npv === 'number');
  assert.ok(typeof out.bcr === 'number');
  assert.ok(Array.isArray(out.cashflows));
  assert.equal(out.cashflows[0], -70_000_000);
});

test('hjt lastmile: feasible when bcr >= 1.4', () => {
  const out = calcLastmileKkf({
    capex: 10_000_000,
    depreciationYears: 8,
    revShare: 0.05,
    overhead: 0.1,
    koefBackbone: 0.1,
    waccAnnual: 0.08,
    horizonYears: 2,
    monthlyRevenue: 20_000_000,
    capacity: 1,
    backboneUnit: 1000,
    uplinkUnit: 500,
    bcrThreshold: 1.4,
  });
  if (out.bcr >= 1.4) assert.equal(out.is_feasible, true);
});

test('hjt lastmile: zero revenue does not produce overflow IRR', () => {
  const out = calcLastmileKkf({
    capex: 50_000_000,
    depreciationYears: 8,
    monthlyRevenue: 0,
    capacity: 1,
    backboneUnit: 97000,
    uplinkUnit: 8800,
  });
  assert.equal(out.irr, null);
  assert.ok(out.bcr == null || Math.abs(out.bcr) <= 999999.999999);
});

test('hjt lastmile: snake_case API body maps to engine params', () => {
  const out = calcLastmileKkf(
    mapLastmileKkfInput({
      capex: 50_000_000,
      monthly_revenue: 10_000_000,
      backbone_unit: 1,
      uplink_unit: 100,
      capacity: 1,
    })
  );
  assert.equal(out.recommended_lastmile, 10_000_000);
  assert.ok(out.irr != null);
  assert.ok(out.npv > 0);
});
