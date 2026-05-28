import type { PortfolioResponse, Project } from "@/types/navpro";
import { getProjectCapexTotal } from "@/lib/project-mappers";

const APPROVAL_STATUSES = new Set([
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED_L1",
  "IN_REVIEW_ASMAN",
  "IN_REVIEW_MANAGER",
]);

const APPROVED_STATUSES = new Set(["APPROVED", "APPROVED_FINAL"]);

export type StatusPipelineGroup = {
  key: string;
  label: string;
  count: number;
  color: string;
};

export function buildStatusPipeline(dist: Record<string, number>): StatusPipelineGroup[] {
  let draft = 0;
  let computed = 0;
  let approval = 0;
  let approved = 0;
  let rejected = 0;
  let other = 0;

  for (const [status, count] of Object.entries(dist)) {
    if (status === "DRAFT") draft += count;
    else if (status === "COMPUTED") computed += count;
    else if (APPROVAL_STATUSES.has(status)) approval += count;
    else if (APPROVED_STATUSES.has(status)) approved += count;
    else if (status === "REJECTED") rejected += count;
    else other += count;
  }

  const groups: StatusPipelineGroup[] = [
    { key: "draft", label: "Draf", count: draft, color: "bg-muted-foreground/70" },
    { key: "computed", label: "Terhitung", count: computed, color: "bg-primary/80" },
    { key: "approval", label: "Persetujuan", count: approval, color: "bg-amber-500/80" },
    { key: "approved", label: "Disetujui", count: approved, color: "bg-emerald-500/80" },
    { key: "rejected", label: "Ditolak", count: rejected, color: "bg-destructive/80" },
  ];
  if (other > 0) {
    groups.push({ key: "other", label: "Lainnya", count: other, color: "bg-border" });
  }
  return groups.filter((g) => g.count > 0);
}

/** Sembunyikan proyek uji/smoke dari ringkasan dashboard */
export function isDashboardNoiseProject(p: Project): boolean {
  const code = p.project_code || "";
  const name = (p.project_name || "").trim();
  if (/^SMOKE-/i.test(code)) return true;
  if (/^Smoke \d+$/i.test(name)) return true;
  if (/^Test Wizard$/i.test(name)) return true;
  return false;
}

/** Proyek terakhir diperbarui — untuk panel aktivitas dashboard */
export function buildRecentProjects(projects: Project[], limit = 6): Project[] {
  return [...projects]
    .filter((p) => !["ARCHIVED", "CANCELLED"].includes(p.status))
    .filter((p) => !isDashboardNoiseProject(p))
    .sort((a, b) => {
      const ta = new Date(a.updated_at || a.created_at || 0).getTime();
      const tb = new Date(b.updated_at || b.created_at || 0).getTime();
      return tb - ta;
    })
    .slice(0, limit);
}

export function portfolioHealthScore(kpi: PortfolioResponse["kpi"]): number {
  if (!kpi.total_projects) return 0;
  const layak = kpi.conclusion_counts?.LAYAK ?? 0;
  const withKpi = kpi.with_kpi_count || 1;
  const approvalRatio = kpi.pending_approval / Math.max(kpi.total_projects, 1);
  const layakRatio = layak / withKpi;
  const calcGap = (kpi.needs_calculation_count || 0) / Math.max(kpi.total_projects, 1);
  const score = layakRatio * 55 + (1 - approvalRatio * 0.5) * 25 + (1 - calcGap) * 20;
  return Math.round(Math.min(100, Math.max(0, score)));
}

export function sumPortfolioCapex(projects: Project[]): number {
  return projects.reduce((s, p) => s + getProjectCapexTotal(p), 0);
}
