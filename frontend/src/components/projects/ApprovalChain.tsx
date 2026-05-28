"use client";

import type { ApprovalNode, Project } from "@/types/navpro";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

function nodeClass(status: string, active: boolean, rejected: boolean) {
  if (rejected) return "border-destructive/40 bg-destructive/5";
  if (status.includes("APPROVED") || status === "COMPLETED") return "border-emerald-500/40 bg-emerald-500/5";
  if (active) return "border-primary/40 bg-primary/5";
  return "border-border bg-muted/20 opacity-70";
}

export function ApprovalChain({ project }: { project: Project }) {
  const chain = project.approval_chain || [];
  const submit = chain.find((c) => c.level === "SUBMIT");
  const manager = chain.find((c) => c.level === "MANAGER");
  const gm = chain.find((c) => c.level === "GM_SRM");

  const nodes: Array<{
    title: string;
    subtitle: string;
    node?: ApprovalNode;
    statusLabel: string;
    active: boolean;
    rejected: boolean;
  }> = [
    {
      title: "Solution Architect (Draft & Hitung)",
      subtitle: "Pengusul KKF",
      node: submit,
      statusLabel: submit ? "SUBMITTED" : project.status === "DRAFT" ? "DRAFT" : "—",
      active: false,
      rejected: false,
    },
    {
      title: "Manager Keuangan (Review L1)",
      subtitle: "SLA: 2 hari kerja",
      node: manager,
      statusLabel: manager?.status || (["SUBMITTED", "UNDER_REVIEW"].includes(project.status) ? "PENDING" : "WAITING"),
      active: ["SUBMITTED", "UNDER_REVIEW"].includes(project.status),
      rejected: manager?.status === "REJECTED" || (project.status === "REJECTED" && !gm),
    },
    {
      title: "GM / SRM (Persetujuan Final)",
      subtitle: "SLA: 1 hari kerja",
      node: gm,
      statusLabel: gm?.status || (project.status === "APPROVED_L1" ? "PENDING" : project.status === "APPROVED_FINAL" ? "APPROVED FINAL" : "WAITING"),
      active: project.status === "APPROVED_L1",
      rejected: gm?.status === "REJECTED",
    },
  ];

  return (
    <div className="space-y-3">
      {nodes.map((n, i) => (
        <div key={i} className={cn("relative pl-6 pb-4 border-l-2 last:border-l-0 last:pb-0", i < nodes.length - 1 ? "border-border" : "border-transparent")}>
          <div className={cn("absolute left-0 top-1 w-3 h-3 rounded-full -translate-x-[7px] border-2 bg-card", n.rejected ? "border-destructive" : n.active ? "border-primary" : "border-muted-foreground")} />
          <div className={cn("rounded-lg border p-4", nodeClass(n.statusLabel, n.active, n.rejected))}>
            <div className="flex justify-between gap-2 mb-1">
              <span className="font-semibold text-sm text-foreground">{n.title}</span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{n.statusLabel}</span>
            </div>
            <p className="text-xs text-muted-foreground">{n.subtitle}</p>
            {n.node?.user && <p className="text-xs mt-1">Oleh: {n.node.user}</p>}
            {n.node?.decided_at && (
              <p className="text-xs text-muted-foreground">{formatDateTime(n.node.decided_at)}</p>
            )}
            {n.node?.comment && (
              <p className="text-xs mt-2 italic border-l-2 border-primary/30 pl-2">&ldquo;{n.node.comment}&rdquo;</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
