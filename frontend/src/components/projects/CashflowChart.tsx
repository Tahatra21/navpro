"use client";

import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import type { CashflowPeriod } from "@/types/navpro";
import { formatCurrency } from "@/lib/format";

export function CashflowChart({ periods }: { periods: CashflowPeriod[] }) {
  if (!periods?.length) return null;

  const data = [...periods]
    .sort((a, b) => a.period_number - b.period_number)
    .map((p) => ({
      name: `M${p.period_number}`,
      kumulatif: p.cumulative_cashflow ?? 0,
      net: p.net_cashflow,
    }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(v, true)} />
        <Tooltip formatter={(v) => formatCurrency(Number(v))} />
        <Legend />
        <Line type="monotone" dataKey="kumulatif" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="net" stroke="var(--chart-3)" strokeWidth={1} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
