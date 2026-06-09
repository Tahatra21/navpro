import { toWibDate, wibDateOffsetDays } from '../utils/wibDate.js';

const DEFAULT_TIMEOUT_MS = Number(process.env.EXCHANGE_RATE_FETCH_TIMEOUT_MS || 10000);
const BI_BASE =
  process.env.EXCHANGE_RATE_BI_URL ||
  'https://www.bi.go.id/biwebservice/wskursbi.asmx/getSubKursJisdor3';

let fetchImpl = globalThis.fetch;

/** Test hook — inject mock fetch */
export function setExchangeRateFetchImpl(fn) {
  fetchImpl = fn || globalThis.fetch;
}

async function fetchWithTimeout(url, { timeoutMs = DEFAULT_TIMEOUT_MS, accept = 'application/json' } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      headers: { Accept: accept },
    });
    if (!res.ok) {
      const err = new Error(`Provider HTTP ${res.status}`);
      err.status = 502;
      throw err;
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('json')) {
      return { kind: 'json', data: await res.json() };
    }
    return { kind: 'text', data: await res.text() };
  } catch (e) {
    if (e.name === 'AbortError') {
      const err = new Error('Provider timeout');
      err.status = 502;
      throw err;
    }
    if (!e.status) {
      const err = new Error(e.message || 'Provider unreachable');
      err.status = 502;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export function parseFrankfurterPayload(payload) {
  const rate = payload?.rates?.IDR;
  if (rate == null || !Number.isFinite(Number(rate))) {
    const err = new Error('Invalid rate from Frankfurter');
    err.status = 502;
    throw err;
  }
  return {
    rate: Math.round(Number(rate) * 100) / 100,
    source: 'frankfurter',
    rawPayload: payload,
  };
}

/** Parse BI wsKursBI getSubKursJisdor3 XML response */
export function parseBiJisdorXml(xml) {
  const rows = [];
  const tableRe = /<Table[^>]*>([\s\S]*?)<\/Table>/gi;
  let match;
  while ((match = tableRe.exec(xml)) !== null) {
    const block = match[1];
    const rateMatch = block.match(/<nil_subkurs>([^<]+)<\/nil_subkurs>/i);
    const dateMatch = block.match(/<tgl_subkurs>([^<]+)<\/tgl_subkurs>/i);
    const mtsMatch = block.match(/<mts_subkurs>([^<]+)<\/mts_subkurs>/i);
    if (!rateMatch || !dateMatch) continue;
    const mts = (mtsMatch?.[1] || 'USD').trim().toUpperCase();
    if (mts !== 'USD') continue;
    const rate = Math.round(Number(rateMatch[1].replace(/,/g, '')) * 100) / 100;
    if (!Number.isFinite(rate)) continue;
    const dateRaw = dateMatch[1].trim();
    const rateDate = dateRaw.slice(0, 10);
    rows.push({ rate_date: rateDate, rate });
  }
  rows.sort((a, b) => a.rate_date.localeCompare(b.rate_date));
  return rows;
}

function biJisdorUrl(startDate, endDate) {
  const params = new URLSearchParams({
    mts: 'USD',
    startDate,
    endDate,
  });
  const base = BI_BASE.includes('?') ? BI_BASE : BI_BASE;
  return `${base}?${params.toString()}`;
}

export async function fetchBiJisdorRange(startDate, endDate) {
  const url = biJisdorUrl(startDate, endDate);
  const { data } = await fetchWithTimeout(url, { accept: 'text/xml, application/xml, */*' });
  const rows = parseBiJisdorXml(String(data));
  if (rows.length === 0) {
    const err = new Error('No JISDOR rows from BI');
    err.status = 502;
    throw err;
  }
  return rows.map((r) => ({ ...r, source: 'bi_jisdor' }));
}

export async function fetchBiJisdorUsdIdr() {
  const endDate = toWibDate();
  const startDate = wibDateOffsetDays(-7);
  const rows = await fetchBiJisdorRange(startDate, endDate);
  const latest = rows[rows.length - 1];
  return {
    rate: latest.rate,
    source: 'bi_jisdor',
    rate_date: latest.rate_date,
    rawPayload: { rows },
  };
}

export async function fetchFrankfurterUsdIdr() {
  return fetchFrankfurterPair('USD');
}

export async function fetchFrankfurterPair(fromCurrency = 'USD') {
  const c = fromCurrency.toUpperCase();
  const custom = process.env.EXCHANGE_RATE_CUSTOM_URL;
  const url =
    c === 'USD' && custom
      ? custom
      : `https://api.frankfurter.app/latest?from=${c}&to=IDR`;
  const { data } = await fetchWithTimeout(url);
  const parsed = parseFrankfurterPayload(data);
  return { ...parsed, currency: c };
}

export async function fetchCurrencyIdr(currency) {
  const c = (currency || 'USD').toUpperCase();
  const provider = (process.env.EXCHANGE_RATE_PROVIDER || 'frankfurter').toLowerCase();
  if (c === 'USD' && provider === 'bi_jisdor') {
    return fetchBiJisdorUsdIdr();
  }
  if (provider === 'custom' && c === 'USD') {
    if (!process.env.EXCHANGE_RATE_CUSTOM_URL) {
      const err = new Error('EXCHANGE_RATE_CUSTOM_URL is required for custom provider');
      err.status = 500;
      throw err;
    }
    return fetchFrankfurterUsdIdr();
  }
  return fetchFrankfurterPair(c);
}

export async function fetchUsdIdr() {
  return fetchCurrencyIdr('USD');
}
