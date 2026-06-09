const DEFAULT_TIMEOUT_MS = Number(process.env.EXCHANGE_RATE_FETCH_TIMEOUT_MS || 10000);

async function fetchWithTimeout(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) {
      const err = new Error(`Provider HTTP ${res.status}`);
      err.status = 502;
      throw err;
    }
    return res.json();
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

export async function fetchFrankfurterUsdIdr() {
  const url =
    process.env.EXCHANGE_RATE_CUSTOM_URL ||
    'https://api.frankfurter.app/latest?from=USD&to=IDR';
  const payload = await fetchWithTimeout(url);
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

export async function fetchUsdIdr() {
  const provider = (process.env.EXCHANGE_RATE_PROVIDER || 'frankfurter').toLowerCase();
  if (provider === 'custom') {
    if (!process.env.EXCHANGE_RATE_CUSTOM_URL) {
      const err = new Error('EXCHANGE_RATE_CUSTOM_URL is required for custom provider');
      err.status = 500;
      throw err;
    }
    return fetchFrankfurterUsdIdr();
  }
  if (provider === 'frankfurter') {
    return fetchFrankfurterUsdIdr();
  }
  const err = new Error(`Unknown EXCHANGE_RATE_PROVIDER: ${provider}`);
  err.status = 500;
  throw err;
}
