"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  TrendingUp,
  FileEdit,
  Calculator,
  Banknote,
  Activity,
  ListChecks,
  ArrowRight,
  FileSpreadsheet,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RiskDistributionBar } from "@/components/dashboard/RiskDistributionBar";
import { RevenueVsCostByOrg } from "@/components/dashboard/RevenueVsCostByOrg";
import { ApprovalQueueTable } from "@/components/dashboard/ApprovalQueueTable";
import { StatusPipeline } from "@/components/dashboard/StatusPipeline";
import { ConclusionOverview } from "@/components/dashboard/ConclusionOverview";
import { DashboardStatCard } from "@/components/dashboard/DashboardStatCard";
import { HjtPortfolioPanel } from "@/components/dashboard/HjtPortfolioPanel";
import { navproApi } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import {
  canViewApprovals,
  canViewHjtQuotations,
  isExecutiveDashboardRole,
  usesV2ApprovalsQueue,
} from "@/lib/rbac";
import { mapV2QueueToItems } from "@/lib/approval-queue";
import { portfolioHealthScore } from "@/lib/dashboard-stats";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { PortfolioResponse, User } from "@/types/navpro";

const EMPTY_CONCLUSION = { LAYAK: 0, BERSYARAT: 0, TIDAK_LAYAK: 0, NONE: 0 };

export default function DashboardPage() {
  const user = useAuthStore((s: { user: User | null }) => s.user);
  const backendOnline = useAuthStore((s: { backendOnline: boolean | null }) => s.backendOnline);
  const [approvalPageSize, setApprovalPageSize] = useState<number>(5);
  const [approvalPage, setApprovalPage] = useState<number>(1);

  const executive = isExecutiveDashboardRole(user?.role);
  const showHjt = canViewHjtQuotations(user?.role);

  const portfolio = useQuery({
    queryKey: ["portfolio"],
    queryFn: () => navproApi.getDashboardPortfolio(),
    enabled: backendOnline === true,
  });

  const hjtSummary = useQuery({
    queryKey: ["dashboard-hjt-summary"],
    queryFn: () => navproApi.getDashboardHjtSummary(),
    enabled: backendOnline === true && showHjt,
  });

  const useV2Queue = usesV2ApprovalsQueue(user?.role);

  const approvalSummary = useQuery({
    queryKey: ["approvals-queue-summary"],
    queryFn: () => navproApi.getApprovalsQueueSummary(),
    enabled: backendOnline === true && canViewApprovals(user?.role) && useV2Queue,
  });

  const approvalQueueV2 = useQuery({
    queryKey: ["approvals-queue-v2"],
    queryFn: () => navproApi.getApprovalsQueue(),
    enabled: backendOnline === true && canViewApprovals(user?.role) && useV2Queue,
  });

  const approvalQueueLegacy = useQuery({
    queryKey: ["approval-queue"],
    queryFn: () => navproApi.getDashboardApprovalQueue(),
    enabled: backendOnline === true && canViewApprovals(user?.role) && !useV2Queue,
  });

  const approvalItems = useV2Queue
    ? mapV2QueueToItems(approvalQueueV2.data?.items || [])
    : approvalQueueLegacy.data?.items || [];
  const approvalQueueLoading = useV2Queue ? approvalQueueV2.isLoading : approvalQueueLegacy.isLoading;

  const projects = portfolio.data?.projects || [];
  const statusDist = portfolio.data?.status_distribution || {};
  const riskDist = portfolio.data?.risk_distribution || {};

  const kpi = useMemo((): PortfolioResponse["kpi"] => {
    const raw = portfolio.data?.kpi;
    const withKpi = projects.filter((p) => p.kpi?.xirr != null && Number.isFinite(Number(p.kpi.xirr)));
    const needsCalc = projects.filter(
      (p) =>
        ["DRAFT", "COMPUTED"].includes(p.status) &&
        (p.kpi?.xirr == null || !Number.isFinite(Number(p.kpi.xirr)))
    );
    const conclusionFallback = { ...EMPTY_CONCLUSION };
    for (const p of withKpi) {
      const c = p.kpi?.conclusion;
      if (c === "LAYAK" || c === "BERSYARAT" || c === "TIDAK_LAYAK") conclusionFallback[c] += 1;
      else conclusionFallback.NONE += 1;
    }
    return {
      total_projects: raw?.total_projects ?? projects.length,
      approved_count: raw?.approved_count ?? 0,
      pending_approval: raw?.pending_approval ?? 0,
      draft_count: raw?.draft_count ?? projects.filter((p) => p.status === "DRAFT").length,
      computed_count: raw?.computed_count ?? projects.filter((p) => p.status === "COMPUTED").length,
      rejected_count: raw?.rejected_count ?? projects.filter((p) => p.status === "REJECTED").length,
      with_kpi_count: raw?.with_kpi_count ?? withKpi.length,
      needs_calculation_count: raw?.needs_calculation_count ?? needsCalc.length,
      avg_xirr: raw?.avg_xirr ?? 0,
      total_xnpv: raw?.total_xnpv ?? 0,
      total_capex: raw?.total_capex ?? 0,
      total_revenue: raw?.total_revenue ?? 0,
      total_opex: raw?.total_opex ?? 0,
      conclusion_counts: raw?.conclusion_counts ?? conclusionFallback,
    };
  }, [portfolio.data?.kpi, projects]);

  const hjtKpi = hjtSummary.data?.kpi;
  const healthScore = portfolioHealthScore(kpi);

  const approvedRate =
    kpi.total_projects > 0 ? `${Math.round((kpi.approved_count / kpi.total_projects) * 100)}%` : "—";

  const overdueCount = approvalItems.filter((i) => i.sla_overdue).length;
  const pendingSummary = approvalSummary.data?.summary;
  const combinedPending = kpi.pending_approval + (hjtKpi?.pending_approval ?? 0);

  const primaryStats = [
    {
      label: "Total Proyek Aktif",
      value: kpi.total_projects,
      sub: `${kpi.with_kpi_count} sudah terkalkulasi`,
      icon: FolderKanban,
      cardClass: "border-primary/20",
      iconClass: "text-primary bg-primary/10",
    },
    {
      label: "Disetujui",
      value: kpi.approved_count,
      sub: `${approvedRate} dari portofolio`,
      icon: CheckCircle2,
      cardClass: "border-emerald-500/20",
      iconClass: "text-emerald-700 bg-emerald-500/10",
    },
    {
      label: "Dalam Persetujuan",
      value: kpi.pending_approval,
      sub: useV2Queue && pendingSummary
        ? `ASMAN ${pendingSummary.asman_count} · Manager ${pendingSummary.manager_count}`
        : "Menunggu tindakan approver",
      icon: Clock,
      cardClass: "border-amber-500/20",
      iconClass: "text-amber-700 bg-amber-500/10",
    },
    {
      label: "Rata-rata XIRR",
      value: kpi.with_kpi_count > 0 && kpi.avg_xirr ? formatPercent(kpi.avg_xirr) : "—",
      sub: `dari ${kpi.with_kpi_count} proyek terhitung`,
      icon: TrendingUp,
      cardClass: "border-border",
      iconClass: "text-primary bg-primary/10",
      isText: true,
    },
  ];

  const secondaryStats = [
    {
      label: "Total XNPV",
      value: kpi.total_xnpv ? formatCurrency(kpi.total_xnpv, true) : "—",
      sub: "Agregat proyek terkalkulasi",
      icon: Banknote,
      iconClass: "text-foreground bg-muted",
      isText: true,
    },
    {
      label: "Total CAPEX",
      value: kpi.total_capex ? formatCurrency(kpi.total_capex, true) : "—",
      sub: "Portofolio aktif",
      icon: Activity,
      iconClass: "text-foreground bg-muted",
      isText: true,
    },
    {
      label: "Perlu Kalkulasi",
      value: kpi.needs_calculation_count,
      sub: `${kpi.draft_count} draf · ${kpi.computed_count} terhitung`,
      icon: Calculator,
      iconClass: "text-amber-700 bg-amber-500/10",
    },
    {
      label: "Ditolak",
      value: kpi.rejected_count,
      sub: "Perlu revisi & submit ulang",
      icon: FileEdit,
      iconClass: "text-destructive bg-destructive/10",
    },
  ];

  const executiveSnapshot = executive && showHjt ? [
    {
      label: "KKF Investasi",
      value: kpi.total_projects,
      sub: `${kpi.approved_count} disetujui · XIRR ${kpi.with_kpi_count > 0 && kpi.avg_xirr ? formatPercent(kpi.avg_xirr) : "—"}`,
      icon: FolderKanban,
      cardClass: "border-primary/25 bg-primary/[0.02]",
      iconClass: "text-primary bg-primary/10",
    },
    {
      label: "HJT Penawaran",
      value: hjtKpi?.total_quotations ?? "—",
      sub: `${hjtKpi?.approved_count ?? 0} disetujui · ${hjtKpi?.pending_approval ?? 0} pending`,
      icon: FileSpreadsheet,
      cardClass: "border-violet-500/25 bg-violet-500/[0.02]",
      iconClass: "text-violet-700 bg-violet-500/10",
    },
    {
      label: "Nilai HJT Disetujui",
      value: hjtKpi?.approved_value ? formatCurrency(hjtKpi.approved_value, true) : "—",
      sub: hjtKpi?.linked_kkf_count ? `${hjtKpi.linked_kkf_count} sudah jadi proyek KKF` : "Belum terhubung KKF",
      icon: Scale,
      cardClass: "border-emerald-500/25 bg-emerald-500/[0.02]",
      iconClass: "text-emerald-700 bg-emerald-500/10",
      isText: true,
    },
    {
      label: "Menunggu Keputusan",
      value: combinedPending,
      sub: `KKF ${kpi.pending_approval} · HJT ${hjtKpi?.pending_approval ?? 0}`,
      icon: Clock,
      cardClass: "border-amber-500/25 bg-amber-500/[0.02]",
      iconClass: "text-amber-700 bg-amber-500/10",
    },
  ] : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Your Compass for Viable Project
          </p>
          <h1 className="text-3xl font-bold text-foreground">
            {executive
              ? "Dashboard Eksekutif"
              : user?.full_name
                ? `Halo, ${user.full_name.split(" ")[0]}`
                : "Dashboard Portofolio"}
          </h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            {executive
              ? "Ikhtisar portofolio KKF investasi dan penawaran HJT connectivity — untuk pengambilan keputusan tingkat direksi."
              : "Ikhtisar kelayakan finansial, pipeline persetujuan, dan risiko investasi proyek Anda di NAVPRO."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-center min-w-[88px]">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Health KKF
            </p>
            <p className="text-2xl font-bold text-primary tabular-nums leading-none mt-0.5">{healthScore}</p>
          </div>
          {canViewApprovals(user?.role) && overdueCount > 0 && (
            <Link
              href="/approvals"
              className="inline-flex items-center rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive font-medium hover:bg-destructive/10"
            >
              {overdueCount} SLA terlambat
            </Link>
          )}
        </div>
      </div>

      {executiveSnapshot && !portfolio.isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {executiveSnapshot.map((s) => (
            <DashboardStatCard key={s.label} {...s} />
          ))}
        </div>
      )}

      {portfolio.isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat portofolio…</p>
      ) : (
        <>
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  KKF Investasi
                </p>
                <h2 className="text-xl font-bold text-foreground">Portofolio Proyek</h2>
              </div>
              <Link
                href="/projects"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1 shrink-0"
              >
                Kelola proyek <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {primaryStats.map((s) => (
                <DashboardStatCard key={s.label} {...s} />
              ))}
            </div>
            {!executive && (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {secondaryStats.map((s) => (
                  <DashboardStatCard key={s.label} {...s} />
                ))}
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Pipeline
                </p>
                <h3 className="font-semibold text-foreground mb-4">Status Proyek</h3>
                <StatusPipeline distribution={statusDist} />
                <RiskDistributionBar distribution={riskDist} />
              </div>

              <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Kelayakan
                </p>
                <h3 className="font-semibold text-foreground mb-4">Distribusi Kesimpulan</h3>
                <ConclusionOverview counts={kpi.conclusion_counts} withKpi={kpi.with_kpi_count} />
              </div>

              <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-1 flex flex-col">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Volume
                </p>
                <h3 className="font-semibold text-foreground mb-4">Agregat Finansial</h3>
                <ul className="space-y-3 flex-1">
                  <li className="flex justify-between items-baseline gap-2 border-b border-border/50 pb-2">
                    <span className="text-sm text-muted-foreground">Pendapatan (lifetime)</span>
                    <span className="text-sm font-bold tabular-nums">
                      {kpi.total_revenue ? formatCurrency(kpi.total_revenue, true) : "—"}
                    </span>
                  </li>
                  <li className="flex justify-between items-baseline gap-2 border-b border-border/50 pb-2">
                    <span className="text-sm text-muted-foreground">OPEX (lifetime)</span>
                    <span className="text-sm font-bold tabular-nums">
                      {kpi.total_opex ? formatCurrency(kpi.total_opex, true) : "—"}
                    </span>
                  </li>
                  <li className="flex justify-between items-baseline gap-2">
                    <span className="text-sm text-muted-foreground">CAPEX</span>
                    <span className="text-sm font-bold tabular-nums">
                      {kpi.total_capex ? formatCurrency(kpi.total_capex, true) : "—"}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {executive && (
            <RevenueVsCostByOrg
              orgFinancial={portfolio.data?.org_financial}
              projects={projects}
              projectCount={projects.length}
              loading={portfolio.isLoading}
            />
          )}
        </>
      )}

      {showHjt && (
        <HjtPortfolioPanel
          data={hjtSummary.data}
          loading={hjtSummary.isLoading}
          executive={executive}
        />
      )}

      {!executive && portfolio.data && (
        <RevenueVsCostByOrg
          orgFinancial={portfolio.data?.org_financial}
          projects={projects}
          projectCount={projects.length}
          loading={portfolio.isLoading}
        />
      )}

      {canViewApprovals(user?.role) && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Antrian Persetujuan KKF</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {approvalItems.length} item menunggu
                {overdueCount > 0 ? ` · ${overdueCount} melewati SLA` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/approvals">
                <Button variant="outline" size="sm">
                  Buka halaman antrian
                </Button>
              </Link>
              <span className="text-[11px] text-muted-foreground">Per halaman</span>
              <select
                value={String(approvalPageSize)}
                onChange={(e) => {
                  setApprovalPageSize(Number(e.target.value));
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
          {approvalQueueLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Memuat antrian…</p>
          ) : (
            <>
              {(() => {
                const items = approvalItems;
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
                        Menampilkan {total === 0 ? 0 : start + 1}–{Math.min(start + approvalPageSize, total)}{" "}
                        dari {total}
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
