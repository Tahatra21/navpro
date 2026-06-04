"use client";

import type { ProjectKpi } from "@/types/navpro";
import { ConclusionBadge } from "@/components/shared/ConclusionBadge";
import { buildKpiSummaryRows, KPI_LABELS } from "@/lib/kpi-display";

/** Ringkasan akhir kelima metrik kelayakan (P1 feedback #6). */
export function KpiFinalSummary({ kpi }: { kpi: ProjectKpi }) {
  const rows = buildKpiSummaryRows(kpi);

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/[0.04] overflow-hidden">
      <div className="px-4 py-3 border-b border-primary/15 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Ringkasan Hasil Kelayakan</p>
          <p className="text-xs text-muted-foreground">NPV, IRR, BCR, Payback, dan kesimpulan investasi</p>
        </div>
        <ConclusionBadge conclusion={kpi.conclusion} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-border/80">
        {rows.map((row) => (
          <div key={row.key} className="px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              {row.label}
            </p>
            <p
              className={`text-base font-bold tabular-nums ${
                row.key === "conclusion" ? "text-primary" : "text-foreground"
              }`}
            >
              {row.value}
            </p>
          </div>
        ))}
      </div>
      <p className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border/60 bg-muted/20">
        {KPI_LABELS.npv} dan {KPI_LABELS.irr} memakai tanggal arus kas aktual (metode XNPV/XIRR).
      </p>
    </div>
  );
}
