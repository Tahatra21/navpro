export function formatCurrency(value: number, compact = false): string {
  if (!Number.isFinite(value)) return "—";
  if (compact && Math.abs(value) >= 1_000_000_000) {
    return `Rp ${(value / 1_000_000_000).toFixed(1)}M`;
  }
  if (compact && Math.abs(value) >= 1_000_000) {
    return `Rp ${(value / 1_000_000).toFixed(1)}jt`;
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatPercentFromUi(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatPaybackMonths(months?: number | null): string {
  if (months == null || !Number.isFinite(months)) return "—";
  const rounded = Math.round(months * 10) / 10;
  return `${rounded.toLocaleString("id-ID", { maximumFractionDigits: 1 })} bln`;
}

export function formatDurationCategory(code?: string | null): string {
  const labels: Record<string, string> = {
    SHORT_TERM: "Jangka pendek",
    MID_TERM: "Jangka menengah",
    LONG_TERM: "Jangka panjang",
    EXTENDED: "Jangka sangat panjang",
    CUSTOM: "Kustom",
  };
  if (!code) return "—";
  return labels[code] || code.replace(/_/g, " ");
}

export function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
