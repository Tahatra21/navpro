"use client";

import type { HjtApprovalStep } from "@/types/hjt";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  ASMAN: "Manager SA",
  MANAGER: "Manager Pemasaran",
  GM_SRM: "Senior Regional Manager",
};

export function HjtApprovalTimeline({
  steps,
  floorJustification,
}: {
  steps: HjtApprovalStep[];
  floorJustification?: string | null;
}) {
  if (!steps.length) {
    return <p className="text-sm text-muted-foreground">Belum ada riwayat approval.</p>;
  }

  return (
    <div className="space-y-4">
      {floorJustification ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Di bawah floor</p>
          <p className="mt-1">{floorJustification}</p>
        </div>
      ) : null}
      <ol className="space-y-3">
      {steps.map((s) => (
        <li key={s.id} className="flex gap-3 items-start">
          <span
            className={cn(
              "mt-1 h-2.5 w-2.5 rounded-full shrink-0",
              s.decision === "approved" && "bg-emerald-500",
              s.decision === "rejected" && "bg-destructive",
              s.decision === "pending" && "bg-amber-400"
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {ROLE_LABEL[s.role_level] || s.role_level}
              <span className="text-muted-foreground font-normal"> — {s.decision}</span>
            </p>
            {s.approver_name ? (
              <p className="text-xs text-muted-foreground">{s.approver_name}</p>
            ) : null}
            {s.note ? <p className="text-xs mt-1">{s.note}</p> : null}
            {s.decided_at ? (
              <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(s.decided_at)}</p>
            ) : null}
          </div>
        </li>
      ))}
      </ol>
    </div>
  );
}
