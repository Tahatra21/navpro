-- Idempotent migration: USD exchange rate daily history + sync audit log
-- Run on VPS: psql "$DATABASE_URL" -f backend/sql/usd-exchange-rate.sql

CREATE TABLE IF NOT EXISTS usd_exchange_rate_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date DATE NOT NULL,
  currency_from VARCHAR(3) NOT NULL DEFAULT 'USD',
  currency_to VARCHAR(3) NOT NULL DEFAULT 'IDR',
  rate NUMERIC(14, 2) NOT NULL,
  previous_day_rate NUMERIC(14, 2),
  change_amount NUMERIC(14, 2),
  change_percent NUMERIC(8, 4),
  source VARCHAR(50) NOT NULL,
  sync_mode VARCHAR(20) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rate_date, currency_from, currency_to)
);

CREATE INDEX IF NOT EXISTS idx_usd_daily_rate_date
  ON usd_exchange_rate_daily (rate_date DESC);

CREATE TABLE IF NOT EXISTS exchange_rate_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_from VARCHAR(3) NOT NULL DEFAULT 'USD',
  currency_to VARCHAR(3) NOT NULL DEFAULT 'IDR',
  rate NUMERIC(14, 2),
  previous_rate NUMERIC(14, 2),
  source VARCHAR(50) NOT NULL,
  sync_mode VARCHAR(20) NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rate_date DATE NOT NULL,
  applied BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  raw_payload JSONB,
  triggered_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_exchange_rate_log_fetched
  ON exchange_rate_log (fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_exchange_rate_log_date
  ON exchange_rate_log (rate_date DESC);

-- Seed today's row from current assumptions if missing
INSERT INTO usd_exchange_rate_daily (rate_date, rate, source, sync_mode)
SELECT
  (NOW() AT TIME ZONE 'Asia/Jakarta')::date,
  (data->>'kurs_usd')::numeric,
  COALESCE(data->>'kurs_usd_source', 'manual'),
  'seed'
FROM assumptions_master
ORDER BY id DESC
LIMIT 1
ON CONFLICT (rate_date, currency_from, currency_to) DO NOTHING;
