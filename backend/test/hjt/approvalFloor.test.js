import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcQuotationRevenueSharing } from '../../src/hjt/engine/revenueSharing.js';

test('hjt approval floor: Mode B min_quot_final maps to offer floor', () => {
  const result = calcQuotationRevenueSharing({
    lines: [{ harga_dasar: 1_000_000 }],
    scheme: 'Subscription',
    durationYears: 1,
    otherExpenses: [],
    discountRate: 0,
    marginCustom: 0.1,
    shareIcon: 0.7,
    shareKawasan: 0.3,
  });
  assert.ok(result.revenue_split.min_quot_final > 0);
  assert.ok(result.harga_negosiasi > 0);
  assert.ok(result.revenue_split.min_quot_final >= result.harga_negosiasi);
});
