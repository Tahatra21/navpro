import test from 'node:test';
import assert from 'node:assert/strict';
import { toWibDate, wibDateOffsetDays } from '../src/utils/wibDate.js';
import { validateExchangeRate } from '../src/services/exchangeRateService.js';

test('wibDate: toWibDate returns YYYY-MM-DD', () => {
  const d = toWibDate(new Date('2026-06-08T20:00:00.000Z'));
  assert.match(d, /^\d{4}-\d{2}-\d{2}$/);
});

test('wibDate: offset days', () => {
  const base = '2026-06-10';
  const prev = wibDateOffsetDays(-1, new Date(`${base}T12:00:00+07:00`));
  assert.equal(prev, '2026-06-09');
});

test('validateExchangeRate: accepts in-range rate', () => {
  assert.equal(validateExchangeRate(16500), 16500);
});

test('validateExchangeRate: rejects out of range', () => {
  assert.throws(() => validateExchangeRate(5000), (e) => e.status === 422);
  assert.throws(() => validateExchangeRate(99999), (e) => e.status === 422);
});

test('validateExchangeRate: rejects non-numeric', () => {
  assert.throws(() => validateExchangeRate('abc'), (e) => e.status === 422);
});
