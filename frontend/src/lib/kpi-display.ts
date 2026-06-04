import type { Conclusion, ProjectKpi } from "@/types/navpro";
import { formatCurrency, formatPaybackMonths, formatPercent } from "@/lib/format";

/** Label bisnis selaras feedback #6 — alias NPV/IRR dengan istilah teknis. */
export const KPI_LABELS = {
  npv: "NPV (XNPV)",
  irr: "IRR (XIRR)",
  bcr: "BCR",
  payback: "Payback (Balik Modal)",
  conclusion: "Kesimpulan Kelayakan",
} as const;

/** Tampilan eksekutif sederhana: Layak vs Tidak Layak. */
export function getSimpleLayakLabel(conclusion?: Conclusion | string): "Layak" | "Layak Bersyarat" | "Tidak Layak" | "—" {
  if (!conclusion) return "—";
  if (conclusion === "LAYAK") return "Layak";
  if (conclusion === "BERSYARAT" || conclusion === "MARGINAL") return "Layak Bersyarat";
  return "Tidak Layak";
}

export type KpiSummaryRow = { key: string; label: string; value: string };

/** Kelima output akhir yang diminta stakeholder (feedback #6). */
export function buildKpiSummaryRows(kpi: ProjectKpi): KpiSummaryRow[] {
  return [
    {
      key: "npv",
      label: KPI_LABELS.npv,
      value: kpi.xnpv != null ? formatCurrency(kpi.xnpv) : "—",
    },
    {
      key: "irr",
      label: KPI_LABELS.irr,
      value: kpi.xirr != null ? formatPercent(kpi.xirr) : "—",
    },
    {
      key: "bcr",
      label: KPI_LABELS.bcr,
      value: kpi.bcr != null ? Number(kpi.bcr).toFixed(4) : "—",
    },
    {
      key: "payback",
      label: KPI_LABELS.payback,
      value: formatPaybackMonths(kpi.payback_months),
    },
    {
      key: "conclusion",
      label: KPI_LABELS.conclusion,
      value: getSimpleLayakLabel(kpi.conclusion),
    },
  ];
}
