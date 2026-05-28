export type UserRole =
  | "SUPER_ADMIN"
  | "FINANCE_ADMIN"
  | "VP_SA"
  | "MANAGER"
  | "ASMAN"
  | "STAFF"
  | "SA"
  | "GM_SRM"
  | "VIEWER";

export type ProjectStatus =
  | "DRAFT"
  | "COMPUTED"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "IN_REVIEW_ASMAN"
  | "IN_REVIEW_MANAGER"
  | "APPROVED"
  | "APPROVED_L1"
  | "APPROVED_FINAL"
  | "REJECTED"
  | "ARCHIVED"
  | "CANCELLED";

export type Conclusion = "LAYAK" | "BERSYARAT" | "TIDAK_LAYAK";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  employee_id?: string | null;
  org_unit_id?: string | null;
  org_level?: string | null;
  org_unit_code?: string | null;
  org_unit_name?: string | null;
  org_unit_type?: string | null;
  org_unit_segment?: string | null;
}

export interface ProjectKpi {
  xirr?: number;
  xnpv?: number;
  bcr?: number;
  payback_months?: number;
  simple_roi?: number;
  conclusion?: Conclusion;
  wacc_used?: number;
  inflation_used?: number;
  kurs_usd_used?: number;
  capex_total?: number;
  opex_baseline_total?: number;
  lifetime_revenue_total?: number;
  lifetime_opex_total?: number;
  revenue_baseline_total?: number;
  bcr_threshold_used?: { mandatory: number; minimum: number };
}

export interface CashflowPeriod {
  period_number: number;
  period_date: string;
  revenue: number;
  otc?: number;
  opex: number;
  capex: number;
  net_cashflow: number;
  cumulative_cashflow?: number;
  active_flag: number;
}

export interface ApprovalNode {
  level: string;
  status?: string;
  decided_at?: string;
  user?: string;
  comment?: string;
}

export interface Project {
  id: string;
  project_code: string;
  project_name: string;
  status: ProjectStatus;
  project_duration_months: number;
  duration_category?: string;
  contract_start_date: string;
  wacc_override?: number | null;
  inflation_rate_override?: number | null;
  kurs_usd_override?: number | null;
  bcr_threshold_override?: { mandatory: number; minimum: number } | null;
  created_by?: string;
  org_unit_id?: string | null;
  segment?: string | null;
  created_at?: string;
  updated_at?: string;
  customer_name?: string;
  contract_number?: string;
  pic_sales?: string;
  capex?: CapexItem[];
  opex?: OpexItem[];
  revenue?: RevenueItem[];
  otc_amount?: number;
  approval_chain?: ApprovalNode[];
  versions?: CalculationVersionSummary[];
  cashflow_monthly?: CashflowPeriod[];
  kpi?: ProjectKpi;
}

export interface CapexItem {
  name: string;
  category: string;
  amount: number;
  period: number;
  currency?: "IDR" | "USD";
}

export interface OpexItem {
  name: string;
  category: string;
  baseline_amount?: number;
  is_percent?: boolean;
  coefficient_rate?: number;
  start_period: number;
  end_period: number;
  currency?: "IDR" | "USD";
}

export interface RevenueItem {
  name: string;
  monthly_amount?: number;
  harsat?: number;
  qty?: number;
  escalation_rate?: number;
  start_period: number;
  end_period: number;
  otc?: number;
  customer_name?: string;
  location?: string;
  currency?: "IDR" | "USD";
}

export interface CalculationVersionSummary {
  version_number: number;
  duration_months: number;
  created_at: string;
  created_by_name?: string;
  xirr?: number;
  xnpv?: number;
  bcr?: number;
  conclusion?: Conclusion;
}

export interface PortfolioTopProject {
  id: string;
  project_code: string;
  project_name: string;
  status: string;
  xirr?: number | null;
  xnpv?: number | null;
  bcr?: number | null;
  conclusion?: Conclusion | null;
}

export interface PortfolioResponse {
  kpi: {
    total_projects: number;
    approved_count: number;
    pending_approval: number;
    draft_count: number;
    computed_count: number;
    rejected_count: number;
    with_kpi_count: number;
    needs_calculation_count: number;
    avg_xirr: number;
    total_xnpv: number;
    total_capex: number;
    total_revenue: number;
    total_opex: number;
    conclusion_counts: {
      LAYAK: number;
      BERSYARAT: number;
      TIDAK_LAYAK: number;
      NONE: number;
    };
  };
  top_by_xirr?: PortfolioTopProject[];
  risk_distribution: Record<string, number>;
  status_distribution: Record<string, number>;
  org_financial?: {
    pusat: PortfolioOrgFinancialUnit[];
    sbu: PortfolioOrgFinancialUnit[];
  };
  projects: Project[];
}

export interface PortfolioOrgFinancialUnit {
  id: string;
  code: string;
  name: string;
  type: string;
  project_count: number;
  capex: number;
  opex: number;
  revenue: number;
  cost: number;
}

export interface ApprovalQueueItem {
  project_id: string;
  project_code: string;
  project_name: string;
  status: ProjectStatus | string;
  duration_months?: number;
  created_by_name?: string;
  sla_due_at?: string | null;
  sla_overdue?: boolean;
  /** V2 workflow fields (optional) */
  step_id?: string;
  step_order?: number;
  approver_level?: "ASMAN" | "MANAGER";
  step_status?: string;
  segment?: string | null;
}

/** Raw item from GET /api/v1/approvals/queue */
export interface ApprovalsQueueV2Item {
  step_id: string;
  project_id: string;
  step_order: number;
  approver_level: "ASMAN" | "MANAGER";
  step_status: string;
  due_at?: string | null;
  project_code: string;
  project_name: string;
  project_status: string;
  segment?: string | null;
  org_unit_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body?: string;
  project_id?: string;
  is_read: boolean;
  created_at: string;
}
