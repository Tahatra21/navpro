"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RiskHeatmap } from "@/components/dashboard/RiskHeatmap";
import { CostRevenueChart, type CostRevenueChartType } from "@/components/dashboard/CostRevenueChart";
import { ApprovalQueueTable } from "@/components/dashboard/ApprovalQueueTable";
import { navproApi } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { canCreateProject, canViewApprovals } from "@/lib/rbac";
import { formatPercent } from "@/lib/format";
import type { User } from "@/types/navpro";

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s: { user: User | null }) => s.user);
  const backendOnline = useAuthStore((s: { backendOnline: boolean | null }) => s.backendOnline);
  const [chartType, setChartType] = useState<CostRevenueChartType>("bar");
  const [selected, setSelected] = useState<string[]>([]);
  const [approvalPageSize, setApprovalPageSize] = useState<number>(5);
  const [approvalPage, setApprovalPage] = useState<number>(1);

  const portfolio = useQuery({
    queryKey: ["portfolio"],
    queryFn: () => navproApi.getDashboardPortfolio(),
    enabled: backendOnline === true,
  });

  const approvalQueue = useQuery({
    queryKey: ["approval-queue"],
    queryFn: () => navproApi.getDashboardApprovalQueue(),
    enabled: backendOnline === true && canViewApprovals(user?.role),
  });

  const kpi = portfolio.data?.kpi;
  const projects = portfolio.data?.projects || [];
  const selectedProjects = useMemo(() => {
    const map = new Map(projects.map((p) => [p.id, p]));
    const picked = selected.map((id) => map.get(id)).filter(Boolean) as typeof projects;
    return picked.length > 0 ? picked : projects.slice(0, 6);
  }, [projects, selected]);
  const approvedRate =
    kpi && kpi.total_projects > 0
      ? `${Math.round((kpi.approved_count / kpi.total_projects) * 100)}%`
      : "—";

  const stats = [
    {
      label: "Total Proyek",
      value: kpi?.total_projects ?? 0,
      icon: FolderKanban,
      sub: "Terdaftar di NAVPRO",
      cardClass: "border-primary/20",
      iconClass: "text-primary bg-primary/10",
    },
    {
      label: "Disetujui Final",
      value: kpi?.approved_count ?? 0,
      icon: CheckCircle2,
      sub: `${approvedRate} • APPROVED_FINAL`,
      cardClass: "border-emerald-500/20",
      iconClass: "text-emerald-700 bg-emerald-500/10",
    },
    {
      label: "Dalam Persetujuan",
      value: kpi?.pending_approval ?? 0,
      icon: Clock,
      sub: "Submitted / Review / L1",
      cardClass: "border-amber-500/20",
      iconClass: "text-amber-700 bg-amber-500/10",
    },
    {
      label: "Rata-rata XIRR",
      value: kpi?.avg_xirr != null ? formatPercent(kpi.avg_xirr) : "—",
      icon: XCircle,
      sub: "Proyek disetujui final",
      cardClass: "border-border",
      iconClass: "text-muted-foreground bg-muted",
      isText: true,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">
            Your Compass for Viable Project
          </p>
          <h1 className="text-3xl font-bold text-foreground">Dashboard Portofolio</h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            Ikhtisar kelayakan finansial, risiko investasi, dan status persetujuan seluruh proyek di NAVPRO
          </p>
        </div>
        {canCreateProject(user?.role) && (
          <Button className="btn-navpro shrink-0" onClick={() => router.push("/projects/new")}>
            <Plus className="w-4 h-4 mr-2" />
            Proyek Baru
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={`rounded-xl border bg-card p-5 shadow-sm flex gap-4 ${stat.cardClass}`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${stat.iconClass}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                <p className={`font-bold text-foreground mt-0.5 ${stat.isText ? "text-xl" : "text-3xl"}`}>
                  {stat.value}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">{stat.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Analisis Risiko
          </p>
          <h3 className="font-semibold text-foreground mb-4">Matriks Risiko Portofolio</h3>
          {portfolio.isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat…</p>
          ) : (
            <RiskHeatmap projects={projects} />
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Analisis Finansial
          </p>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Agregat CAPEX, OPEX &amp; Revenue</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Toggle chart dan pilih hingga 6 proyek untuk compare
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as CostRevenueChartType)}
                className="h-9 px-3 rounded-md border border-input bg-background text-xs"
              >
                <option value="bar">Bar</option>
                <option value="line">Line</option>
                <option value="pie">Pie (agregat)</option>
              </select>
              <button
                type="button"
                className="text-[11px] text-muted-foreground hover:text-foreground underline"
                onClick={() => setSelected([])}
              >
                Reset
              </button>
            </div>
          </div>
          {portfolio.isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat…</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                {projects.slice(0, 12).map((p) => {
                  const active = selected.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelected((cur) => {
                          if (cur.includes(p.id)) return cur.filter((x) => x !== p.id);
                          if (cur.length >= 6) return cur;
                          return [...cur, p.id];
                        });
                      }}
                      className={`text-[11px] px-2 py-1 rounded border ${
                        active
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                      title={p.project_name}
                    >
                      {p.project_code.replace("NAVPRO-", "")}
                    </button>
                  );
                })}
              </div>
              <CostRevenueChart
                projects={chartType === "pie" ? projects : selectedProjects}
                type={chartType}
              />
            </>
          )}
        </div>
      </div>

      {canViewApprovals(user?.role) && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div>
                <h3 className="font-semibold text-lg">Antrian Persetujuan</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Proyek yang menunggu tindakan persetujuan Anda
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Per halaman</span>
                <select
                  value={String(approvalPageSize)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setApprovalPageSize(v);
                    setApprovalPage(1);
                  }}
                  className="h-9 px-3 rounded-md border border-input bg-background text-xs"
                >
                  {[5, 10, 20, 50].map((n) => (
                    <option key={n} value={String(n)}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {approvalQueue.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Memuat antrian…</p>
          ) : (
            <>
              {(() => {
                const items = approvalQueue.data?.items || [];
                const total = items.length;
                const pages = Math.max(1, Math.ceil(total / approvalPageSize));
                const page = Math.min(Math.max(1, approvalPage), pages);
                const start = (page - 1) * approvalPageSize;
                const sliced = items.slice(start, start + approvalPageSize);
                return (
                  <>
                    <ApprovalQueueTable items={sliced} compact />
                    <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-border">
                      <p className="text-xs text-muted-foreground">
                        Menampilkan {total === 0 ? 0 : start + 1}–{Math.min(start + approvalPageSize, total)} dari {total}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={page <= 1}
                          onClick={() => setApprovalPage((p) => Math.max(1, p - 1))}
                        >
                          Prev
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {page}/{pages}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={page >= pages}
                          onClick={() => setApprovalPage((p) => Math.min(pages, p + 1))}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
}
