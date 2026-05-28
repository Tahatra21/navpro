"use client";

import { useQuery } from "@tanstack/react-query";
import { navproApi } from "@/services/api";
import { formatDateTime } from "@/lib/format";

export function ProjectAuditLog({
  projectId,
  compact = false,
}: {
  projectId: string;
  compact?: boolean;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["project-audit", projectId],
    queryFn: () => navproApi.getProjectAuditLogs(projectId),
  });

  const logs = data?.logs || [];

  if (isLoading) return <p className="text-sm text-muted-foreground">Memuat audit log…</p>;
  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada aktivitas tercatat.</p>;
  }

  if (compact) {
    return (
      <ul className="text-sm space-y-2 max-h-[min(22rem,50vh)] overflow-y-auto pr-1">
        {logs.map((log) => (
          <li key={log.id} className="border-b border-border/50 py-2 last:border-0 space-y-0.5">
            <p className="text-[10px] text-muted-foreground">{formatDateTime(log.created_at)}</p>
            <p className="text-xs font-medium">{log.user_name || "—"}</p>
            <p className="text-[10px] font-mono text-primary">{log.action}</p>
            <p className="text-xs text-muted-foreground break-words leading-snug">
              {log.new_val || log.old_val || "—"}
            </p>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="text-sm space-y-2">
      {logs.map((log) => (
        <li key={log.id} className="flex gap-3 border-b border-border/50 py-2 last:border-0">
          <span className="text-muted-foreground text-xs whitespace-nowrap w-28">
            {formatDateTime(log.created_at)}
          </span>
          <span className="font-medium w-24 shrink-0">{log.user_name || "—"}</span>
          <span className="text-xs font-mono text-primary w-28 shrink-0">{log.action}</span>
          <span className="text-muted-foreground truncate">{log.new_val || log.old_val || "—"}</span>
        </li>
      ))}
    </ul>
  );
}
