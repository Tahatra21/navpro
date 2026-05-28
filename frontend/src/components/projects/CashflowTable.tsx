"use client";

import type { CashflowPeriod } from "@/types/navpro";
import { formatCurrency, formatDate } from "@/lib/format";

export function CashflowTable({ periods }: { periods: CashflowPeriod[] }) {
  if (!periods?.length) {
    return <p className="text-sm text-muted-foreground">Tabel cashflow belum tersedia.</p>;
  }

  const sorted = [...periods].sort((a, b) => a.period_number - b.period_number);

  return (
    <div className="overflow-x-auto rounded-lg border border-border max-h-[420px]">
      <table className="w-full text-xs text-left">
        <thead className="sticky top-0 bg-muted/80 backdrop-blur border-b border-border z-10">
          <tr>
            <th className="px-3 py-2 font-semibold">Bln</th>
            <th className="px-3 py-2 font-semibold">Tanggal</th>
            <th className="px-3 py-2 font-semibold text-right">Revenue</th>
            <th className="px-3 py-2 font-semibold text-right">OTC</th>
            <th className="px-3 py-2 font-semibold text-right">OPEX</th>
            <th className="px-3 py-2 font-semibold text-right">CAPEX</th>
            <th className="px-3 py-2 font-semibold text-right">Net CF</th>
            <th className="px-3 py-2 font-semibold text-right">Kumulatif</th>
            <th className="px-3 py-2 font-semibold text-center">Aktif</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.period_number}
              className={`border-b border-border/40 ${row.active_flag === 0 ? "opacity-40" : ""}`}
            >
              <td className="px-3 py-2 font-mono">{row.period_number}</td>
              <td className="px-3 py-2">{formatDate(row.period_date)}</td>
              <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.revenue)}</td>
              <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.otc || 0)}</td>
              <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.opex)}</td>
              <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.capex)}</td>
              <td
                className={`px-3 py-2 text-right font-mono font-semibold ${
                  row.net_cashflow >= 0 ? "text-emerald-700" : "text-destructive"
                }`}
              >
                {formatCurrency(row.net_cashflow)}
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {formatCurrency(row.cumulative_cashflow ?? 0)}
              </td>
              <td className="px-3 py-2 text-center">{row.active_flag}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
