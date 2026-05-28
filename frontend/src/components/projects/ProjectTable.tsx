"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import type { Project } from "@/types/navpro";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConclusionBadge } from "@/components/shared/ConclusionBadge";
import { formatPercent } from "@/lib/format";

export function ProjectTable({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-10">
        Belum ada proyek. Buat proyek KKF baru untuk memulai.
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
            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Pelanggan</th>
            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Durasi</th>
            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Kesimpulan</th>
            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">XIRR</th>
            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} className="border-b border-border/50 hover:bg-accent/30">
              <td className="px-4 py-3 font-mono text-xs font-semibold">{p.project_code}</td>
              <td className="px-4 py-3">
                <Link
                  href={`/projects/${p.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {p.project_name}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{p.customer_name || "—"}</td>
              <td className="px-4 py-3">{p.project_duration_months} bln</td>
              <td className="px-4 py-3">
                <StatusBadge status={p.status} />
              </td>
              <td className="px-4 py-3">
                <ConclusionBadge conclusion={p.kpi?.conclusion} />
              </td>
              <td className="px-4 py-3 font-mono text-xs">
                {p.kpi?.xirr != null ? formatPercent(p.kpi.xirr) : "—"}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/projects/${p.id}`}
                  className="inline-flex p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md"
                  title="Lihat Detail"
                >
                  <Eye size={16} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
