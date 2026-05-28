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
import type { Project } from "@/types/navpro";
import { getProjectCapexTotal, getProjectKursUsd } from "@/lib/project-mappers";
import { formatCurrency } from "@/lib/format";

function sumOpexBaseline(p: Project): number {
  if (p.kpi?.opex_baseline_total != null && Number.isFinite(Number(p.kpi.opex_baseline_total))) {
    return Number(p.kpi.opex_baseline_total);
  }
  const kurs = getProjectKursUsd(p);
  return (p.opex || []).reduce((s, o) => {
    if (o.is_percent) return s;
    const amt = parseFloat(String(o.baseline_amount || 0));
    return s + (o.currency === "USD" ? amt * kurs : amt);
  }, 0);
}

function sumRevenueBaseline(p: Project): number {
  if (p.kpi?.revenue_baseline_total != null && Number.isFinite(Number(p.kpi.revenue_baseline_total))) {
    return Number(p.kpi.revenue_baseline_total);
  }
  const kurs = getProjectKursUsd(p);
  return (p.revenue || []).reduce((s, r) => {
    const h = parseFloat(String(r.harsat ?? r.monthly_amount ?? 0));
    const q = parseFloat(String(r.qty ?? 1));
    return s + (r.currency === "USD" ? h * q * kurs : h * q);
  }, 0);
}

export type CostRevenueChartType = "bar" | "line" | "pie";

export function CostRevenueChart({
  projects,
  type = "bar",
}: {
  projects: Project[];
  type?: CostRevenueChartType;
}) {
  const aggregate = {
    name: "Portofolio",
    CAPEX: projects.reduce((s, p) => s + getProjectCapexTotal(p), 0),
    OPEX: projects.reduce((s, p) => s + sumOpexBaseline(p), 0),
    Revenue: projects.reduce((s, p) => s + sumRevenueBaseline(p), 0),
  };

  const data = projects.length <= 6
    ? projects.map((p) => ({
        name: p.project_code.replace("NAVPRO-", ""),
        CAPEX: getProjectCapexTotal(p),
        OPEX: sumOpexBaseline(p),
        Revenue: sumRevenueBaseline(p),
      }))
    : [aggregate];

  const pieData =
    data.length === 1
      ? [
          { name: "CAPEX", value: data[0].CAPEX },
          { name: "OPEX", value: data[0].OPEX },
          { name: "Revenue", value: data[0].Revenue },
        ]
      : [
          { name: "CAPEX", value: aggregate.CAPEX },
          { name: "OPEX", value: aggregate.OPEX },
          { name: "Revenue", value: aggregate.Revenue },
        ];

  return (
    <ResponsiveContainer width="100%" height={260}>
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
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(v, true)} />
          <Tooltip formatter={(v) => formatCurrency(Number(v) || 0)} />
          <Legend />
          <Line type="monotone" dataKey="CAPEX" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="OPEX" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Revenue" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
        </LineChart>
      ) : (
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatCurrency(v, true)} />
          <Tooltip formatter={(v) => formatCurrency(Number(v) || 0)} />
          <Legend />
          <Bar dataKey="CAPEX" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="OPEX" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Revenue" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}
