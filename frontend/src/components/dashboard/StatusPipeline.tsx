"use client";

import { buildStatusPipeline } from "@/lib/dashboard-stats";
import { cn } from "@/lib/utils";

export function StatusPipeline({ distribution }: { distribution: Record<string, number> }) {
  const groups = buildStatusPipeline(distribution);
  const total = groups.reduce((s, g) => s + g.count, 0);

  if (total === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Belum ada proyek aktif.</p>;
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
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {groups.map((g) => (
          <li key={g.key} className="flex items-center gap-2 text-xs">
            <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", g.color)} />
            <span className="text-muted-foreground">{g.label}</span>
            <span className="font-bold text-foreground ml-auto tabular-nums">{g.count}</span>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-muted-foreground text-center">{total} proyek aktif dalam pipeline</p>
    </div>
  );
}
