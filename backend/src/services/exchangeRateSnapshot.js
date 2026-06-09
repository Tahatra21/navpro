import { query } from '../db.js';
import {
  buildProjectRates,
  collectProjectCurrencies,
  kursMasterKey,
} from '../utils/exchangeRateResolver.js';

/** Latest daily rate on or before effective date */
export async function getHistoricalRateForDate(currency, effectiveDate) {
  const c = (currency || 'USD').toUpperCase();
  const { rows } = await query(
    `SELECT rate_date, rate, source, recorded_at
     FROM usd_exchange_rate_daily
     WHERE currency_from = $1 AND currency_to = 'IDR'
       AND rate_date <= $2::date
     ORDER BY rate_date DESC
     LIMIT 1`,
    [c, effectiveDate]
  );
  if (!rows[0]) return null;
  return {
    currency: c,
    rate_date: String(rows[0].rate_date).slice(0, 10),
    rate: Number(rows[0].rate),
    source: rows[0].source,
    recorded_at: rows[0].recorded_at,
  };
}

/**
 * Snapshot exchange rates at KKF submit — ties effective date to historical daily rate.
 */
export async function buildProjectExchangeRateSnapshot(proj, globalAss = {}) {
  const effectiveDate =
    proj.contract_start_date instanceof Date
      ? proj.contract_start_date.toISOString().slice(0, 10)
      : String(proj.contract_start_date || '').slice(0, 10);

  const ratesUsed = buildProjectRates(proj, globalAss);
  const currencies = collectProjectCurrencies(proj);
  const kursUsedFromKpi = proj.kpi?.exchange_rates_used || { USD: proj.kpi?.kurs_usd_used };

  const items = [];
  for (const c of currencies) {
    if (c === 'IDR') continue;
    const historical = effectiveDate ? await getHistoricalRateForDate(c, effectiveDate) : null;
    const masterKey = kursMasterKey(c);
    items.push({
      currency: c,
      kurs_used: kursUsedFromKpi?.[c] ?? ratesUsed[c] ?? null,
      master_rate_at_submit: globalAss[masterKey] != null ? Number(globalAss[masterKey]) : null,
      effective_date: effectiveDate,
      historical_rate: historical?.rate ?? null,
      historical_rate_date: historical?.rate_date ?? null,
      historical_source: historical?.source ?? null,
    });
  }

  return {
    captured_at: new Date().toISOString(),
    effective_date: effectiveDate,
    snapshot_type: 'SUBMIT',
    items,
  };
}
