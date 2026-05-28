"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { navproApi } from "@/services/api";
import type { CalculationVersionSummary, Project } from "@/types/navpro";
import { ConclusionBadge } from "@/components/shared/ConclusionBadge";
import { formatDate, formatPercent } from "@/lib/format";
import { KpiCards } from "./KpiCards";
import { CashflowTable } from "./CashflowTable";

export function VersionHistory({
  projectId,
  versions,
}: {
  projectId: string;
  versions: CalculationVersionSummary[];
}) {
  const [loadingVer, setLoadingVer] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<{
    version: number;
    kpi?: Project["kpi"];
    cashflow?: Project["cashflow_monthly"];
  } | null>(null);
  const [error, setError] = useState("");

  const loadSnapshot = async (ver: number) => {
    setLoadingVer(ver);
    setError("");
    try {
      const { version } = await navproApi.getProjectVersionSnapshot(projectId, ver);
      setSnapshot({
        version: ver,
        kpi: version.result_snapshot?.kpi,
        cashflow: version.result_snapshot?.cashflow_monthly,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal memuat snapshot");
    } finally {
      setLoadingVer(null);
    }
  };

  if (!versions.length) {
    return <p className="text-sm text-muted-foreground">Belum ada versi kalkulasi.</p>;
  }

  return (
    <div className="space-y-4">
      <ul className="text-sm space-y-2">
        {versions.map((v) => (
          <li
            key={v.version_number}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 py-2"
          >
            <div>
              <span className="font-semibold">v{v.version_number}</span>
              <span className="text-muted-foreground ml-2">
                {v.duration_months} bln · {v.created_by_name || "—"} · {formatDate(v.created_at)}
              </span>
              <div className="mt-1 flex items-center gap-2">
                <ConclusionBadge conclusion={v.conclusion} />
                {v.xirr != null && (
                  <span className="text-xs font-mono">XIRR {formatPercent(v.xirr)}</span>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={loadingVer === v.version_number}
              onClick={() => loadSnapshot(v.version_number)}
            >
              {loadingVer === v.version_number ? "Memuat…" : "Load Snapshot"}
            </Button>
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {snapshot && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4">
          <h4 className="font-semibold text-sm">Snapshot Versi {snapshot.version}</h4>
          <KpiCards kpi={snapshot.kpi} />
          <CashflowTable periods={snapshot.cashflow || []} />
        </div>
      )}
    </div>
  );
}
