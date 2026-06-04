import test from 'node:test';
import assert from 'node:assert/strict';
import {
  monthlyRevenueAmount,
  normalizeRevenueMode,
} from '../src/utils/revenueModes.js';

test('revenueModes: step_yearly switches tariff at month 13', () => {
  const item = {
    name: 'Langganan',
    revenue_mode: 'step_yearly',
    harsat_year_1: 10_000_000,
    harsat_year_2: 12_000_000,
    qty: 1,
    escalation_rate: 0,
    start_period: 1,
    end_period: 24,
    currency: 'IDR',
  };
  assert.equal(normalizeRevenueMode(item), 'step_yearly');
  assert.equal(monthlyRevenueAmount(item, 12, 16500, 24), 10_000_000);
  assert.equal(monthlyRevenueAmount(item, 13, 16500, 24), 12_000_000);
});

test('revenueModes: flat ignores escalation', () => {
  const item = {
    name: 'Flat',
    revenue_mode: 'flat',
    harsat: 5_000_000,
    qty: 2,
    escalation_rate: 0.01,
    start_period: 1,
    end_period: 6,
    currency: 'IDR',
  };
  assert.equal(monthlyRevenueAmount(item, 1, 16500, 6), 10_000_000);
  assert.equal(monthlyRevenueAmount(item, 6, 16500, 6), 10_000_000);
});
