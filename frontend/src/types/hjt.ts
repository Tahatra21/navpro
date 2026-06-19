export type HjtQuotationStatus = "draft" | "submitted" | "approved" | "rejected";
export type HjtCalcMode = "standard" | "revenue_sharing";

export type HjtRegion = {
  id: number;
  region_code: string;
  region_name: string;
  has_uplink?: boolean;
  is_route?: boolean;
};

export function formatHjtRegionLabel(r: HjtRegion): string {
  const name = r.region_name?.trim() || r.region_code;
  if (r.region_code && r.region_name && r.region_code !== r.region_name) {
    return `${r.region_code} — ${r.region_name}`;
  }
  return r.is_route ? `${name} (rute)` : name;
}

export type HjtProduct = {
  id: number;
  product_name: string;
  product_family: string;
  unit_default?: string;
};

export type HjtQuotationLine = {
  id: string;
  quotation_id: string;
  product_id: number;
  product_name?: string;
  product_family?: string;
  capacity: number;
  unit: string;
  qty: number;
  backbone?: number;
  uplink?: number;
  vas?: number;
  lastmile?: number;
  access?: number;
  tarif?: number;
  harga_dasar?: number;
  lastmile_bcr?: number;
  lastmile_feasible?: boolean;
  akses_existing?: boolean;
  sort_order?: number;
};

export type HjtOtherExpense = {
  id: string;
  quotation_id: string;
  item: string;
  harsat: number;
  jumlah: number;
  total: number;
};

export type HjtQuotation = {
  id: string;
  customer_name?: string;
  npwp?: string;
  contract_no?: string;
  contract_year?: number;
  region_id?: number;
  region_code?: string;
  scheme?: string;
  calc_mode: HjtCalcMode;
  duration_years?: number;
  status: HjtQuotationStatus;
  tariff_version_id?: string;
  total_per_month?: number;
  grand_total_hjt?: number;
  other_expense_total?: number;
  grand_total_all?: number;
  offer_floor?: number;
  offer_recommended?: number;
  harga_final?: number;
  floor_override_justification?: string;
  margin_percent?: number;
  linked_project_id?: string;
  current_approval_role?: string | null;
  calc_snapshot?: {
    mode?: HjtCalcMode;
    result?: {
      harga_negosiasi?: number;
      grand_total_net?: number;
      margin_hjt?: number;
      revenue_split?: {
        min_quot_final?: number;
        min_quot_normal?: number;
        share_icon?: number;
        share_kawasan?: number;
      };
      offer?: { floor: number; recommended: number };
    };
  } | string;
  discount_level?: string;
  target_irr?: number;
  disc_backbone?: number;
  disc_port?: number;
  margin_custom?: number;
  share_icon?: number;
  share_kawasan?: number;
  submitted_at?: string;
  approved_at?: string;
  rejected_at?: string;
  rejected_note?: string;
  created_by?: string;
  creator_name?: string;
  updated_at?: string;
};

export type HjtQuotationFull = {
  quotation: HjtQuotation;
  lines: HjtQuotationLine[];
  expenses: HjtOtherExpense[];
  region: HjtRegion | null;
};

export type HjtApprovalStep = {
  id: string;
  quotation_id: string;
  role_level: string;
  approver_id?: string;
  approver_name?: string;
  decision: "pending" | "approved" | "rejected";
  note?: string;
  decided_at?: string;
};

export type HjtDashboardSummary = {
  kpi: {
    total_quotations: number;
    approved_count: number;
    pending_approval: number;
    rejected_count: number;
    draft_count: number;
    approved_value: number;
    pipeline_value: number;
    avg_margin_percent: number | null;
    linked_kkf_count: number;
    lastmile_risk_count: number;
  };
  status_distribution: Record<string, number>;
  mode_distribution: Record<string, number>;
  region_top: { region_code: string; count: number }[];
  top_by_value: {
    id: string;
    customer_name?: string;
    contract_no?: string;
    status: string;
    calc_mode?: string;
    region_code?: string;
    deal_value: number;
    approved_at?: string;
    updated_at?: string;
  }[];
  recent_approved: {
    id: string;
    customer_name?: string;
    contract_no?: string;
    region_code?: string;
    deal_value: number;
    calc_mode?: string;
    approved_at?: string;
    linked_project_id?: string | null;
  }[];
};

export type HjtCalculateResult = {
  total_per_month?: number;
  grand_total_hjt?: number;
  other_expense_total?: number;
  grand_total_all?: number;
  grand_total?: number;
  grand_total_net?: number;
  offer?: { floor: number; recommended: number };
  margin?: { floor: number; recommended: number };
  tariff_version?: string;
  mode?: HjtCalcMode;
};

export type HjtLastmileResult = {
  irr?: number | string | null;
  npv?: number | string | null;
  bcr?: number | string | null;
  is_feasible?: boolean;
  recommended_lastmile?: number | string | null;
};
