import test from 'node:test';
import assert from 'node:assert/strict';
import { calcLineRevenueSharing, validateRevenueSharingHeader } from '../../src/hjt/engine/revenueSharing.js';

test('hjt revenue sharing: disc_port max 60%', () => {
  const errors = validateRevenueSharingHeader({
    targetIrr: 0.2,
    waccAnnual: 0.1043,
    discPort: 0.75,
  });
  assert.ok(errors.includes('DISC_PORT_MAX_60'));
});

test('hjt revenue sharing: target irr must exceed wacc', () => {
  const errors = validateRevenueSharingHeader({
    targetIrr: 0.08,
    waccAnnual: 0.1043,
    discPort: 0.1,
  });
  assert.ok(errors.includes('TARGET_IRR_MUST_EXCEED_WACC'));
});

test('hjt revenue sharing: line with discounts', () => {
  const line = calcLineRevenueSharing({
    capacity: 1,
    qty: 1,
    tariffRow: { backbone: 100000, uplink: 10000, access: 50000, tarif: 120000 },
    scheme: 'Subscription',
    durationYears: 1,
    productFamily: 'Inet Corp IX&IIX',
    targetIrr: 0.2,
    discBackbone: 0.1,
    discPort: 0.2,
    aksesExisting: false,
  });
  assert.equal(line.backbone, 90000);
  assert.equal(line.uplink, 8000);
  assert.ok(line.harga_dasar > 0);
});
