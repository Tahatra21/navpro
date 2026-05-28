"use client";

import type { ProjectKpi } from "@/types/navpro";
import { ConclusionBadge } from "@/components/shared/ConclusionBadge";
import { formatCurrency, formatPercent } from "@/lib/format";

export function KpiCards({ kpi }: { kpi?: ProjectKpi }) {
  if (!kpi) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Belum ada hasil kalkulasi. Jalankan kalkulasi dari wizard atau tombol Hitung Ulang.
      </p>
    );
  }

  const cards = [
    { label: "XNPV", value: formatCurrency(kpi.xnpv || 0) },
    { label: "XIRR (p.a.)", value: formatPercent(kpi.xirr || 0) },
    { label: "BCR / PI", value: kpi.bcr != null ? kpi.bcr.toFixed(4) : "—" },
    { label: "Payback", value: kpi.payback_months != null ? `${kpi.payback_months.toFixed(1)} bln` : "—" },
    {
      label: "Simple ROI",
      value: kpi.simple_roi != null ? formatPercent(kpi.simple_roi) : "—",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Kesimpulan:</span>
        <ConclusionBadge conclusion={kpi.conclusion} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
              {c.label}
            </p>
            <p className="text-xl font-bold text-foreground">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
