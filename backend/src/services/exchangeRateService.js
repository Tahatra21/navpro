import { query } from '../db.js';
import { toWibDate, wibDateOffsetDays } from '../utils/wibDate.js';
import {
  notifyFinanceAdminsPendingApproval,
  notifyFinanceAdminsSyncFailure,
} from '../utils/exchangeRateNotify.js';
import { fetchBiJisdorRange, fetchCurrencyIdr, fetchUsdIdr } from './exchangeRateProvider.js';
import {
  kursMasterKey,
  SUPPORTED_FX_CURRENCIES,
} from '../utils/exchangeRateResolver.js';

const MIN_RATE = Number(process.env.EXCHANGE_RATE_MIN || 10000);
const MAX_RATE = Number(process.env.EXCHANGE_RATE_MAX || 25000);
const MAX_DELTA_PERCENT = Number(process.env.EXCHANGE_RATE_MAX_DELTA_PERCENT || 5);
const FAIL_NOTIFY_STREAK = Number(process.env.EXCHANGE_RATE_FAIL_NOTIFY_STREAK || 3);
const RATE_UNCHANGED_EPS = 0.01;

export function validateExchangeRate(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n) || n < MIN_RATE || n > MAX_RATE) {
    const err = new Error(`Kurs di luar batas valid (${MIN_RATE}–${MAX_RATE} IDR)`);
    err.status = 422;
    throw err;
  }
  return n;
}

function ratesEqual(a, b) {
  if (a == null || b == null) return false;
  return Math.abs(Number(a) - Number(b)) < RATE_UNCHANGED_EPS;
}

function deltaPercent(previousRate, newRate) {
  if (!previousRate || previousRate === 0) return 0;
  return Math.abs(((newRate - previousRate) / previousRate) * 100);
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

async function getAppMeta(key) {
  const { rows } = await query(`SELECT value FROM app_meta WHERE key = $1`, [key]);
  return rows[0]?.value ?? null;
}

async function setAppMeta(key, value) {
  await query(
    `INSERT INTO app_meta (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, String(value)]
  );
}

async function recordSyncSuccess() {
  await setAppMeta('kurs_sync_fail_streak', '0');
}

async function recordSyncFailure() {
  const streak = Number((await getAppMeta('kurs_sync_fail_streak')) || 0) + 1;
  await setAppMeta('kurs_sync_fail_streak', String(streak));
  if (streak >= FAIL_NOTIFY_STREAK) {
    await notifyFinanceAdminsSyncFailure(streak).catch((e) =>
      console.error('[navpro:kurs] notify failure:', e.message)
    );
  }
  return streak;
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

export async function upsertDailyRate({
  rate,
  source,
  syncMode,
  rateDate = toWibDate(),
  currencyFrom = 'USD',
  userId = null,
}) {
  const cFrom = currencyFrom.toUpperCase();
  const { rows: prev } = await query(
    `SELECT rate FROM usd_exchange_rate_daily
     WHERE rate_date < $1::date
       AND currency_from = $2 AND currency_to = 'IDR'
     ORDER BY rate_date DESC LIMIT 1`,
    [rateDate, cFrom]
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
     VALUES ($1::date,$2,'IDR',$3,$4,$5,$6,$7,$8)
     ON CONFLICT (rate_date, currency_from, currency_to) DO UPDATE SET
       rate = EXCLUDED.rate,
       previous_day_rate = EXCLUDED.previous_day_rate,
       change_amount = EXCLUDED.change_amount,
       change_percent = EXCLUDED.change_percent,
       source = EXCLUDED.source,
       sync_mode = EXCLUDED.sync_mode,
       recorded_at = NOW()`,
    [rateDate, cFrom, rate, previousDayRate, changeAmount, changePercent, source, syncMode]
  );

  return { rateDate, previousDayRate, changeAmount, changePercent };
}

export async function seedDailyFromAssumptions({ syncMode = 'seed' } = {}) {
  const assumptions = await getLatestAssumptions();
  const rateDate = toWibDate();
  let seeded = 0;

  for (const c of SUPPORTED_FX_CURRENCIES) {
    const key = kursMasterKey(c);
    const rate = Number(assumptions[key]);
    if (!Number.isFinite(rate)) continue;

    const { rows } = await query(
      `SELECT id FROM usd_exchange_rate_daily
       WHERE rate_date = $1::date AND currency_from = $2 AND currency_to = 'IDR'`,
      [rateDate, c]
    );
    if (rows.length > 0) continue;

    const source = assumptions[`${key}_source`] || assumptions.kurs_usd_source || 'manual';
    await upsertDailyRate({ rate, source, syncMode, currencyFrom: c });
    seeded += 1;
  }

  return seeded > 0 ? { seeded } : null;
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
    latestDaily?.previous_day_rate != null ? Number(latestDaily.previous_day_rate) : null;
  const changeAmount =
    latestDaily?.change_amount != null ? Number(latestDaily.change_amount) : null;
  const changePercent =
    latestDaily?.change_percent != null ? Number(latestDaily.change_percent) : null;

  const pendingRate = Number(assumptions.kurs_usd_pending);

  const masterRates = {};
  for (const c of SUPPORTED_FX_CURRENCIES) {
    const key = kursMasterKey(c);
    if (assumptions[key] != null) masterRates[c] = Number(assumptions[key]);
  }

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
    pending_rate: Number.isFinite(pendingRate) ? pendingRate : null,
    pending_delta_percent:
      assumptions.kurs_pending_delta_percent != null
        ? Number(assumptions.kurs_pending_delta_percent)
        : null,
    pending_at: assumptions.kurs_pending_at || null,
    pending_source: assumptions.kurs_pending_source || null,
    master_rates: masterRates,
    supported_currencies: SUPPORTED_FX_CURRENCIES,
  };
}

export async function getExchangeRateHistory({
  from,
  to,
  limit = 90,
  order = 'desc',
  currency = 'USD',
} = {}) {
  const today = toWibDate();
  const toDate = to || today;
  const fromDate = from || wibDateOffsetDays(-30);
  const lim = Math.min(Math.max(Number(limit) || 90, 1), 365);
  const dir = order === 'asc' ? 'ASC' : 'DESC';
  const cFrom = (currency || 'USD').toUpperCase();

  const { rows } = await query(
    `SELECT rate_date, rate, previous_day_rate, change_amount, change_percent, source, recorded_at
     FROM usd_exchange_rate_daily
     WHERE currency_from = $1 AND currency_to = 'IDR'
       AND rate_date >= $2::date AND rate_date <= $3::date
     ORDER BY rate_date ${dir}
     LIMIT $4`,
    [cFrom, fromDate, toDate, lim]
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
      ? dir === 'DESC'
        ? items[0].rate
        : items[items.length - 1].rate
      : null,
  };

  return {
    currency_pair: `${cFrom}/IDR`,
    from: fromDate,
    to: toDate,
    items,
    summary,
  };
}

async function applyExchangeRate({
  assumptions,
  rate,
  source,
  syncMode,
  userId,
  userName,
  rateDate = toWibDate(),
}) {
  const previousRate = Number(assumptions.kurs_usd) || null;
  const next = {
    ...assumptions,
    kurs_usd: rate,
    kurs_usd_source: source,
    kurs_usd_updated_at: new Date().toISOString(),
    kurs_usd_pending: undefined,
    kurs_pending_delta_percent: undefined,
    kurs_pending_at: undefined,
    kurs_pending_source: undefined,
  };
  delete next.kurs_usd_pending;
  delete next.kurs_pending_delta_percent;
  delete next.kurs_pending_at;
  delete next.kurs_pending_source;

  await saveAssumptions(next, { userId, userName });
  const daily = await upsertDailyRate({ rate, source, syncMode, rateDate, userId });
  await recordSyncSuccess();

  console.log(
    `[navpro:kurs] synced USD/IDR ${previousRate ?? '—'} → ${rate} (${source}, ${syncMode})`
  );

  return {
    applied: true,
    rate,
    previous_rate: previousRate,
    source,
    rate_date: daily.rateDate,
    change_amount: daily.changeAmount,
    change_percent: daily.changePercent,
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
    const effectiveDate = fetched.rate_date || rateDate;

    if (ratesEqual(rate, previousRate)) {
      await logExchangeRateAttempt({
        rate,
        previousRate,
        source: fetched.source,
        syncMode: mode,
        rateDate: effectiveDate,
        applied: false,
        errorMessage: 'unchanged',
        rawPayload: fetched.rawPayload,
        userId,
      });
      await recordSyncSuccess();
      return {
        applied: false,
        rate,
        previous_rate: previousRate,
        source: fetched.source,
        rate_date: effectiveDate,
        reason: 'unchanged',
      };
    }

    const pct = deltaPercent(previousRate, rate);
    if (!force && previousRate != null && pct > MAX_DELTA_PERCENT) {
      const pendingAssumptions = {
        ...assumptions,
        kurs_usd_pending: rate,
        kurs_pending_delta_percent: Math.round(pct * 100) / 100,
        kurs_pending_at: new Date().toISOString(),
        kurs_pending_source: fetched.source,
      };
      await saveAssumptions(pendingAssumptions, { userId, userName });
      await logExchangeRateAttempt({
        rate,
        previousRate,
        source: fetched.source,
        syncMode: mode,
        rateDate: effectiveDate,
        applied: false,
        errorMessage: `pending approval: delta ${pct.toFixed(2)}%`,
        rawPayload: fetched.rawPayload,
        userId,
      });
      await notifyFinanceAdminsPendingApproval({
        rate,
        previousRate,
        deltaPercent: pct,
      }).catch((e) => console.error('[navpro:kurs] pending notify:', e.message));

      return {
        applied: false,
        pending_approval: true,
        rate,
        previous_rate: previousRate,
        source: fetched.source,
        rate_date: effectiveDate,
        delta_percent: pct,
      };
    }

    await logExchangeRateAttempt({
      rate,
      previousRate,
      source: fetched.source,
      syncMode: mode,
      rateDate: effectiveDate,
      applied: true,
      rawPayload: fetched.rawPayload,
      userId,
    });

    return applyExchangeRate({
      assumptions,
      rate,
      source: fetched.source,
      syncMode: mode,
      userId,
      userName,
      rateDate: effectiveDate,
    });
  } catch (e) {
    await recordSyncFailure();
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

export async function approvePendingExchangeRate({ userId = null, userName = 'Admin' } = {}) {
  const assumptions = await getLatestAssumptions();
  const pending = Number(assumptions.kurs_usd_pending);
  if (!Number.isFinite(pending)) {
    const err = new Error('Tidak ada kurs yang menunggu persetujuan.');
    err.status = 404;
    throw err;
  }
  const source = assumptions.kurs_pending_source || assumptions.kurs_usd_source || 'manual';
  validateExchangeRate(pending);

  await logExchangeRateAttempt({
    rate: pending,
    previousRate: Number(assumptions.kurs_usd) || null,
    source,
    syncMode: 'manual',
    rateDate: toWibDate(),
    applied: true,
    userId,
  });

  return applyExchangeRate({
    assumptions,
    rate: pending,
    source,
    syncMode: 'manual',
    userId,
    userName,
  });
}

export async function rejectPendingExchangeRate({ userId = null, userName = 'Admin' } = {}) {
  const assumptions = await getLatestAssumptions();
  if (assumptions.kurs_usd_pending == null) {
    const err = new Error('Tidak ada kurs yang menunggu persetujuan.');
    err.status = 404;
    throw err;
  }
  const next = { ...assumptions };
  delete next.kurs_usd_pending;
  delete next.kurs_pending_delta_percent;
  delete next.kurs_pending_at;
  delete next.kurs_pending_source;
  await saveAssumptions(next, { userId, userName });
  return { rejected: true };
}

export async function backfillBiJisdor({ from, to, userId = null, userName = 'Admin' } = {}) {
  const fromDate = from || wibDateOffsetDays(-90);
  const toDate = to || toWibDate();
  const rows = await fetchBiJisdorRange(fromDate, toDate);

  let inserted = 0;
  for (const row of rows) {
    await upsertDailyRate({
      rate: row.rate,
      source: 'bi_jisdor',
      syncMode: 'backfill',
      rateDate: row.rate_date,
      userId,
    });
    inserted += 1;
  }

  await logExchangeRateAttempt({
    rate: rows[rows.length - 1]?.rate ?? null,
    previousRate: null,
    source: 'bi_jisdor',
    syncMode: 'backfill',
    rateDate: toDate,
    applied: true,
    rawPayload: { count: inserted, from: fromDate, to: toDate },
    userId,
  });

  console.log(`[navpro:kurs] backfill BI JISDOR ${fromDate}–${toDate}: ${inserted} rows`);

  return { inserted, from: fromDate, to: toDate, items: rows };
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

/** Sync all configured FX pairs (USD, EUR, SGD, …) — used by scheduler */
export async function syncAllExchangeRates({
  mode = 'scheduled',
  userId = null,
  userName = 'System',
  force = false,
} = {}) {
  const results = [];
  for (const currency of SUPPORTED_FX_CURRENCIES) {
    try {
      if (currency === 'USD') {
        results.push(await syncExchangeRate({ mode, userId, userName, force }));
      } else {
        results.push(await syncSecondaryCurrency({ currency, mode, userId, userName }));
      }
    } catch (e) {
      results.push({ currency, applied: false, error: e.message });
    }
  }
  return { results };
}

async function syncSecondaryCurrency({ currency, mode, userId, userName }) {
  const assumptions = await getLatestAssumptions();
  const masterKey = kursMasterKey(currency);
  const previousRate = Number(assumptions[masterKey]) || null;
  const rateDate = toWibDate();

  const fetched = await fetchCurrencyIdr(currency);
  const rate = validateExchangeRate(fetched.rate);

  if (ratesEqual(rate, previousRate)) {
    await logExchangeRateAttempt({
      rate,
      previousRate,
      source: fetched.source,
      syncMode: mode,
      rateDate,
      applied: false,
      errorMessage: 'unchanged',
      userId,
    });
    return { currency, applied: false, rate, reason: 'unchanged' };
  }

  const next = {
    ...assumptions,
    [masterKey]: rate,
    [`${masterKey}_source`]: fetched.source,
    [`${masterKey}_updated_at`]: new Date().toISOString(),
  };
  await saveAssumptions(next, { userId, userName });
  await upsertDailyRate({
    rate,
    source: fetched.source,
    syncMode: mode,
    currencyFrom: currency,
    userId,
  });
  await logExchangeRateAttempt({
    rate,
    previousRate,
    source: fetched.source,
    syncMode: mode,
    rateDate,
    applied: true,
    userId,
  });

  console.log(`[navpro:kurs] synced ${currency}/IDR ${previousRate ?? '—'} → ${rate} (${mode})`);
  return { currency, applied: true, rate, previous_rate: previousRate };
}
