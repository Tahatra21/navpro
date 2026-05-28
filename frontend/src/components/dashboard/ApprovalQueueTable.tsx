"use client";

import Link from "next/link";
import type { ApprovalQueueItem } from "@/types/navpro";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ApprovalQueueTable({
  items,
  compact = false,
}: {
  items: ApprovalQueueItem[];
  compact?: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Tidak ada proyek menunggu persetujuan.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Kode</th>
            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Nama Proyek</th>
            {!compact && (
              <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Pengusul</th>
            )}
            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Durasi</th>
            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">SLA Due</th>
            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.project_id} className="border-b border-border/50 hover:bg-accent/30">
              <td className="px-4 py-3 font-mono text-xs font-semibold">{it.project_code}</td>
              <td className="px-4 py-3 font-medium">{it.project_name}</td>
              {!compact && (
                <td className="px-4 py-3 text-muted-foreground">{it.created_by_name || "—"}</td>
              )}
              <td className="px-4 py-3">{it.duration_months} bln</td>
              <td className="px-4 py-3">
                <StatusBadge status={it.status} />
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "text-xs font-medium",
                    it.sla_overdue ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {it.sla_due_at ? formatDateTime(it.sla_due_at) : "—"}
                  {it.sla_overdue && " (Overdue)"}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/projects/${it.project_id}`}>Review</Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
