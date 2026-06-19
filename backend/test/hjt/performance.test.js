import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { calcLineStandard, calcQuotationStandard } from '../../src/hjt/engine/standard.js';

test('hjt performance: calculate 20 lines under 300ms', () => {
  const region = { region_code: 'INTIM', is_route: false };
  const tariffRow = { backbone: 97000, uplink: 8800, vas: 0 };
  const t0 = performance.now();

  const lines = [];
  for (let i = 0; i < 20; i++) {
    lines.push(
      calcLineStandard({
        capacity: 1 + (i % 5),
        qty: 1,
        lastmile: 0,
        tariffRow,
        region,
      })
    );
  }
  calcQuotationStandard({
    lines,
    scheme: 'Subscription',
    durationYears: 3,
    otherExpenses: [{ total: 100000 }],
    marginFloor: 0.1,
    marginRecommended: 0.2,
  });

  const elapsed = performance.now() - t0;
  assert.ok(elapsed < 300, `expected <300ms, got ${elapsed.toFixed(1)}ms`);
});
