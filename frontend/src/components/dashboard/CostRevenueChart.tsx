"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FinancialChartRow } from "@/lib/portfolio-org-financial";
import { formatCurrency } from "@/lib/format";

export type CostRevenueChartType = "bar" | "line" | "pie";

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; payload?: FinancialChartRow }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const fullName = payload[0]?.payload?.fullName;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground mb-1">{fullName || label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(Number(p.value) || 0)}
        </p>
      ))}
    </div>
  );
}

export function CostRevenueChart({
  rows,
  type = "bar",
}: {
  rows: FinancialChartRow[];
  type?: CostRevenueChartType;
}) {
  const data =
    rows.length > 0
      ? rows
      : [{ name: "—", fullName: "Tidak ada data", CAPEX: 0, OPEX: 0, Revenue: 0 }];

  const aggregate = {
    CAPEX: data.reduce((s, r) => s + r.CAPEX, 0),
    OPEX: data.reduce((s, r) => s + r.OPEX, 0),
    Revenue: data.reduce((s, r) => s + r.Revenue, 0),
  };

  const pieData = [
    { name: "CAPEX", value: aggregate.CAPEX },
    { name: "OPEX", value: aggregate.OPEX },
    { name: "Revenue", value: aggregate.Revenue },
  ];

  return (
    <ResponsiveContainer width="100%" height={280}>
      {type === "pie" ? (
        <PieChart>
          <Tooltip formatter={(v) => formatCurrency(Number(v) || 0)} />
          <Legend />
          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
            <Cell fill="var(--chart-1)" />
            <Cell fill="var(--chart-4)" />
            <Cell fill="var(--chart-3)" />
          </Pie>
        </PieChart>
      ) : type === "line" ? (
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={56} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(v, true)} />
          <Tooltip content={<ChartTooltip />} />
          <Legend />
          <Line type="monotone" dataKey="CAPEX" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="OPEX" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Revenue" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
        </LineChart>
      ) : (
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={56} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(v, true)} />
          <Tooltip content={<ChartTooltip />} />
          <Legend />
          <Bar dataKey="CAPEX" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="OPEX" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Revenue" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}
