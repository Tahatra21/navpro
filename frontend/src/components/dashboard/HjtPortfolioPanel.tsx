"use client";

import Link from "next/link";
import {
  ArrowRight,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  TrendingUp,
  Link2,
  AlertTriangle,
  Layers,
} from "lucide-react";
import { DashboardStatCard } from "@/components/dashboard/DashboardStatCard";
import { buildHjtStatusPipeline } from "@/lib/dashboard-stats";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HjtDashboardSummary } from "@/types/hjt";

function HjtStatusPipeline({ distribution }: { distribution: Record<string, number> }) {
  const groups = buildHjtStatusPipeline(distribution);
  const total = groups.reduce((s, g) => s + g.count, 0);

  if (total === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Belum ada penawaran HJT.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/50">
        {groups.map((g) => (
          <div
            key={g.key}
            className={cn("h-full transition-all", g.color)}
            style={{ width: `${(g.count / total) * 100}%` }}
            title={`${g.label}: ${g.count}`}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-2">
        {groups.map((g) => (
          <li key={g.key} className="flex items-center gap-2 text-xs">
            <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", g.color)} />
            <span className="text-muted-foreground">{g.label}</span>
            <span className="font-bold text-foreground ml-auto tabular-nums">{g.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HjtPortfolioPanel({
  data,
  loading,
  executive,
}: {
  data?: HjtDashboardSummary;
  loading?: boolean;
  executive?: boolean;
}) {
  const kpi = data?.kpi;
  const approvedRate =
    kpi && kpi.total_quotations > 0
      ? `${Math.round((kpi.approved_count / kpi.total_quotations) * 100)}%`
      : "—";

  const stats = [
    {
      label: "Total Penawaran",
      value: kpi?.total_quotations ?? "—",
      sub: `${kpi?.draft_count ?? 0} draf · ${kpi?.rejected_count ?? 0} tidak layak`,
      icon: FileSpreadsheet,
      cardClass: "border-primary/20",
      iconClass: "text-primary bg-primary/10",
    },
    {
      label: "Disetujui",
      value: kpi?.approved_count ?? "—",
      sub: executive
        ? `${approvedRate} · ${kpi?.approved_value ? formatCurrency(kpi.approved_value, true) : "—"} nilai`
        : `${approvedRate} dari portofolio`,
      icon: CheckCircle2,
      cardClass: "border-emerald-500/20",
      iconClass: "text-emerald-700 bg-emerald-500/10",
    },
    {
      label: "Dalam Persetujuan",
      value: kpi?.pending_approval ?? "—",
      sub: "Menunggu keputusan approver",
      icon: Clock,
      cardClass: "border-amber-500/20",
      iconClass: "text-amber-700 bg-amber-500/10",
    },
    {
      label: executive ? "Nilai Pipeline" : "Rata-rata Margin",
      value: executive
        ? kpi?.pipeline_value
          ? formatCurrency(kpi.pipeline_value, true)
          : "—"
        : kpi?.avg_margin_percent != null
          ? formatPercent(kpi.avg_margin_percent)
          : "—",
      sub: executive
        ? "Diajukan + disetujui"
        : "Penawaran terkalkulasi",
      icon: TrendingUp,
      cardClass: "border-border",
      iconClass: "text-primary bg-primary/10",
      isText: true,
    },
  ];

  const modeDist = data?.mode_distribution || {};
  const modeTotal = (modeDist.standard || 0) + (modeDist.revenue_sharing || 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            HJT Connectivity
          </p>
          <h2 className="text-xl font-bold text-foreground">
            {executive ? "Portofolio Penawaran" : "Penawaran Saya"}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kalkulator harga layanan connectivity — terpisah dari KKF investasi
          </p>
        </div>
        <Link
          href="/hjt/quotations"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1 shrink-0"
        >
          Kelola penawaran <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat ringkasan HJT…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((s) => (
              <DashboardStatCard key={s.label} {...s} />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Pipeline
              </p>
              <h3 className="font-semibold text-foreground mb-4">Status Penawaran</h3>
              <HjtStatusPipeline distribution={data?.status_distribution || {}} />
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Skema
              </p>
              <h3 className="font-semibold text-foreground mb-4">Mode Kalkulasi</h3>
              {modeTotal === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">—</p>
              ) : (
                <ul className="space-y-3">
                  <li className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Layers className="h-4 w-4" /> Mode A (Standard)
                    </span>
                    <span className="font-bold tabular-nums">{modeDist.standard || 0}</span>
                  </li>
                  <li className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Mode B (Rev. Sharing)
                    </span>
                    <span className="font-bold tabular-nums">{modeDist.revenue_sharing || 0}</span>
                  </li>
                </ul>
              )}
              {executive && (kpi?.linked_kkf_count ?? 0) > 0 && (
                <p className="mt-4 text-xs text-muted-foreground flex items-center gap-1.5 border-t border-border/50 pt-3">
                  <Link2 className="h-3.5 w-3.5 text-primary" />
                  {kpi?.linked_kkf_count} penawaran sudah terhubung ke proyek KKF
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm flex flex-col">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                {executive ? "Wilayah" : "Insight"}
              </p>
              <h3 className="font-semibold text-foreground mb-4">
                {executive ? "Top Region" : "Ringkasan"}
              </h3>
              {executive ? (
                <ul className="space-y-2 flex-1">
                  {(data?.region_top || []).length === 0 ? (
                    <li className="text-sm text-muted-foreground">—</li>
                  ) : (
                    data?.region_top.map((r) => (
                      <li key={r.region_code} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{r.region_code}</span>
                        <span className="font-bold tabular-nums">{r.count}</span>
                      </li>
                    ))
                  )}
                </ul>
              ) : (
                <ul className="space-y-2 flex-1 text-sm">
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">Nilai disetujui</span>
                    <span className="font-bold tabular-nums">
                      {kpi?.approved_value ? formatCurrency(kpi.approved_value, true) : "—"}
                    </span>
                  </li>
                  {(kpi?.lastmile_risk_count ?? 0) > 0 && (
                    <li className="flex items-start gap-2 text-amber-800 bg-amber-500/10 rounded-lg px-3 py-2 mt-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span className="text-xs leading-snug">
                        {kpi?.lastmile_risk_count} penawaran dengan lastmile di bawah ambang BCR
                      </span>
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>

          {executive && (data?.top_by_value?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="font-semibold">Penawaran Terbesar (Pipeline Aktif)</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Diajukan & disetujui — urut nilai deal
                </p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Pelanggan</th>
                    <th className="px-4 py-2.5 font-medium">Region</th>
                    <th className="px-4 py-2.5 font-medium">Mode</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium text-right">Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.top_by_value.map((q) => (
                    <tr key={q.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <Link href={`/hjt/quotations/${q.id}`} className="text-primary hover:underline font-medium">
                          {q.customer_name || q.contract_no || "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{q.region_code || "—"}</td>
                      <td className="px-4 py-2.5 capitalize">{q.calc_mode?.replace("_", " ") || "—"}</td>
                      <td className="px-4 py-2.5 capitalize">{q.status}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                        {formatCurrency(q.deal_value, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!executive && (data?.recent_approved?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="font-semibold mb-3">Baru Disetujui</h3>
              <ul className="space-y-2">
                {data?.recent_approved.map((q) => (
                  <li key={q.id} className="flex justify-between items-center gap-2 text-sm border-b border-border/40 pb-2 last:border-0">
                    <Link href={`/hjt/quotations/${q.id}`} className="text-primary hover:underline truncate">
                      {q.customer_name || q.contract_no}
                    </Link>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {q.approved_at ? formatDate(q.approved_at) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
