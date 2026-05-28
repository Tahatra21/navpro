import type { Conclusion, ProjectKpi } from "@/types/navpro";
import { formatCurrency, formatPaybackMonths, formatPercent } from "@/lib/format";

const CONCLUSION_COPY: Record<Conclusion, string> = {
  LAYAK:
    "Arus kas diskonto dan rasio manfaat-biaya memenuhi ambang kelayakan yang berlaku.",
  BERSYARAT:
    "Secara finansial masih bisa diterima, tetapi ada indikator yang mendekati batas minimum — tinjau asumsi sebelum pengajuan final.",
  TIDAK_LAYAK:
    "Indikator utama belum memenuhi ambang kelayakan. Perbaiki struktur biaya/pendapatan atau asumsi sebelum diajukan.",
};

export function getConclusionExplanation(conclusion?: Conclusion | string): string {
  if (!conclusion) return "";
  return CONCLUSION_COPY[conclusion as Conclusion] || "";
}

export function buildExecutiveHeadline(kpi: ProjectKpi): string {
  const parts: string[] = [];
  if (kpi.xirr != null && Number.isFinite(kpi.xirr)) {
    parts.push(`imbal hasil tahunan (XIRR) ${formatPercent(kpi.xirr)}`);
  }
  if (kpi.payback_months != null && Number.isFinite(kpi.payback_months)) {
    parts.push(`estimasi balik modal ${formatPaybackMonths(kpi.payback_months)}`);
  }
  if (kpi.bcr != null && Number.isFinite(kpi.bcr)) {
    parts.push(`rasio manfaat-biaya (BCR) ${Number(kpi.bcr).toFixed(2)}`);
  }
  if (parts.length === 0) return "Hasil kalkulasi tersedia — tinjau metrik di samping untuk keputusan investasi.";
  return `Proyek ini menunjukkan ${parts.join(", ")}.`;
}

export type BcrVerdict = "pass" | "warn" | "fail" | "unknown";

export function getBcrVerdict(kpi: ProjectKpi): BcrVerdict {
  if (kpi.bcr == null || !Number.isFinite(kpi.bcr)) return "unknown";
  const mandatory = kpi.bcr_threshold_used?.mandatory;
  const minimum = kpi.bcr_threshold_used?.minimum;
  if (mandatory == null) return "unknown";
  if (kpi.bcr >= mandatory) return "pass";
  if (minimum != null && kpi.bcr >= minimum) return "warn";
  return "fail";
}

export const METRIC_HELP: Record<string, string> = {
  xirr: "Tingkat pengembalian tahunan dari arus kas proyek (lebih tinggi = lebih menarik).",
  xnpv: "Nilai bersih kini seluruh arus kas dalam Rupiah, dengan diskonto WACC.",
  bcr: "Total manfaat ÷ total biaya. Di atas ambang mandatory = memenuhi syarat kelayakan.",
  payback: "Perkiraan bulan hingga arus kas kumulatif kembali positif.",
  simple_roi: "Pengembalian sederhana tanpa diskonto — pelengkap, bukan dasar keputusan utama.",
};

/** Margin XIRR di atas WACC — indikator sensitivitas tanpa re-kalkulasi penuh */
export function buildSensitivityNote(kpi: ProjectKpi): string | null {
  if (kpi.xirr == null || kpi.wacc_used == null) return null;
  if (!Number.isFinite(kpi.xirr) || !Number.isFinite(kpi.wacc_used)) return null;

  const spreadPp = (kpi.xirr - kpi.wacc_used) * 100;
  if (spreadPp < 0) {
    return `XIRR di bawah WACC (${spreadPp.toFixed(1)} p.p.) — proyek tidak menutup biaya modal.`;
  }
  if (spreadPp < 2) {
    return `Spread XIRR–WACC hanya ${spreadPp.toFixed(1)} p.p. — sangat sensitif jika WACC naik ~1%.`;
  }
  if (spreadPp < 5) {
    return `Spread XIRR–WACC ${spreadPp.toFixed(1)} p.p. — cukup aman; simulasikan skenario WACC +1% sebelum final.`;
  }
  return `Spread XIRR–WACC ${spreadPp.toFixed(1)} p.p. — margin kelayakan finansial kuat.`;
}

/** Satu baris metrik — tanpa mengulang badge kelayakan */
export function buildCompactHeadline(kpi: ProjectKpi): string {
  const bits: string[] = [];
  if (kpi.xirr != null) bits.push(`XIRR ${formatPercent(kpi.xirr)}`);
  if (kpi.xnpv != null) bits.push(`XNPV ${formatCurrency(kpi.xnpv)}`);
  if (kpi.bcr != null) bits.push(`BCR ${Number(kpi.bcr).toFixed(2)}`);
  if (kpi.payback_months != null) bits.push(`payback ${formatPaybackMonths(kpi.payback_months)}`);
  return bits.join(" · ") || "—";
}
