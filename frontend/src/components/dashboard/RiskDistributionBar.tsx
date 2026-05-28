"use client";

import { cn } from "@/lib/utils";

const RISK_META = [
  { key: "LOW", label: "Rendah", className: "bg-emerald-500/80" },
  { key: "MEDIUM", label: "Sedang", className: "bg-amber-500/80" },
  { key: "HIGH", label: "Tinggi", className: "bg-destructive/80" },
] as const;

export function RiskDistributionBar({ distribution }: { distribution: Record<string, number> }) {
  const total = RISK_META.reduce((s, r) => s + (distribution[r.key] || 0), 0);
  if (total === 0) return null;

  return (
    <div className="space-y-2 pt-2 border-t border-border/60">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Risiko BCR (portofolio)
      </p>
      <div className="flex h-2 rounded-full overflow-hidden bg-muted/40">
        {RISK_META.map((r) => {
          const n = distribution[r.key] || 0;
          if (!n) return null;
          return (
            <div
              key={r.key}
              className={cn("h-full", r.className)}
              style={{ width: `${(n / total) * 100}%` }}
              title={`${r.label}: ${n}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        {RISK_META.map((r) => (
          <span key={r.key} className="inline-flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-full", r.className)} />
            {r.label} <strong className="text-foreground">{distribution[r.key] || 0}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
