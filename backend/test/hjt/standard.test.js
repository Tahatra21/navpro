import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { calcLineStandard, calcQuotationStandard } from '../../src/hjt/engine/standard.js';
import { lookupHppStandard } from '../../src/hjt/engine/lookup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/hjt-golden.json'), 'utf8')
);

test('hjt standard: golden Inet Corp IX&IIX INTIM', () => {
  const c = golden.find((x) => x.id === 'mode-a-inet-intim');
  const region = { region_code: 'INTIM', is_route: false };
  const tariffRow = { backbone: 97000, uplink: 8800, vas: 0 };
  const hpp = lookupHppStandard(tariffRow, region);
  assert.equal(hpp.backbone, c.expected.backbone);
  assert.equal(hpp.uplink, c.expected.uplink);

  const line = calcLineStandard({
    capacity: c.capacity,
    qty: c.qty,
    lastmile: c.lastmile,
    tariffRow,
    region,
  });
  assert.equal(line.harga_dasar, c.expected.harga_dasar);
});

test('hjt standard: combined route zero uplink/vas', () => {
  const region = { region_code: 'Sumkal - Jabodetabek', is_route: true };
  const hpp = lookupHppStandard({ backbone: 50000, uplink: 1000, vas: 2000 }, region);
  assert.equal(hpp.backbone, 50000);
  assert.equal(hpp.uplink, 0);
  assert.equal(hpp.vas, 0);
});

test('hjt standard: subscription grand total', () => {
  const lines = [{ harga_dasar: 105800 }];
  const out = calcQuotationStandard({
    lines,
    scheme: 'Subscription',
    durationYears: 1,
    otherExpenses: [],
  });
  assert.equal(out.total_per_month, 105800);
  assert.equal(out.grand_total_hjt, 105800 * 12);
});
