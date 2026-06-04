import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTariffBreakdown } from '../src/utils/tariffCalculator.js';

test('tariffCalculator: DIA 100 Mbps standard no discount', () => {
  const out = computeTariffBreakdown({
    packageId: 'dia',
    bandwidthMbps: 100,
    sla: 'standard',
    discountPercent: 0,
    revenueMode: 'flat',
    otcOverride: null,
    year2UpliftPercent: 0,
  });
  assert.ok(out.breakdown);
  assert.equal(out.breakdown.netMonthlyYear1, 85_000_000);
  assert.equal(out.breakdown.otc, 5_000_000);
});

test('tariffCalculator: premium SLA and 10% discount', () => {
  const out = computeTariffBreakdown({
    packageId: 'dia',
    bandwidthMbps: 50,
    sla: 'premium',
    discountPercent: 10,
    revenueMode: 'step_yearly',
    otcOverride: null,
    year2UpliftPercent: 15,
  });
  const y1 = out.breakdown.netMonthlyYear1;
  const y2 = out.breakdown.netMonthlyYear2;
  assert.equal(y1, Math.round(50 * 850_000 * 1.15 * 0.9));
  assert.equal(y2, Math.round(y1 * 1.15));
});
