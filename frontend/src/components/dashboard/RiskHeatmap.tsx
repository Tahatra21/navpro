"use client";

import type { Project } from "@/types/navpro";
import { getProjectCapexTotal } from "@/lib/project-mappers";
import { cn } from "@/lib/utils";

type Severity = "HIGH" | "MEDIUM" | "LOW";
type Likelihood = "HIGH" | "MEDIUM" | "LOW";

function getSeverity(p: Project): Severity {
  const capex = getProjectCapexTotal(p);
  if (capex < 100_000_000) return "LOW";
  if (capex < 500_000_000) return "MEDIUM";
  return "HIGH";
}

function getLikelihood(p: Project): Likelihood {
  if (!p.kpi) return "LOW";
  const bcr = p.kpi.bcr || 0;
  const xirr = p.kpi.xirr || 0;
  const wacc = p.kpi.wacc_used || 0.0972;
  if (bcr >= 1.23 && xirr >= wacc) return "LOW";
  if (bcr < 1.08 || xirr < wacc - 0.02 || p.status === "REJECTED") return "HIGH";
  return "MEDIUM";
}

const RISK_CLASS: Record<Severity, Record<Likelihood, string>> = {
  HIGH: {
    LOW: "bg-amber-200/80 hover:bg-amber-300/90",
    MEDIUM: "bg-orange-300/80 hover:bg-orange-400/90",
    HIGH: "bg-red-400/90 hover:bg-red-500 text-white",
  },
  MEDIUM: {
    LOW: "bg-emerald-200/70 hover:bg-emerald-300/80",
    MEDIUM: "bg-amber-200/80 hover:bg-amber-300/90",
    HIGH: "bg-orange-300/80 hover:bg-orange-400/90",
  },
  LOW: {
    LOW: "bg-emerald-100/80 hover:bg-emerald-200/90",
    MEDIUM: "bg-emerald-200/70 hover:bg-emerald-300/80",
    HIGH: "bg-amber-200/80 hover:bg-amber-300/90",
  },
};

const SEVERITY_ROWS: { key: Severity; label: string }[] = [
  { key: "HIGH", label: "Tinggi (≥500M)" },
  { key: "MEDIUM", label: "Sedang (100M–500M)" },
  { key: "LOW", label: "Rendah (<100M)" },
];

const LIKELIHOOD_COLS: { key: Likelihood; label: string }[] = [
  { key: "LOW", label: "Rendah" },
  { key: "MEDIUM", label: "Sedang" },
  { key: "HIGH", label: "Tinggi" },
];

export function RiskHeatmap({ projects }: { projects: Project[] }) {
  const grid: Record<Severity, Record<Likelihood, Project[]>> = {
    HIGH: { LOW: [], MEDIUM: [], HIGH: [] },
    MEDIUM: { LOW: [], MEDIUM: [], HIGH: [] },
    LOW: { LOW: [], MEDIUM: [], HIGH: [] },
  };

  projects.forEach((p) => {
    const s = getSeverity(p);
    const l = getLikelihood(p);
    grid[s][l].push(p);
  });

  return (
    <div className="space-y-2">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="w-8" />
            <th className="w-28" />
            {LIKELIHOOD_COLS.map((c) => (
              <th key={c.key} className="pb-2 font-semibold text-muted-foreground text-center">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SEVERITY_ROWS.map((row, idx) => (
            <tr key={row.key}>
              {idx === 0 && (
                <td
                  rowSpan={3}
                  className="align-middle text-[10px] font-bold text-muted-foreground writing-mode-vertical rotate-180 text-center w-6"
                  style={{ writingMode: "vertical-rl" }}
                >
                  Dampak
                </td>
              )}
              <td className="pr-2 py-1 text-muted-foreground font-medium text-[10px]">{row.label}</td>
              {LIKELIHOOD_COLS.map((col) => {
                const count = grid[row.key][col.key].length;
                return (
                  <td key={col.key} className="p-1">
                    <div
                      className={cn(
                        "rounded-lg h-14 flex items-center justify-center font-bold transition-colors cursor-default",
                        RISK_CLASS[row.key][col.key],
                        count === 0 && "opacity-50"
                      )}
                      title={
                        count > 0
                          ? grid[row.key][col.key].map((p) => p.project_code).join(", ")
                          : "Tidak ada proyek"
                      }
                    >
                      {count}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-center text-[10px] text-muted-foreground font-semibold">
        Kemungkinan Risiko (Likelihood)
      </p>
    </div>
  );
}
