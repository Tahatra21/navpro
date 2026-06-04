import type {
  CapexItem,
  OpexItem,
  Project,
  RevenueItem,
  TariffCalculatorSnapshot,
} from "@/types/navpro";
import type { RevenueMode } from "@/types/navpro";
import { revenueItemToWizardRow, wizardRowToRevenueItem } from "@/lib/revenue-yearly";

export interface WizardCapexRow {
  id: string;
  name: string;
  category: string;
  amount: number;
  currency: "IDR" | "USD";
  period: number;
}

export interface WizardOpexRow {
  id: string;
  name: string;
  category: string;
  type: "NOMINAL" | "PERCENT";
  amount: number;
  currency: "IDR" | "USD";
  startPeriod: number;
  endPeriod: number;
  catalogCode?: string;
  iconKey?: string;
  unit?: string;
}

export interface WizardRevenueRow {
  id: string;
  serviceName: string;
  customerName: string;
  location: string;
  harsat: number;
  currency: "IDR" | "USD";
  qty: number;
  otc: number;
  escalation: number;
  startPeriod: number;
  endPeriod: number;
  revenueMode: RevenueMode;
  harsatYear1: number;
  harsatYear2: number;
  harsatByYear?: number[];
}

const KURS_USD = 16500;

export function getProjectKursUsd(p: Project): number {
  if (p.kurs_usd_override != null && Number.isFinite(Number(p.kurs_usd_override))) {
    return Number(p.kurs_usd_override);
  }
  if (p.kpi?.kurs_usd_used != null && Number.isFinite(Number(p.kpi.kurs_usd_used))) {
    return Number(p.kpi.kurs_usd_used);
  }
  return KURS_USD;
}

export function getProjectCapexTotal(p: Project): number {
  if (p.kpi?.capex_total != null && Number.isFinite(Number(p.kpi.capex_total))) {
    return Number(p.kpi.capex_total);
  }
  const kurs = getProjectKursUsd(p);
  return (p.capex || []).reduce((sum, item) => {
    const amt = parseFloat(String(item.amount || 0));
    return sum + (item.currency === "USD" ? amt * kurs : amt);
  }, 0);
}

export function buildProjectPayload(input: {
  project_name: string;
  contract_start_date: string;
  project_duration_months: number;
  org_unit_id?: string;
  customer_name?: string;
  contract_number?: string;
  pic_sales?: string;
  wacc_override?: string;
  inflation_rate_override?: string;
  kurs_usd_override?: string;
  bcr_mandatory_override?: string;
  bcr_minimum_override?: string;
  capexRows: WizardCapexRow[];
  opexRows: WizardOpexRow[];
  revenueRows: WizardRevenueRow[];
  tariffCalculatorSnapshot?: TariffCalculatorSnapshot | null;
}): Partial<Project> {
  const capex: CapexItem[] = input.capexRows.map((r) => ({
    name: r.name,
    category: r.category,
    amount: r.amount,
    period: r.period,
    currency: r.currency,
  }));

  const opexMeta = (r: WizardOpexRow) => ({
    ...(r.catalogCode ? { catalog_code: r.catalogCode } : {}),
    ...(r.iconKey ? { icon_key: r.iconKey } : {}),
    ...(r.unit ? { unit: r.unit } : {}),
  });

  const opex: OpexItem[] = input.opexRows.map((r) => {
    if (r.type === "PERCENT") {
      return {
        name: r.name,
        category: r.category,
        is_percent: true,
        coefficient_rate: r.amount / 100,
        start_period: r.startPeriod,
        end_period: r.endPeriod,
        ...opexMeta(r),
      };
    }
    return {
      name: r.name,
      category: r.category,
      baseline_amount: r.amount,
      currency: r.currency,
      start_period: r.startPeriod,
      end_period: r.endPeriod,
      ...opexMeta(r),
    };
  });

  const revenue: RevenueItem[] = input.revenueRows.map((r) => wizardRowToRevenueItem(r));

  const payload: Partial<Project> = {
    project_name: input.project_name.trim(),
    contract_start_date: input.contract_start_date,
    project_duration_months: input.project_duration_months,
    org_unit_id: input.org_unit_id || undefined,
    customer_name: input.customer_name?.trim() || undefined,
    contract_number: input.contract_number?.trim() || undefined,
    pic_sales: input.pic_sales?.trim() || undefined,
    capex,
    opex,
    revenue,
    tariff_calculator_snapshot: input.tariffCalculatorSnapshot ?? undefined,
    status: "DRAFT",
  };

  if (input.wacc_override) {
    payload.wacc_override = parseFloat(input.wacc_override);
  }
  if (input.inflation_rate_override) {
    payload.inflation_rate_override = parseFloat(input.inflation_rate_override);
  }
  if (input.kurs_usd_override) {
    payload.kurs_usd_override = parseFloat(input.kurs_usd_override);
  }
  if (input.bcr_mandatory_override || input.bcr_minimum_override) {
    payload.bcr_threshold_override = {
      mandatory: input.bcr_mandatory_override
        ? parseFloat(input.bcr_mandatory_override)
        : 1.23,
      minimum: input.bcr_minimum_override ? parseFloat(input.bcr_minimum_override) : 1.08,
    };
  }

  return payload;
}

const uid = () => Math.random().toString(36).slice(2, 11);

export function projectToWizardState(project: Project) {
  return {
    orgUnitId: project.org_unit_id || "",
    projectCode: project.project_code,
    projectName: project.project_name,
    customer: project.customer_name || "",
    contractNo: project.contract_number || "",
    contractDate: project.contract_start_date,
    picSales: project.pic_sales || "",
    durationMonths: project.project_duration_months,
    waccOverride: project.wacc_override != null ? String(project.wacc_override) : "",
    inflationOverride:
      project.inflation_rate_override != null ? String(project.inflation_rate_override) : "",
    kursUsdOverride: project.kurs_usd_override != null ? String(project.kurs_usd_override) : "",
    bcrMandatory: project.bcr_threshold_override?.mandatory != null
      ? String(project.bcr_threshold_override.mandatory)
      : "",
    bcrMinimum: project.bcr_threshold_override?.minimum != null
      ? String(project.bcr_threshold_override.minimum)
      : "",
    capexRows: (project.capex || []).map((c) => ({
      id: uid(),
      name: c.name,
      category: c.category,
      amount: Number(c.amount),
      currency: (c.currency as "IDR" | "USD") || "IDR",
      period: c.period,
    })),
    opexRows: (project.opex || []).map((o) => ({
      id: uid(),
      name: o.name,
      category: o.category,
      type: o.is_percent ? ("PERCENT" as const) : ("NOMINAL" as const),
      amount: o.is_percent ? (o.coefficient_rate || 0) * 100 : Number(o.baseline_amount || 0),
      currency: (o.currency as "IDR" | "USD") || "IDR",
      startPeriod: o.start_period,
      endPeriod: o.end_period,
      catalogCode: o.catalog_code,
      iconKey: o.icon_key,
      unit: o.unit,
    })),
    revenueRows: (project.revenue || []).map((r) => ({
      id: uid(),
      ...revenueItemToWizardRow(r, project.project_duration_months),
    })),
    tariffSnapshot: project.tariff_calculator_snapshot ?? null,
  };
}
