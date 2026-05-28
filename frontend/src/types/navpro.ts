export type UserRole =
  | "SUPER_ADMIN"
  | "FINANCE_ADMIN"
  | "SA"
  | "MANAGER"
  | "GM_SRM"
  | "VIEWER";

export type ProjectStatus =
  | "DRAFT"
  | "COMPUTED"
  | "SUBMITTED"
  | "UNDER_REVIEW"
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

export interface PortfolioResponse {
  kpi: {
    total_projects: number;
    approved_count: number;
    pending_approval: number;
    avg_xirr: number;
    total_xnpv: number;
  };
  risk_distribution: Record<string, number>;
  status_distribution: Record<string, number>;
  projects: Project[];
}

export interface ApprovalQueueItem {
  project_id: string;
  project_code: string;
  project_name: string;
  status: ProjectStatus;
  duration_months: number;
  created_by_name?: string;
  sla_due_at?: string | null;
  sla_overdue?: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  body?: string;
  project_id?: string;
  is_read: boolean;
  created_at: string;
}
