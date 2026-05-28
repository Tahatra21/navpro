"use client";

import type { PortfolioResponse } from "@/types/navpro";
import { ConclusionBadge } from "@/components/shared/ConclusionBadge";
import { cn } from "@/lib/utils";

const ITEMS: { key: keyof PortfolioResponse["kpi"]["conclusion_counts"]; conclusion?: string }[] = [
  { key: "LAYAK", conclusion: "LAYAK" },
  { key: "BERSYARAT", conclusion: "BERSYARAT" },
  { key: "TIDAK_LAYAK", conclusion: "TIDAK_LAYAK" },
];

export function ConclusionOverview({
  counts,
  withKpi,
}: {
  counts: PortfolioResponse["kpi"]["conclusion_counts"];
  withKpi: number;
}) {
  const none = counts.NONE ?? 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {ITEMS.map(({ key, conclusion }) => (
          <div
            key={key}
            className={cn(
              "rounded-lg border px-2 py-3 text-center",
              key === "LAYAK" && "border-emerald-500/25 bg-emerald-500/[0.06]",
              key === "BERSYARAT" && "border-amber-500/30 bg-amber-500/[0.06]",
              key === "TIDAK_LAYAK" && "border-destructive/25 bg-destructive/[0.05]"
            )}
          >
            <div className="flex justify-center mb-1">
              <ConclusionBadge conclusion={conclusion} />
            </div>
            <p className="text-2xl font-bold tabular-nums text-foreground">{counts[key] ?? 0}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center leading-relaxed">
        Berdasarkan <strong className="text-foreground">{withKpi}</strong> proyek dengan hasil kalkulasi
        {none > 0 ? (
          <>
            {" "}
            · <span className="text-amber-700">{none} belum terklasifikasi</span>
          </>
        ) : null}
      </p>
    </div>
  );
}
