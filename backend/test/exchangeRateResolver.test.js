import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProjectRates,
  rateToIdr,
  collectProjectCurrencies,
} from '../src/utils/exchangeRateResolver.js';

test('rateToIdr: IDR is 1', () => {
  assert.equal(rateToIdr('IDR', { USD: 16500 }), 1);
});

test('rateToIdr: USD uses rate map', () => {
  assert.equal(rateToIdr('USD', { USD: 16500, IDR: 1 }), 16500);
});

test('rateToIdr: EUR uses rate map', () => {
  assert.equal(rateToIdr('EUR', { EUR: 18000, USD: 16500 }), 18000);
});

test('buildProjectRates: override wins over master', () => {
  const rates = buildProjectRates({ kurs_usd_override: 17000 }, { kurs_usd: 16500, kurs_eur: 18000 });
  assert.equal(rates.USD, 17000);
  assert.equal(rates.EUR, 18000);
});

test('collectProjectCurrencies: finds EUR in capex', () => {
  const cur = collectProjectCurrencies({
    capex: [{ currency: 'EUR', amount: 100 }],
    opex: [],
    revenue: [],
  });
  assert.ok(cur.includes('EUR'));
  assert.ok(cur.includes('USD'));
});
