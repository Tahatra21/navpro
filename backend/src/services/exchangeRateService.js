import { query } from '../db.js';
import { toWibDate, wibDateOffsetDays } from '../utils/wibDate.js';
import { fetchUsdIdr } from './exchangeRateProvider.js';

const MIN_RATE = Number(process.env.EXCHANGE_RATE_MIN || 10000);
const MAX_RATE = Number(process.env.EXCHANGE_RATE_MAX || 25000);

export function validateExchangeRate(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n) || n < MIN_RATE || n > MAX_RATE) {
    const err = new Error(`Kurs di luar batas valid (${MIN_RATE}–${MAX_RATE} IDR)`);
    err.status = 422;
    throw err;
  }
  return n;
}

export async function getLatestAssumptions() {
  const { rows } = await query(`SELECT data FROM assumptions_master ORDER BY id DESC LIMIT 1`);
  return rows[0]?.data || {};
}

async function saveAssumptions(data, { userId = null, userName = 'System' } = {}) {
  await query(`INSERT INTO assumptions_master (data, updated_by) VALUES ($1, $2)`, [
    JSON.stringify(data),
    userId,
  ]);
  await query(`INSERT INTO assumptions_history (data, updated_by_name) VALUES ($1, $2)`, [
    JSON.stringify({ ...data, updated_at: new Date().toISOString(), updated_by: userName }),
    userName,
  ]);
}

export async function logExchangeRateAttempt({
  rate = null,
  previousRate = null,
  source,
  syncMode,
  rateDate,
  applied = true,
  errorMessage = null,
  rawPayload = null,
  userId = null,
}) {
  await query(
    `INSERT INTO exchange_rate_log
       (currency_from, currency_to, rate, previous_rate, source, sync_mode, rate_date, applied, error_message, raw_payload, triggered_by)
     VALUES ('USD','IDR',$1,$2,$3,$4,$5::date,$6,$7,$8,$9)`,
    [
      rate,
      previousRate,
      source,
      syncMode,
      rateDate || toWibDate(),
      applied,
      errorMessage,
      rawPayload ? JSON.stringify(rawPayload) : null,
      userId,
    ]
  );
}

export async function upsertDailyRate({ rate, source, syncMode, userId = null }) {
  const rateDate = toWibDate();
  const { rows: prev } = await query(
    `SELECT rate FROM usd_exchange_rate_daily
     WHERE rate_date = ($1::date - INTERVAL '1 day')
       AND currency_from = 'USD' AND currency_to = 'IDR'
     LIMIT 1`,
    [rateDate]
  );
  const previousDayRate = prev[0]?.rate != null ? Number(prev[0].rate) : null;
  const changeAmount = previousDayRate != null ? rate - previousDayRate : null;
  const changePercent =
    previousDayRate != null && previousDayRate !== 0
      ? Math.round(((rate - previousDayRate) / previousDayRate) * 10000) / 100
      : null;

  await query(
    `INSERT INTO usd_exchange_rate_daily
       (rate_date, currency_from, currency_to, rate, previous_day_rate, change_amount, change_percent, source, sync_mode)
     VALUES ($1::date,'USD','IDR',$2,$3,$4,$5,$6,$7)
     ON CONFLICT (rate_date, currency_from, currency_to) DO UPDATE SET
       rate = EXCLUDED.rate,
       previous_day_rate = EXCLUDED.previous_day_rate,
       change_amount = EXCLUDED.change_amount,
       change_percent = EXCLUDED.change_percent,
       source = EXCLUDED.source,
       sync_mode = EXCLUDED.sync_mode,
       recorded_at = NOW()`,
    [rateDate, rate, previousDayRate, changeAmount, changePercent, source, syncMode]
  );

  return { rateDate, previousDayRate, changeAmount, changePercent };
}

export async function seedDailyFromAssumptions({ syncMode = 'seed' } = {}) {
  const assumptions = await getLatestAssumptions();
  const rate = Number(assumptions.kurs_usd);
  if (!Number.isFinite(rate)) return null;

  const rateDate = toWibDate();
  const { rows } = await query(
    `SELECT id FROM usd_exchange_rate_daily
     WHERE rate_date = $1::date AND currency_from = 'USD' AND currency_to = 'IDR'`,
    [rateDate]
  );
  if (rows.length > 0) return null;

  const source = assumptions.kurs_usd_source || 'manual';
  return upsertDailyRate({ rate, source, syncMode });
}

export async function getCurrentExchangeRate() {
  const assumptions = await getLatestAssumptions();
  const rate = Number(assumptions.kurs_usd);
  const rateDate = toWibDate();

  const { rows: daily } = await query(
    `SELECT rate_date, rate, previous_day_rate, change_amount, change_percent, source, recorded_at
     FROM usd_exchange_rate_daily
     WHERE currency_from = 'USD' AND currency_to = 'IDR'
     ORDER BY rate_date DESC LIMIT 1`
  );
  const latestDaily = daily[0];

  const previousDayRate =
    latestDaily?.previous_day_rate != null
      ? Number(latestDaily.previous_day_rate)
      : null;
  const changeAmount =
    latestDaily?.change_amount != null ? Number(latestDaily.change_amount) : null;
  const changePercent =
    latestDaily?.change_percent != null ? Number(latestDaily.change_percent) : null;

  return {
    currency_pair: 'USD/IDR',
    rate: Number.isFinite(rate) ? rate : latestDaily ? Number(latestDaily.rate) : null,
    source: assumptions.kurs_usd_source || latestDaily?.source || 'manual',
    updated_at: assumptions.kurs_usd_updated_at || latestDaily?.recorded_at || null,
    rate_date: latestDaily?.rate_date
      ? String(latestDaily.rate_date).slice(0, 10)
      : rateDate,
    auto_sync_enabled: assumptions.kurs_auto_sync_enabled !== false,
    previous_day_rate: previousDayRate,
    change_amount: changeAmount,
    change_percent: changePercent,
  };
}

export async function getExchangeRateHistory({
  from,
  to,
  limit = 90,
  order = 'desc',
} = {}) {
  const today = toWibDate();
  const toDate = to || today;
  const fromDate = from || wibDateOffsetDays(-30);
  const lim = Math.min(Math.max(Number(limit) || 90, 1), 365);
  const dir = order === 'asc' ? 'ASC' : 'DESC';

  const { rows } = await query(
    `SELECT rate_date, rate, previous_day_rate, change_amount, change_percent, source, recorded_at
     FROM usd_exchange_rate_daily
     WHERE currency_from = 'USD' AND currency_to = 'IDR'
       AND rate_date >= $1::date AND rate_date <= $2::date
     ORDER BY rate_date ${dir}
     LIMIT $3`,
    [fromDate, toDate, lim]
  );

  const items = rows.map((r) => ({
    rate_date: String(r.rate_date).slice(0, 10),
    rate: Number(r.rate),
    previous_day_rate: r.previous_day_rate != null ? Number(r.previous_day_rate) : null,
    change_amount: r.change_amount != null ? Number(r.change_amount) : null,
    change_percent: r.change_percent != null ? Number(r.change_percent) : null,
    source: r.source,
    recorded_at: r.recorded_at,
  }));

  const rates = items.map((i) => i.rate).filter(Number.isFinite);
  const summary = {
    count: items.length,
    min_rate: rates.length ? Math.min(...rates) : null,
    max_rate: rates.length ? Math.max(...rates) : null,
    latest_rate: items.length
      ? (dir === 'DESC' ? items[0].rate : items[items.length - 1].rate)
      : null,
  };

  return {
    currency_pair: 'USD/IDR',
    from: fromDate,
    to: toDate,
    items,
    summary,
  };
}

export async function syncExchangeRate({
  mode = 'manual',
  userId = null,
  userName = 'System',
  force = false,
} = {}) {
  const assumptions = await getLatestAssumptions();
  const autoEnabled = assumptions.kurs_auto_sync_enabled !== false;

  if (!force && mode === 'manual' && autoEnabled === false) {
    const err = new Error('Auto sync dinonaktifkan. Gunakan force: true untuk sync manual.');
    err.status = 409;
    throw err;
  }

  const previousRate = Number(assumptions.kurs_usd) || null;
  const rateDate = toWibDate();

  try {
    const fetched = await fetchUsdIdr();
    const rate = validateExchangeRate(fetched.rate);

    await logExchangeRateAttempt({
      rate,
      previousRate,
      source: fetched.source,
      syncMode: mode,
      rateDate,
      applied: true,
      rawPayload: fetched.rawPayload,
      userId,
    });

    const next = {
      ...assumptions,
      kurs_usd: rate,
      kurs_usd_source: fetched.source,
      kurs_usd_updated_at: new Date().toISOString(),
    };
    await saveAssumptions(next, { userId, userName });
    const daily = await upsertDailyRate({ rate, source: fetched.source, syncMode: mode, userId });

    console.log(
      `[navpro:kurs] synced USD/IDR ${previousRate ?? '—'} → ${rate} (${fetched.source}, ${mode})`
    );

    return {
      applied: true,
      rate,
      previous_rate: previousRate,
      source: fetched.source,
      rate_date: daily.rateDate,
      change_amount: daily.changeAmount,
      change_percent: daily.changePercent,
    };
  } catch (e) {
    await logExchangeRateAttempt({
      rate: null,
      previousRate,
      source: process.env.EXCHANGE_RATE_PROVIDER || 'frankfurter',
      syncMode: mode,
      rateDate,
      applied: false,
      errorMessage: e.message,
      userId,
    }).catch((logErr) => console.error('[navpro:kurs] log failed:', logErr));
    throw e;
  }
}

export async function patchExchangeRateSettings({ kurs_auto_sync_enabled }) {
  const assumptions = await getLatestAssumptions();
  const next = {
    ...assumptions,
    kurs_auto_sync_enabled: Boolean(kurs_auto_sync_enabled),
  };
  await saveAssumptions(next, { userName: 'Admin' });
  return { kurs_auto_sync_enabled: next.kurs_auto_sync_enabled };
}

export async function getExchangeRateSyncLog(limit = 50) {
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const { rows } = await query(
    `SELECT id, rate, previous_rate, source, sync_mode, fetched_at, rate_date, applied, error_message, triggered_by
     FROM exchange_rate_log
     WHERE currency_from = 'USD' AND currency_to = 'IDR'
     ORDER BY fetched_at DESC
     LIMIT $1`,
    [lim]
  );
  return { items: rows };
}

export async function wasSyncedToday() {
  const rateDate = toWibDate();
  const { rows } = await query(
    `SELECT id FROM exchange_rate_log
     WHERE rate_date = $1::date AND applied = true AND sync_mode = 'scheduled'
     LIMIT 1`,
    [rateDate]
  );
  return rows.length > 0;
}
