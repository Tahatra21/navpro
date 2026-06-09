export type ExchangeRateCurrent = {
  currency_pair: string;
  rate: number | null;
  source: string;
  updated_at: string | null;
  rate_date: string;
  auto_sync_enabled: boolean;
  previous_day_rate: number | null;
  change_amount: number | null;
  change_percent: number | null;
  pending_rate?: number | null;
  pending_delta_percent?: number | null;
  pending_at?: string | null;
  pending_source?: string | null;
  master_rates?: Record<string, number>;
  supported_currencies?: string[];
};

export type ExchangeRateHistoryItem = {
  rate_date: string;
  rate: number;
  previous_day_rate: number | null;
  change_amount: number | null;
  change_percent: number | null;
  source: string;
  recorded_at: string;
};

export type ExchangeRateHistoryResponse = {
  currency_pair: string;
  from: string;
  to: string;
  items: ExchangeRateHistoryItem[];
  summary: {
    count: number;
    min_rate: number | null;
    max_rate: number | null;
    latest_rate: number | null;
  };
};

export type ExchangeRateSyncLogItem = {
  id: string;
  rate: number | null;
  previous_rate: number | null;
  source: string;
  sync_mode: string;
  fetched_at: string;
  rate_date: string;
  applied: boolean;
  error_message: string | null;
};

export type ExchangeRateSyncResult = {
  applied: boolean;
  rate: number;
  previous_rate: number | null;
  source: string;
  rate_date: string;
  change_amount?: number | null;
  change_percent?: number | null;
  reason?: string;
  pending_approval?: boolean;
  delta_percent?: number;
};

export type ExchangeRateBackfillResult = {
  inserted: number;
  from: string;
  to: string;
  items: Array<{ rate_date: string; rate: number; source?: string }>;
};
