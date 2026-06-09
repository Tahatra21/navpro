"use client";

import { useMemo } from "react";
import type { ExchangeRateHistoryItem } from "@/types/exchange-rate";
import { cn } from "@/lib/utils";

function fmtIdr(n: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y.slice(2)}`;
}

function fmtPct(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2).replace(".", ",")}%`;
}

function fmtChange(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${fmtIdr(n)}`;
}

function changeColor(n: number | null) {
  if (n == null || n === 0) return "text-muted-foreground";
  return n > 0 ? "text-emerald-600" : "text-red-600";
}

type Props = {
  items: ExchangeRateHistoryItem[];
  loading?: boolean;
};

export function UsdRateHistoryTable({ items, loading }: Props) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => b.rate_date.localeCompare(a.rate_date)),
    [items]
  );

  if (loading) {
    return (
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="animate-pulse space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 bg-muted/60 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border rounded-lg">
        Belum ada data historis kurs.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            <th className="px-4 py-3 font-semibold text-muted-foreground">Tanggal</th>
            <th className="px-4 py-3 font-semibold text-muted-foreground">Kurs (IDR)</th>
            <th className="px-4 py-3 font-semibold text-muted-foreground">Perubahan</th>
            <th className="px-4 py-3 font-semibold text-muted-foreground">%</th>
            <th className="px-4 py-3 font-semibold text-muted-foreground">Sumber</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.rate_date} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
              <td className="px-4 py-3 whitespace-nowrap">{fmtDate(row.rate_date)}</td>
              <td className="px-4 py-3 font-medium tabular-nums">{fmtIdr(row.rate)}</td>
              <td className={cn("px-4 py-3 tabular-nums", changeColor(row.change_amount))}>
                {fmtChange(row.change_amount)}
              </td>
              <td className={cn("px-4 py-3 tabular-nums", changeColor(row.change_amount))}>
                {fmtPct(row.change_percent)}
              </td>
              <td className="px-4 py-3 text-muted-foreground capitalize">{row.source.replace(/_/g, " ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function exportHistoryCsv(items: ExchangeRateHistoryItem[]) {
  const header = "rate_date,rate,change_amount,change_percent,source";
  const lines = items.map((r) =>
    [
      r.rate_date,
      r.rate,
      r.change_amount ?? "",
      r.change_percent ?? "",
      r.source,
    ].join(",")
  );
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kurs-usd-${items[0]?.rate_date || "export"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
