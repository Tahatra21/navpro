/** Supported foreign currencies → IDR (Phase 3) */
export const SUPPORTED_FX_CURRENCIES = (process.env.EXCHANGE_RATE_CURRENCIES || 'USD,EUR,SGD')
  .split(',')
  .map((c) => c.trim().toUpperCase())
  .filter((c) => c && c !== 'IDR');

export const KURS_MASTER_KEYS = {
  USD: 'kurs_usd',
  EUR: 'kurs_eur',
  SGD: 'kurs_sgd',
};

const DEFAULT_RATES = {
  USD: 16500,
  EUR: 18000,
  SGD: 12500,
};

export function kursMasterKey(currency) {
  return KURS_MASTER_KEYS[currency?.toUpperCase()] || `kurs_${String(currency || '').toLowerCase()}`;
}

export function projectOverrideKey(currency) {
  const c = currency?.toUpperCase();
  if (c === 'USD') return 'kurs_usd_override';
  return `kurs_${String(currency || '').toLowerCase()}_override`;
}

/** Build { IDR: 1, USD: n, EUR: n, ... } for calculation */
export function buildProjectRates(proj, globalAss = {}) {
  const rates = { IDR: 1 };
  for (const c of SUPPORTED_FX_CURRENCIES) {
    const overrideKey = projectOverrideKey(c);
    const masterKey = kursMasterKey(c);
    const overrideVal = proj?.[overrideKey];
    if (overrideVal != null && overrideVal !== '') {
      rates[c] = parseFloat(overrideVal);
    } else if (globalAss[masterKey] != null) {
      rates[c] = parseFloat(globalAss[masterKey]);
    } else {
      rates[c] = DEFAULT_RATES[c] ?? DEFAULT_RATES.USD;
    }
  }
  return rates;
}

export function rateToIdr(currency, rates) {
  const c = (currency || 'IDR').toUpperCase();
  if (c === 'IDR') return 1;
  const r = rates?.[c];
  if (Number.isFinite(r) && r > 0) return r;
  if (c === 'USD' && Number.isFinite(rates?.USD)) return rates.USD;
  return 1;
}

/** Collect distinct non-IDR currencies used in project line items */
export function collectProjectCurrencies(proj) {
  const set = new Set(['USD']);
  for (const list of [proj?.capex, proj?.opex, proj?.revenue]) {
    for (const item of list || []) {
      const c = (item?.currency || 'IDR').toUpperCase();
      if (c !== 'IDR') set.add(c);
    }
  }
  return [...set];
}
