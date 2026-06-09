export type FxCurrency = "IDR" | "USD" | "EUR" | "SGD";

export const FX_CURRENCIES: FxCurrency[] = ["USD", "EUR", "SGD"];

export function rateToIdr(currency: string | undefined, rates: Record<string, number>): number {
  const c = (currency || "IDR").toUpperCase();
  if (c === "IDR") return 1;
  const r = rates[c];
  if (Number.isFinite(r) && r > 0) return r;
  if (c === "USD" && Number.isFinite(rates.USD)) return rates.USD;
  return 1;
}

export function buildRatesFromAssumptions(
  assumptions: Record<string, unknown> | undefined,
  overrides: { kurs_usd_override?: number | null } = {}
): Record<string, number> {
  const a = assumptions || {};
  const rates: Record<string, number> = { IDR: 1 };
  if (overrides.kurs_usd_override != null) rates.USD = Number(overrides.kurs_usd_override);
  else if (a.kurs_usd != null) rates.USD = Number(a.kurs_usd);
  else rates.USD = 16500;
  if (a.kurs_eur != null) rates.EUR = Number(a.kurs_eur);
  else rates.EUR = 18000;
  if (a.kurs_sgd != null) rates.SGD = Number(a.kurs_sgd);
  else rates.SGD = 12500;
  return rates;
}

export type ExchangeRateSnapshot = {
  captured_at: string;
  effective_date: string;
  snapshot_type: string;
  items: Array<{
    currency: string;
    kurs_used: number | null;
    master_rate_at_submit: number | null;
    effective_date: string;
    historical_rate: number | null;
    historical_rate_date: string | null;
    historical_source: string | null;
  }>;
};
