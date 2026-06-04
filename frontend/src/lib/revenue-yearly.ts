import type { RevenueItem, RevenueMode } from "@/types/navpro";
import type { WizardRevenueRow } from "@/lib/project-mappers";

export type { RevenueMode };

export const REVENUE_MODE_LABELS: Record<RevenueMode, string> = {
  flat: "Flat (tarif tetap)",
  escalation: "Eskalasi % (bulanan)",
  step_yearly: "Step tahunan (Y1 / Y2 / …)",
};

export function normalizeRevenueMode(
  mode?: RevenueMode | string,
  row?: { harsatYear1?: number; harsatYear2?: number; escalation?: number }
): RevenueMode {
  if (mode === "flat" || mode === "escalation" || mode === "step_yearly") return mode;
  if (row?.harsatYear1 != null && row?.harsatYear2 != null && row.harsatYear1 !== row.harsatYear2) {
    return "step_yearly";
  }
  if ((row?.escalation ?? 0) > 0) return "escalation";
  return "flat";
}

export function yearlyHarsatSlots(durationMonths: number): number {
  return Math.max(1, Math.ceil(durationMonths / 12));
}

export function buildYearlyHarsatList(
  durationMonths: number,
  harsatYear1: number,
  harsatYear2: number,
  extraYears?: number[]
): number[] {
  const count = yearlyHarsatSlots(durationMonths);
  const years = [harsatYear1, harsatYear2, ...(extraYears ?? [])];
  while (years.length < count) {
    years.push(harsatYear2);
  }
  return years.slice(0, count);
}

export interface YearlyRevenuePreviewRow {
  year: number;
  startMonth: number;
  endMonth: number;
  months: number;
  harsatPerMonth: number;
  qty: number;
  monthlyTotal: number;
  yearTotal: number;
}

export function buildYearlyRevenuePreview(
  durationMonths: number,
  row: Pick<
    WizardRevenueRow,
    "revenueMode" | "harsat" | "harsatYear1" | "harsatYear2" | "harsatByYear" | "qty" | "escalation" | "startPeriod" | "endPeriod" | "currency"
  >,
  kursUsd = 16500
): YearlyRevenuePreviewRow[] {
  const mode = normalizeRevenueMode(row.revenueMode, row);
  const qty = row.qty || 1;
  const rate = row.currency === "USD" ? kursUsd : 1;
  const start = Math.max(1, row.startPeriod);
  const end = Math.min(durationMonths, row.endPeriod);

  if (mode !== "step_yearly") {
    const h = row.harsat * qty * rate;
    const esc = row.escalation / 100;
    const rows: YearlyRevenuePreviewRow[] = [];
    let y = 1;
    for (let m = start; m <= end; ) {
      const yStart = m;
      const yEnd = Math.min(end, y * 12);
      let total = 0;
      for (let mo = yStart; mo <= yEnd; mo++) {
        const factor = mode === "escalation" ? Math.pow(1 + esc, mo - start) : 1;
        total += h * factor;
      }
      rows.push({
        year: y,
        startMonth: yStart,
        endMonth: yEnd,
        months: yEnd - yStart + 1,
        harsatPerMonth: row.harsat,
        qty,
        monthlyTotal: h,
        yearTotal: Math.round(total),
      });
      y++;
      m = yEnd + 1;
      if (m > end) break;
    }
    return rows;
  }

  const years = buildYearlyHarsatList(
    durationMonths,
    row.harsatYear1,
    row.harsatYear2,
    row.harsatByYear
  );
  const esc = row.escalation / 100;
  const preview: YearlyRevenuePreviewRow[] = [];

  for (let y = 1; y <= years.length; y++) {
    const yStart = start + (y - 1) * 12;
    const yEnd = Math.min(end, yStart + 11);
    if (yStart > end) break;
    const harsat = years[y - 1] ?? years[years.length - 1];
    const monthlyBase = harsat * qty * rate;
    const segStart = yearSegmentStart(yStart, start);
    let total = 0;
    for (let mo = yStart; mo <= yEnd; mo++) {
      total += monthlyBase * Math.pow(1 + esc, mo - segStart);
    }
    preview.push({
      year: y,
      startMonth: yStart,
      endMonth: yEnd,
      months: yEnd - yStart + 1,
      harsatPerMonth: harsat,
      qty,
      monthlyTotal: monthlyBase,
      yearTotal: Math.round(total),
    });
    if (yEnd >= end) break;
  }
  return preview;
}

function yearSegmentStart(m: number, startPeriod: number): number {
  const offset = m - startPeriod;
  return startPeriod + Math.floor(offset / 12) * 12;
}

export function wizardRowToRevenueItem(row: WizardRevenueRow, durationMonths?: number): RevenueItem {
  const mode = normalizeRevenueMode(row.revenueMode, row);
  const dur = durationMonths ?? row.endPeriod;
  const years =
    mode === "step_yearly"
      ? buildYearlyHarsatList(dur, row.harsatYear1, row.harsatYear2, row.harsatByYear)
      : [];

  const item: RevenueItem = {
    name: row.serviceName,
    customer_name: row.customerName,
    location: row.location,
    harsat: mode === "step_yearly" ? row.harsatYear1 : row.harsat,
    qty: row.qty,
    monthly_amount: (mode === "step_yearly" ? row.harsatYear1 : row.harsat) * row.qty,
    escalation_rate: mode === "flat" ? 0 : row.escalation / 100,
    otc: row.otc,
    currency: row.currency,
    start_period: row.startPeriod,
    end_period: row.endPeriod,
    revenue_mode: mode,
  };

  if (mode === "step_yearly") {
    item.harsat_year_1 = row.harsatYear1;
    item.harsat_year_2 = row.harsatYear2;
    if (years.length > 2) item.harsat_by_year = years;
  }

  return item;
}

export function revenueItemToWizardRow(r: RevenueItem, durationMonths: number): Omit<WizardRevenueRow, "id"> {
  const mode = normalizeRevenueMode(r.revenue_mode as RevenueMode | undefined, {
    harsatYear1: r.harsat_year_1,
    harsatYear2: r.harsat_year_2,
    escalation: Number((r.escalation_rate ?? 0) * 100),
  });
  const y1 = Number(r.harsat_year_1 ?? r.harsat ?? r.monthly_amount ?? 0);
  const y2 = Number(r.harsat_year_2 ?? y1);
  const years = r.harsat_by_year?.map(Number) ?? buildYearlyHarsatList(durationMonths, y1, y2);

  return {
    serviceName: r.name,
    customerName: r.customer_name || "",
    location: r.location || "",
    harsat: Number(r.harsat ?? r.monthly_amount ?? y1),
    currency: (r.currency as "IDR" | "USD") || "IDR",
    qty: Number(r.qty ?? 1),
    otc: Number(r.otc ?? 0),
    escalation: mode === "flat" ? 0 : Number((r.escalation_rate ?? 0) * 100),
    startPeriod: r.start_period,
    endPeriod: r.end_period,
    revenueMode: mode,
    harsatYear1: y1,
    harsatYear2: y2,
    harsatByYear: mode === "step_yearly" ? years : undefined,
  };
}
