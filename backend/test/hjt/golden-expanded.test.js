import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { calcLineStandard, calcQuotationStandard } from '../../src/hjt/engine/standard.js';
import { HJT_PRODUCTS, HJT_IBBC_SEED } from '../../src/hjt/data/catalogSeed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/hjt-golden.json'), 'utf8')
);

test('hjt catalog: exactly 125 products', () => {
  assert.equal(HJT_PRODUCTS.length, 125);
  assert.equal(new Set(HJT_PRODUCTS.map((p) => p.product_name)).size, 125);
});

test('hjt catalog: exactly 78 IBBC rows', () => {
  assert.equal(HJT_IBBC_SEED.length, 78);
});

test('hjt golden: all cases have id', () => {
  assert.ok(golden.length >= 15);
  for (const c of golden) assert.ok(c.id);
});

test('hjt golden: clear channel sumatera', () => {
  const c = golden.find((x) => x.id === 'mode-a-clear-sumatera');
  const line = calcLineStandard({
    capacity: c.capacity,
    qty: c.qty,
    lastmile: c.lastmile,
    tariffRow: c.tariff,
    region: { region_code: c.region_code, is_route: false },
  });
  assert.equal(line.harga_dasar, c.expected.harga_dasar);
});

test('hjt golden: IP VPN capacity multiplier', () => {
  const c = golden.find((x) => x.id === 'mode-a-ipvpn-jb');
  const line = calcLineStandard({
    capacity: c.capacity,
    qty: c.qty,
    lastmile: c.lastmile,
    tariffRow: c.tariff,
    region: { region_code: c.region_code, is_route: false },
  });
  assert.equal(line.harga_dasar, c.expected.harga_dasar);
});

test('hjt golden: metronet qty 2', () => {
  const c = golden.find((x) => x.id === 'mode-a-metronet-qty2');
  const line = calcLineStandard({
    capacity: c.capacity,
    qty: c.qty,
    lastmile: c.lastmile,
    tariffRow: c.tariff,
    region: { region_code: 'Sumatera', is_route: false },
  });
  assert.equal(line.harga_dasar, c.expected.harga_dasar);
});

test('hjt golden: OTC scheme', () => {
  const c = golden.find((x) => x.id === 'mode-a-otc-scheme');
  const out = calcQuotationStandard({
    lines: c.lines,
    scheme: c.scheme,
    durationYears: c.duration_years,
    otherExpenses: [],
  });
  assert.equal(out.grand_total_hjt, c.expected.grand_total_hjt);
});

test('hjt golden: capacity 10x multiplier', () => {
  const c = golden.find((x) => x.id === 'mode-a-capacity-10');
  const line = calcLineStandard({
    capacity: c.capacity,
    qty: c.qty,
    lastmile: c.lastmile,
    tariffRow: c.tariff,
    region: { region_code: 'INTIM', is_route: false },
  });
  assert.equal(line.harga_dasar, c.expected.harga_dasar);
});

test('hjt golden: jabodetabek inet line', () => {
  const c = golden.find((x) => x.id === 'mode-a-jabodetabek-inet');
  const line = calcLineStandard({
    capacity: c.capacity,
    qty: c.qty,
    lastmile: c.lastmile,
    tariffRow: c.tariff,
    region: { region_code: 'Jabodetabek', is_route: false },
  });
  assert.equal(line.harga_dasar, c.expected.harga_dasar);
});

test('hjt golden: other expense grand total', () => {
  const c = golden.find((x) => x.id === 'other-expense-total');
  const out = calcQuotationStandard({
    lines: c.lines,
    scheme: c.scheme,
    durationYears: c.duration_years,
    otherExpenses: c.other_expenses,
    marginFloor: 0.1,
    marginRecommended: 0.2,
  });
  assert.equal(out.grand_total_all, c.expected.grand_total_all);
});

test('hjt golden: margin floor subscription', () => {
  const c = golden.find((x) => x.id === 'margin-floor-10pct');
  const out = calcQuotationStandard({
    lines: c.lines,
    scheme: 'Subscription',
    durationYears: 1,
    otherExpenses: [],
    marginFloor: c.margin_floor,
    marginRecommended: 0.2,
  });
  assert.equal(out.offer.floor, c.expected.offer_floor);
});
