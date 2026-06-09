"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ExchangeRateHistoryItem } from "@/types/exchange-rate";

function fmtIdr(v: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(v);
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}`;
}

type Props = {
  items: ExchangeRateHistoryItem[];
  loading?: boolean;
};

export function UsdRateChart({ items, loading }: Props) {
  if (loading) {
    return <div className="h-[220px] animate-pulse bg-muted/40 rounded-lg" />;
  }

  const data = [...items]
    .sort((a, b) => a.rate_date.localeCompare(b.rate_date))
    .map((r) => ({
      label: fmtDate(r.rate_date),
      rate: r.rate,
    }));

  if (data.length < 2) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border rounded-lg">
        Grafik membutuhkan minimal 2 titik data.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis
          tick={{ fontSize: 10 }}
          domain={["auto", "auto"]}
          tickFormatter={(v) => fmtIdr(Number(v))}
        />
        <Tooltip formatter={(v) => [`Rp ${fmtIdr(Number(v))}`, "Kurs"]} />
        <Line
          type="monotone"
          dataKey="rate"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ r: 2 }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
