export type AssumptionsHistoryRow = {
  data: Record<string, unknown>;
  updated_at: string;
  updated_by: string;
};

export type DurationPreset = {
  id: string;
  preset_name: string;
  duration_months: number;
  category: string;
  bcr_mandatory: number;
  bcr_minimum: number;
  is_active: boolean;
};

export type SlaRow = {
  role_key: string;
  role_name: string;
  sla_working_days: number;
  reminder_hours: number;
  escalation_hours: number;
  escalate_to_role: string | null;
};

export type OrgUnitRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  segment: string;
  is_active: boolean;
};

export type AdminUserRow = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  last_login_at?: string | null;
  created_at?: string;
  employee_id?: string | null;
  org_unit_id?: string | null;
  org_level?: string | null;
  org_unit_code?: string | null;
  org_unit_name?: string | null;
  org_unit_segment?: string | null;
};

export type AuditLogRow = {
  id: string;
  timestamp: string;
  user: string | null;
  action: string;
  old_val: string | null;
  new_val: string | null;
  project_id: string | null;
};

export type SystemHealth = {
  status?: "operational" | "maintenance" | "degraded";
  checked_at?: string;
  services: Array<{ name: string; status: string; port?: number; latency_ms?: number | null }>;
  stats: {
    active_projects: number;
    draft_projects?: number;
    pending_approvals?: number;
    calculations_today: number;
    audit_events_today?: number;
    active_users?: number;
    org_units?: number;
  };
  fx?: {
    kurs_usd: number | null;
    kurs_usd_source: string | null;
    kurs_usd_updated_at: string | null;
    kurs_pending: boolean;
  };
  recent_activity?: Array<{ action: string; user: string | null; at: string }>;
  maintenance_mode: boolean;
  environment?: string;
};

export type SystemConfigRow = {
  key: string;
  val: string;
  type: string;
  desc: string | null;
};

export type CategoryRow = { type: "CAPEX" | "OPEX"; code: string };
