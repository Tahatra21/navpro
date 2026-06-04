import test from 'node:test';
import assert from 'node:assert/strict';
import { OPEX_SERVICE_CATALOG_SEED } from '../src/data/opexServiceCatalogSeed.js';

test('opexServiceCatalogSeed: unique codes and valid types', () => {
  const codes = new Set();
  for (const item of OPEX_SERVICE_CATALOG_SEED) {
    assert.ok(item.code);
    assert.ok(item.name);
    assert.ok(['NOMINAL', 'PERCENT'].includes(item.default_type));
    assert.ok(!codes.has(item.code), `duplicate code ${item.code}`);
    codes.add(item.code);
  }
  assert.ok(OPEX_SERVICE_CATALOG_SEED.length >= 10);
});
