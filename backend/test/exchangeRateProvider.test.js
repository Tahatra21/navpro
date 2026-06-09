import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseBiJisdorXml,
  parseFrankfurterPayload,
  setExchangeRateFetchImpl,
} from '../src/services/exchangeRateProvider.js';
import { validateExchangeRate } from '../src/services/exchangeRateService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('parseFrankfurterPayload: valid response', () => {
  const out = parseFrankfurterPayload({ rates: { IDR: 16500.42 } });
  assert.equal(out.rate, 16500.42);
  assert.equal(out.source, 'frankfurter');
});

test('parseFrankfurterPayload: rejects missing IDR', () => {
  assert.throws(() => parseFrankfurterPayload({ rates: {} }), (e) => e.status === 502);
});

test('parseBiJisdorXml: parses sample XML', () => {
  const xml = fs.readFileSync(path.join(__dirname, 'fixtures', 'bi-jisdor-sample.xml'), 'utf8');
  const rows = parseBiJisdorXml(xml);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].rate_date, '2026-05-26');
  assert.equal(rows[0].rate, 16480);
  assert.equal(rows[2].rate, 16520);
});

test('fetchFrankfurter via mock: returns rate', async () => {
  setExchangeRateFetchImpl(async () => ({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({ rates: { IDR: 16600 } }),
    text: async () => '',
  }));

  const { fetchFrankfurterUsdIdr } = await import('../src/services/exchangeRateProvider.js');
  const out = await fetchFrankfurterUsdIdr();
  assert.equal(out.rate, 16600);
  assert.equal(out.source, 'frankfurter');

  setExchangeRateFetchImpl(globalThis.fetch);
});

test('validateExchangeRate: accepts in-range rate', () => {
  assert.equal(validateExchangeRate(16500), 16500);
});

test('validateExchangeRate: rejects out of range', () => {
  assert.throws(() => validateExchangeRate(5000), (e) => e.status === 422);
});
