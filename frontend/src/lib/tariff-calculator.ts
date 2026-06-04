import type { RevenueMode } from "@/types/navpro";
import type { WizardRevenueRow } from "@/lib/project-mappers";
import { buildYearlyHarsatList } from "@/lib/revenue-yearly";

export type TariffSla = "standard" | "premium" | "platinum";

export interface TariffPackage {
  id: string;
  label: string;
  pricing: "per_mbps" | "flat";
  ratePerMbps?: number;
  flatMonthly?: number;
  minMbps: number;
  maxMbps: number;
  defaultOtc: number;
}

export const SLA_MULTIPLIERS: Record<TariffSla, number> = {
  standard: 1,
  premium: 1.15,
  platinum: 1.3,
};

export const SLA_LABELS: Record<TariffSla, string> = {
  standard: "Standard (99.5%)",
  premium: "Premium (99.9%)",
  platinum: "Platinum (99.99%)",
};

/** Katalog paket komersial — dasar kalkulator tarif (dapat diperluas ke master data). */
export const TARIFF_PACKAGES: TariffPackage[] = [
  {
    id: "dia",
    label: "Dedicated Internet (DIA)",
    pricing: "per_mbps",
    ratePerMbps: 850_000,
    minMbps: 10,
    maxMbps: 10_000,
    defaultOtc: 5_000_000,
  },
  {
    id: "mpls",
    label: "MPLS / SD-WAN",
    pricing: "per_mbps",
    ratePerMbps: 1_200_000,
    minMbps: 5,
    maxMbps: 5_000,
    defaultOtc: 10_000_000,
  },
  {
    id: "ftth_biz",
    label: "FTTH Business",
    pricing: "flat",
    flatMonthly: 3_500_000,
    minMbps: 50,
    maxMbps: 1000,
    defaultOtc: 2_500_000,
  },
  {
    id: "ip_transit",
    label: "IP Transit",
    pricing: "per_mbps",
    ratePerMbps: 650_000,
    minMbps: 100,
    maxMbps: 40_000,
    defaultOtc: 0,
  },
];

export interface TariffCommercialParams {
  packageId: string;
  bandwidthMbps: number;
  sla: TariffSla;
  discountPercent: number;
  qty: number;
  currency: "IDR" | "USD";
  /** null = pakai OTC default paket */
  otcOverride: number | null;
  revenueMode: RevenueMode;
  escalationPercent: number;
  /** Kenaikan tarif tahun 2 untuk mode step (%) */
  year2UpliftPercent: number;
  location: string;
}

export interface TariffPriceBreakdown {
  listPriceMonthly: number;
  slaMultiplier: number;
  afterSla: number;
  discountPercent: number;
  netMonthlyYear1: number;
  netMonthlyYear2: number | null;
  otc: number;
  formulaSummary: string;
}

export interface TariffCalculatorSnapshot {
  calculated_at: string;
  params: TariffCommercialParams;
  breakdown: TariffPriceBreakdown;
  lines_count: number;
}

const uid = () => Math.random().toString(36).slice(2, 11);

export function defaultTariffParams(durationMonths: number): TariffCommercialParams {
  return {
    packageId: "dia",
    bandwidthMbps: 100,
    sla: "standard",
    discountPercent: 0,
    qty: 1,
    currency: "IDR",
    otcOverride: null,
    revenueMode: durationMonths > 12 ? "step_yearly" : "escalation",
    escalationPercent: 0,
    year2UpliftPercent: 10,
    location: "",
  };
}

export function getTariffPackage(id: string): TariffPackage | undefined {
  return TARIFF_PACKAGES.find((p) => p.id === id);
}

export function clampBandwidth(pkg: TariffPackage, mbps: number): number {
  return Math.min(pkg.maxMbps, Math.max(pkg.minMbps, mbps));
}

export function computeListPriceMonthly(pkg: TariffPackage, bandwidthMbps: number): number {
  if (pkg.pricing === "flat") return pkg.flatMonthly ?? 0;
  return Math.round((pkg.ratePerMbps ?? 0) * bandwidthMbps);
}

export function computeTariffBreakdown(
  params: TariffCommercialParams
): { breakdown: TariffPriceBreakdown; pkg: TariffPackage } | { error: string } {
  const pkg = getTariffPackage(params.packageId);
  if (!pkg) return { error: "Paket tidak dikenali" };

  const mbps = clampBandwidth(pkg, params.bandwidthMbps);
  const list = computeListPriceMonthly(pkg, mbps);
  const slaMult = SLA_MULTIPLIERS[params.sla];
  const afterSla = Math.round(list * slaMult);
  const disc = Math.max(0, Math.min(100, params.discountPercent));
  const netY1 = Math.round(afterSla * (1 - disc / 100));
  const uplift = Math.max(0, params.year2UpliftPercent);
  const netY2 =
    params.revenueMode === "step_yearly" ? Math.round(netY1 * (1 + uplift / 100)) : null;
  const otc =
    params.otcOverride != null && params.otcOverride >= 0
      ? params.otcOverride
      : pkg.defaultOtc;

  const formulaSummary =
    pkg.pricing === "per_mbps"
      ? `${mbps} Mbps × Rp ${(pkg.ratePerMbps ?? 0).toLocaleString("id-ID")} × SLA ${slaMult} × diskon ${disc}%`
      : `Tarif flat Rp ${(pkg.flatMonthly ?? 0).toLocaleString("id-ID")} × SLA ${slaMult} × diskon ${disc}%`;

  return {
    pkg,
    breakdown: {
      listPriceMonthly: list,
      slaMultiplier: slaMult,
      afterSla,
      discountPercent: disc,
      netMonthlyYear1: netY1,
      netMonthlyYear2: netY2,
      otc,
      formulaSummary,
    },
  };
}

export function buildRevenueRowsFromTariff(
  params: TariffCommercialParams,
  durationMonths: number,
  customerName: string
): { rows: WizardRevenueRow[]; breakdown: TariffPriceBreakdown; snapshot: TariffCalculatorSnapshot } | { error: string } {
  const result = computeTariffBreakdown(params);
  if ("error" in result) return result;

  const { breakdown, pkg } = result;
  const mbps = clampBandwidth(pkg, params.bandwidthMbps);
  const serviceName = `${pkg.label} — ${mbps} Mbps (${SLA_LABELS[params.sla].split(" (")[0]})`;
  const mode = params.revenueMode;
  const harsatY1 = breakdown.netMonthlyYear1;
  const harsatY2 = breakdown.netMonthlyYear2 ?? harsatY1;

  const row: WizardRevenueRow = {
    id: uid(),
    serviceName,
    customerName: customerName.trim(),
    location: params.location.trim(),
    currency: params.currency,
    qty: Math.max(1, params.qty),
    otc: breakdown.otc,
    escalation: mode === "flat" ? 0 : params.escalationPercent,
    startPeriod: 1,
    endPeriod: durationMonths,
    revenueMode: mode,
    harsat: mode === "step_yearly" ? harsatY1 : harsatY1,
    harsatYear1: harsatY1,
    harsatYear2: harsatY2,
    harsatByYear:
      mode === "step_yearly"
        ? buildYearlyHarsatList(durationMonths, harsatY1, harsatY2)
        : undefined,
  };

  const snapshot: TariffCalculatorSnapshot = {
    calculated_at: new Date().toISOString(),
    params: { ...params, bandwidthMbps: mbps },
    breakdown,
    lines_count: 1,
  };

  return { rows: [row], breakdown, snapshot };
}
