import type {
  ApprovalQueueItem,
  ApprovalsQueueV2Item,
  NotificationItem,
  PortfolioResponse,
  Project,
  User,
} from "@/types/navpro";
import { getAuthToken, setAuthToken } from "@/stores/authStore";

const NAVPRO_API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export class NavproApi {
  private baseUrl: string;
  private defaultTimeoutMs = 4500;
  private loginTimeoutMs = 15000;

  constructor(baseUrl: string = NAVPRO_API_BASE) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private getToken(): string | null {
    return getAuthToken();
  }

  public setToken(token: string | null) {
    setAuthToken(token);
  }

  private async fetchJsonWithTimeout(url: string, init: RequestInit = {}, timeoutMs = this.defaultTimeoutMs) {
    const controller = typeof window !== "undefined" ? new AbortController() : null;
    const t = typeof window !== "undefined" ? window.setTimeout(() => controller?.abort(), timeoutMs) : null;
    try {
      const res = await fetch(url, { ...init, signal: controller?.signal });
      const data = await res.json().catch(() => ({}));
      return { res, data };
    } finally {
      if (t) window.clearTimeout(t);
    }
  }

  async health(): Promise<{ status?: string }> {
    const { res, data } = await this.fetchJsonWithTimeout(`${this.baseUrl}/health`, { method: "GET" }, 5000);
    if (!res.ok) return {};
    return data as { status?: string };
  }

  private async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = this.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const { res, data } = await this.fetchJsonWithTimeout(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = new Error(
        (data as { message?: string; error?: string }).message ||
          (data as { error?: string }).error ||
          `HTTP ${res.status}`
      ) as Error & { status?: number; data?: unknown };
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data as T;
  }

  private async requestBlob(path: string): Promise<Blob> {
    const headers: Record<string, string> = {};
    const token = this.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const controller = typeof window !== "undefined" ? new AbortController() : null;
    const t = typeof window !== "undefined" ? window.setTimeout(() => controller?.abort(), 15000) : null;
    const res = await fetch(`${this.baseUrl}${path}`, { headers, signal: controller?.signal });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(
        (data as { message?: string; error?: string }).message ||
          (data as { error?: string }).error ||
          `HTTP ${res.status}`
      ) as Error & { status?: number; data?: unknown };
      err.status = res.status;
      err.data = data;
      throw err;
    }
    if (t) window.clearTimeout(t);
    return res.blob();
  }

  login(email: string, password: string) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const e2eSecret = process.env.NEXT_PUBLIC_E2E_BYPASS_SECRET;
    if (e2eSecret) headers["X-Navpro-E2E"] = e2eSecret;

    return this.fetchJsonWithTimeout(
      `${this.baseUrl}/api/v1/auth/login`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ email, password }),
      },
      this.loginTimeoutMs
    ).then(({ res, data }) => {
      if (!res.ok) {
        const err = new Error(
          (data as { message?: string; error?: string }).message ||
            (data as { error?: string }).error ||
            `HTTP ${res.status}`
        ) as Error & { status?: number; data?: unknown };
        err.status = res.status;
        err.data = data;
        throw err;
      }
      const payload = data as { token: string; user: User };
      this.setToken(payload.token);
      return payload;
    });
  }

  me() {
    return this.request<{ user: User }>("GET", "/api/v1/auth/me");
  }

  updateProfile(input: { full_name: string }) {
    return this.request<{ user: User }>("PATCH", "/api/v1/auth/me", input);
  }

  changePassword(input: { current_password: string; new_password: string }) {
    return this.request<{ ok: true }>("PATCH", "/api/v1/auth/password", input);
  }

  logout() {
    const token = this.getToken();
    if (!token) {
      this.setToken(null);
      return Promise.resolve({ ok: true });
    }
    return this.request("POST", "/api/v1/auth/logout")
      .catch(() => ({}))
      .finally(() => this.setToken(null));
  }

  getProjects(params: Record<string, string> = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request<{ projects: Project[] }>(
      "GET",
      `/api/v1/projects${q ? `?${q}` : ""}`
    );
  }

  getProject(id: string) {
    return this.request<{ project: Project }>("GET", `/api/v1/projects/${id}`);
  }

  createProject(project: Partial<Project>) {
    return this.request<{ project: Project }>("POST", "/api/v1/projects", project);
  }

  updateProject(id: string, project: Partial<Project>) {
    return this.request<{ project: Project }>("PUT", `/api/v1/projects/${id}`, project);
  }

  deleteProject(id: string) {
    return this.request("DELETE", `/api/v1/projects/${id}`);
  }

  calculateProject(id: string) {
    return this.request<{ project: Project }>("POST", `/api/v1/projects/${id}/calculate`);
  }

  calculateProjectAsync(id: string) {
    return this.request<{ ok: boolean; job_id: string }>(
      "POST",
      `/api/v1/projects/${id}/calculate-async`
    );
  }

  getJobStatus(jobId: string) {
    return this.request<{
      job_id: string;
      state: string;
      project_id?: string;
      failed_reason?: string;
    }>("GET", `/api/v1/jobs/${jobId}`);
  }

  duplicateProject(id: string) {
    return this.request<{ project: Project }>("POST", `/api/v1/projects/${id}/duplicate`);
  }

  getProjectAuditLogs(id: string) {
    return this.request<{
      logs: Array<{
        id: string;
        user_name: string;
        action: string;
        old_val: string | null;
        new_val: string | null;
        created_at: string;
      }>;
    }>(`GET`, `/api/v1/projects/${id}/audit-logs`);
  }

  submitProject(id: string, comment?: string) {
    return this.request<{ project: Project }>("POST", `/api/v1/projects/${id}/submit`, {
      comment,
    });
  }

  approveProject(id: string, comment?: string) {
    return this.request<{ project: Project }>("POST", `/api/v1/projects/${id}/approve`, {
      comment,
    });
  }

  rejectProject(id: string, comment: string) {
    return this.request<{ project: Project }>("POST", `/api/v1/projects/${id}/reject`, {
      comment,
    });
  }

  archiveProject(id: string) {
    return this.request<{ project: Project }>("POST", `/api/v1/projects/${id}/archive`);
  }

  getProjectVersionSnapshot(id: string, versionNumber: number) {
    return this.request<{
      version: {
        input_snapshot: unknown;
        result_snapshot: { kpi?: Project["kpi"]; cashflow_monthly?: Project["cashflow_monthly"] };
      };
    }>("GET", `/api/v1/projects/${id}/versions/${versionNumber}`);
  }

  downloadProjectPdf(id: string) {
    return this.requestBlob(`/api/v1/projects/${id}/export.pdf`);
  }

  downloadProjectXlsx(id: string) {
    return this.requestBlob(`/api/v1/projects/${id}/export.xlsx`);
  }

  getDashboardPortfolio() {
    return this.request<PortfolioResponse>("GET", "/api/v1/dashboard/portfolio?compact=true");
  }

  getDashboardHjtSummary() {
    return this.request<import("@/types/hjt").HjtDashboardSummary>("GET", "/api/v1/dashboard/hjt-summary");
  }

  getDashboardApprovalQueue() {
    return this.request<{ items: ApprovalQueueItem[] }>(
      "GET",
      "/api/v1/dashboard/approval-queue"
    );
  }

  /** BRD v2.0 — pending steps assigned to current approver */
  getApprovalsQueue() {
    return this.request<{ items: ApprovalsQueueV2Item[] }>("GET", "/api/v1/approvals/queue");
  }

  getApprovalsQueueSummary() {
    return this.request<{
      summary: { pending_count: number; asman_count: number; manager_count: number };
    }>("GET", "/api/v1/approvals/queue/summary");
  }

  getMyApprovalStep(projectId: string) {
    return this.request<{
      step: {
        id: string;
        project_id: string;
        step_order: number;
        approver_level: string;
        approver_role: string;
        status: string;
        due_at: string | null;
        project_code: string;
        project_name: string;
        project_status: string;
      } | null;
    }>("GET", `/api/v1/approvals/projects/${projectId}/my-step`);
  }

  getDelegateCandidates(stepId: string) {
    return this.request<{
      candidates: Array<{ id: string; full_name: string; email: string; role: string }>;
    }>("GET", `/api/v1/approvals/steps/${stepId}/delegate-candidates`);
  }

  delegateApprovalStep(stepId: string, body: { to_user_id: string; reason: string }) {
    return this.request<{ ok: boolean; assigned_to: string }>(
      "POST",
      `/api/v1/approvals/steps/${stepId}/delegate`,
      body
    );
  }

  getNotifications() {
    return this.request<{ notifications: NotificationItem[] }>("GET", "/api/v1/notifications");
  }

  markNotificationRead(id: string) {
    return this.request("PATCH", `/api/v1/notifications/${id}/read`);
  }

  markAllNotificationsRead() {
    return this.request("POST", "/api/v1/notifications/read-all");
  }

  getAssumptions() {
    return this.request<Record<string, unknown>>("GET", "/api/v1/config/assumptions");
  }

  getPresets() {
    return this.request<{ presets: Array<{ preset_name: string; duration_months: number }> }>(
      "GET",
      "/api/v1/config/presets"
    );
  }

  getOpexCatalog(q?: string) {
    const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
    return this.request<{
      items: Array<{
        code: string;
        name: string;
        category: string;
        icon_key: string;
        unit: string;
        default_type: "NOMINAL" | "PERCENT";
        default_amount: number;
        default_currency: "IDR" | "USD";
        description?: string | null;
      }>;
    }>("GET", `/api/v1/config/opex-catalog${qs}`);
  }

  getOrgUnits() {
    return this.request<{
      org_units: Array<{
        id: string;
        code: string;
        name: string;
        type: string;
        segment: string;
      }>;
    }>("GET", "/api/v1/config/org-units");
  }

  getExchangeRate() {
    return this.request<import("@/types/exchange-rate").ExchangeRateCurrent>(
      "GET",
      "/api/v1/config/exchange-rate"
    );
  }

  getExchangeRateHistory(params?: {
    from?: string;
    to?: string;
    limit?: number;
    order?: "asc" | "desc";
    currency?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    if (params?.limit != null) qs.set("limit", String(params.limit));
    if (params?.order) qs.set("order", params.order);
    if (params?.currency) qs.set("currency", params.currency);
    const q = qs.toString();
    return this.request<import("@/types/exchange-rate").ExchangeRateHistoryResponse>(
      "GET",
      `/api/v1/config/exchange-rate/history${q ? `?${q}` : ""}`
    );
  }

  syncExchangeRate(force?: boolean) {
    return this.request<import("@/types/exchange-rate").ExchangeRateSyncResult>(
      "POST",
      "/api/v1/admin/exchange-rate/sync",
      force ? { force: true } : undefined
    );
  }

  getExchangeRateSyncLog(limit = 50) {
    return this.request<{ items: import("@/types/exchange-rate").ExchangeRateSyncLogItem[] }>(
      "GET",
      `/api/v1/admin/exchange-rate/sync-log?limit=${limit}`
    );
  }

  patchExchangeRateSettings(kurs_auto_sync_enabled: boolean) {
    return this.request<{ kurs_auto_sync_enabled: boolean }>(
      "PATCH",
      "/api/v1/admin/exchange-rate/settings",
      { kurs_auto_sync_enabled }
    );
  }

  approvePendingExchangeRate() {
    return this.request<import("@/types/exchange-rate").ExchangeRateSyncResult>(
      "POST",
      "/api/v1/admin/exchange-rate/approve-pending"
    );
  }

  rejectPendingExchangeRate() {
    return this.request<{ rejected: boolean }>("POST", "/api/v1/admin/exchange-rate/reject-pending");
  }

  backfillExchangeRate(from?: string, to?: string) {
    return this.request<import("@/types/exchange-rate").ExchangeRateBackfillResult>(
      "POST",
      "/api/v1/admin/exchange-rate/backfill",
      { from, to }
    );
  }

  adminGetAssumptions() {
    return this.request("GET", "/api/v1/admin/assumptions");
  }

  adminSaveAssumptions(data: Record<string, unknown>) {
    return this.request("PUT", "/api/v1/admin/assumptions", data);
  }

  adminGetAssumptionsHistory() {
    return this.request<{ history: Array<{ data: Record<string, unknown>; updated_at: string; updated_by: string }> }>(
      "GET",
      "/api/v1/admin/assumptions/history"
    );
  }

  adminGetPresets() {
    return this.request("GET", "/api/v1/admin/duration-presets");
  }

  adminCreatePreset(preset: {
    id?: string;
    preset_name: string;
    duration_months: number;
    category: string;
    bcr_mandatory: number;
    bcr_minimum: number;
    is_active: boolean;
  }) {
    return this.request("POST", "/api/v1/admin/duration-presets", preset);
  }

  adminUpdatePreset(id: string, preset: Record<string, unknown>) {
    return this.request("PUT", `/api/v1/admin/duration-presets/${id}`, preset);
  }

  adminDeactivatePreset(id: string) {
    return this.request("DELETE", `/api/v1/admin/duration-presets/${id}`);
  }

  adminGetSla() {
    return this.request("GET", "/api/v1/admin/sla-config");
  }

  adminSaveSla(roleKey: string, body: Record<string, unknown>) {
    return this.request("PUT", `/api/v1/admin/sla-config/${roleKey}`, body);
  }

  adminGetCapexCategories() {
    return this.request<{ categories: string[] }>("GET", "/api/v1/admin/capex-categories");
  }

  adminGetOpexCategories() {
    return this.request<{ categories: string[] }>("GET", "/api/v1/admin/opex-categories");
  }

  adminAddCapexCategory(code: string) {
    return this.request("POST", "/api/v1/admin/capex-categories", { code });
  }

  adminAddOpexCategory(code: string) {
    return this.request("POST", "/api/v1/admin/opex-categories", { code });
  }

  adminGetOrgUnits() {
    return this.request<{
      org_units: Array<{
        id: string;
        code: string;
        name: string;
        type: string;
        segment: string;
        parent_id: string | null;
        is_active: boolean;
      }>;
    }>("GET", "/api/v1/admin/org-units");
  }

  adminBackfillProjectsOrg() {
    return this.request<{ updated: number; project_ids: string[] }>(
      "POST",
      "/api/v1/admin/projects/backfill-org"
    );
  }

  adminCreateOrgUnit(body: {
    code: string;
    name: string;
    type: string;
    segment: string;
    parent_id?: string | null;
    is_active?: boolean;
  }) {
    return this.request<{ id: string; code: string }>("POST", "/api/v1/admin/org-units", body);
  }

  adminUpdateOrgUnit(
    id: string,
    body: {
      code?: string;
      name?: string;
      type?: string;
      segment?: string;
      parent_id?: string | null;
      is_active?: boolean;
    }
  ) {
    return this.request("PUT", `/api/v1/admin/org-units/${id}`, body);
  }

  adminDeleteOrgUnit(id: string) {
    return this.request<{ ok: boolean; soft_deleted?: boolean; message?: string }>(
      "DELETE",
      `/api/v1/admin/org-units/${id}`
    );
  }

  adminPreviewSlaDue(roleKey: string, startAt?: string) {
    const q = new URLSearchParams({ role_key: roleKey });
    if (startAt) q.set("start_at", startAt);
    return this.request<{
      role_key: string;
      start_at: string;
      due_at: string;
      sla_working_days: number;
      business_hours: string;
    }>("GET", `/api/v1/admin/sla-config/preview-due?${q}`);
  }

  adminDeleteSla(roleKey: string) {
    return this.request("DELETE", `/api/v1/admin/sla-config/${encodeURIComponent(roleKey)}`);
  }

  adminGetUsers(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    role?: string;
    active?: string;
  }) {
    const q = new URLSearchParams();
    if (params?.page != null) q.set("page", String(params.page));
    if (params?.pageSize != null) q.set("pageSize", String(params.pageSize));
    if (params?.search?.trim()) q.set("search", params.search.trim());
    if (params?.role?.trim()) q.set("role", params.role.trim());
    if (params?.active?.trim()) q.set("active", params.active.trim());
    const qs = q.toString();
    return this.request<{
      users: Array<{
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
      }>;
      total: number;
      page: number;
      pageSize: number;
    }>("GET", `/api/v1/admin/users${qs ? `?${qs}` : ""}`);
  }

  adminCreateUser(body: {
    email: string;
    full_name: string;
    role: string;
    is_active: boolean;
    password?: string;
    employee_id?: string | null;
    org_unit_id?: string | null;
    org_level?: string | null;
  }) {
    return this.request<{ id: string }>("POST", "/api/v1/admin/users", body);
  }

  adminUpdateUser(
    id: string,
    body: {
      email?: string;
      full_name: string;
      role: string;
      is_active: boolean;
      employee_id?: string | null;
      org_unit_id?: string | null;
      org_level?: string | null;
    }
  ) {
    return this.request("PUT", `/api/v1/admin/users/${id}`, body);
  }

  adminResetUserPassword(id: string, new_password?: string) {
    return this.request<{ ok: true }>("POST", `/api/v1/admin/users/${id}/reset-password`, {
      new_password,
    });
  }

  adminGetAuditLogs(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    action?: string;
  }) {
    const q = new URLSearchParams();
    if (params?.page != null) q.set("page", String(params.page));
    if (params?.pageSize != null) q.set("pageSize", String(params.pageSize));
    if (params?.search?.trim()) q.set("search", params.search.trim());
    if (params?.action?.trim()) q.set("action", params.action.trim());
    const qs = q.toString();
    return this.request<{
      logs: Array<{
        id: string;
        timestamp: string;
        user: string | null;
        action: string;
        old_val: string | null;
        new_val: string | null;
        project_id: string | null;
      }>;
      total: number;
      page: number;
      pageSize: number;
      actions: string[];
    }>("GET", `/api/v1/admin/audit-logs${qs ? `?${qs}` : ""}`);
  }

  /** @deprecated use adminGetAuditLogs({ pageSize }) */
  adminGetAuditLogsWithLimit(limit: number) {
    return this.adminGetAuditLogs({ page: 1, pageSize: limit });
  }

  adminGetSystemHealth() {
    return this.request("GET", "/api/v1/admin/system-health");
  }

  adminSetMaintenance(enabled: boolean) {
    return this.request<{ maintenance_mode: boolean }>("POST", "/api/v1/admin/system-health/maintenance", { enabled });
  }

  adminGetSystemConfig() {
    return this.request<{
      config: Array<{
        config_key: string;
        config_val: string;
        category: string;
        data_type: string;
        description: string | null;
      }>;
      grouped: Record<string, Array<{ key: string; val: string; type: string; desc: string | null }>>;
    }>("GET", "/api/v1/admin/system-config");
  }

  adminSetSystemConfig(key: string, val: string) {
    return this.request<{ ok: true }>(
      "PUT",
      `/api/v1/admin/system-config/${encodeURIComponent(key)}`,
      { val }
    );
  }

  // ── HJT module ────────────────────────────────────────────────
  hjtListRegions() {
    return this.request<{ regions: import("@/types/hjt").HjtRegion[] }>("GET", "/api/v1/hjt/regions");
  }

  hjtListProducts(q?: string) {
    const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
    return this.request<{ products: import("@/types/hjt").HjtProduct[] }>("GET", `/api/v1/hjt/products${qs}`);
  }

  hjtListTariffVersions(status?: string) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.request<{ versions: Array<{ id: string; kepdir_ref: string; status: string }> }>(
      "GET",
      `/api/v1/hjt/tariff-versions${qs}`
    );
  }

  hjtListQuotations(params?: { search?: string; status?: string; limit?: number; offset?: number }) {
    const q = new URLSearchParams();
    if (params?.search?.trim()) q.set("search", params.search.trim());
    if (params?.status) q.set("status", params.status);
    if (params?.limit != null) q.set("limit", String(params.limit));
    if (params?.offset != null) q.set("offset", String(params.offset));
    const qs = q.toString();
    return this.request<{
      quotations: import("@/types/hjt").HjtQuotation[];
      total: number;
      limit?: number;
      offset?: number;
    }>("GET", `/api/v1/hjt/quotations${qs ? `?${qs}` : ""}`);
  }

  hjtCreateQuotation(body: Partial<import("@/types/hjt").HjtQuotation>) {
    return this.request<{ quotation: import("@/types/hjt").HjtQuotation }>(
      "POST",
      "/api/v1/hjt/quotations",
      body
    );
  }

  hjtGetQuotation(id: string) {
    return this.request<import("@/types/hjt").HjtQuotationFull>("GET", `/api/v1/hjt/quotations/${id}`);
  }

  hjtUpdateQuotation(id: string, body: Partial<import("@/types/hjt").HjtQuotation>) {
    return this.request<{ quotation: import("@/types/hjt").HjtQuotation }>(
      "PATCH",
      `/api/v1/hjt/quotations/${id}`,
      body
    );
  }

  hjtUpsertLine(quotationId: string, line: Partial<import("@/types/hjt").HjtQuotationLine>) {
    return this.request<{ line: import("@/types/hjt").HjtQuotationLine }>(
      "POST",
      `/api/v1/hjt/quotations/${quotationId}/lines`,
      line
    );
  }

  hjtDeleteLine(quotationId: string, lineId: string) {
    return this.request("DELETE", `/api/v1/hjt/quotations/${quotationId}/lines/${lineId}`);
  }

  hjtUpsertExpense(quotationId: string, expense: Partial<import("@/types/hjt").HjtOtherExpense>) {
    return this.request<{ expense: import("@/types/hjt").HjtOtherExpense }>(
      "POST",
      `/api/v1/hjt/quotations/${quotationId}/other-expenses`,
      expense
    );
  }

  hjtDeleteExpense(quotationId: string, expenseId: string) {
    return this.request("DELETE", `/api/v1/hjt/quotations/${quotationId}/other-expenses/${expenseId}`);
  }

  hjtCalculate(quotationId: string, mode?: import("@/types/hjt").HjtCalcMode) {
    const qs = mode ? `?mode=${mode}` : "";
    return this.request<import("@/types/hjt").HjtCalculateResult>(
      "POST",
      `/api/v1/hjt/quotations/${quotationId}/calculate${qs}`
    );
  }

  hjtLastmileKkf(body: Record<string, unknown>) {
    return this.request<{ lastmile: import("@/types/hjt").HjtLastmileResult }>(
      "POST",
      "/api/v1/hjt/lastmile-kkf",
      body
    );
  }

  hjtSubmitQuotation(
    id: string,
    body?: { harga_final?: number; floor_override_justification?: string }
  ) {
    return this.request("POST", `/api/v1/hjt/quotations/${id}/submit`, body ?? {});
  }

  hjtApproveQuotation(id: string, note?: string) {
    return this.request("POST", `/api/v1/hjt/quotations/${id}/approve`, { note });
  }

  hjtRejectQuotation(id: string, note: string) {
    return this.request("POST", `/api/v1/hjt/quotations/${id}/reject`, { note });
  }

  hjtApprovalQueue() {
    return this.request<{ items: import("@/types/hjt").HjtQuotation[] }>("GET", "/api/v1/hjt/approvals/queue");
  }

  hjtApprovalTimeline(id: string) {
    return this.request<{ approvals: import("@/types/hjt").HjtApprovalStep[] }>(
      "GET",
      `/api/v1/hjt/quotations/${id}/approvals`
    );
  }

  async hjtDownloadExport(id: string, format: "pdf" | "xlsx") {
    const ext = format === "pdf" ? "pdf" : "xlsx";
    const blob = await this.requestBlob(`/api/v1/hjt/quotations/${id}/export.${ext}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `HJT_${id.slice(0, 8)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  hjtAdminTariffGrid(params: { version: string; q?: string; limit?: number; offset?: number }) {
    const q = new URLSearchParams();
    q.set("version", params.version);
    if (params.q?.trim()) q.set("q", params.q.trim());
    if (params.limit != null) q.set("limit", String(params.limit));
    if (params.offset != null) q.set("offset", String(params.offset));
    return this.request<{ items: Array<Record<string, unknown>> }>(
      "GET",
      `/api/v1/hjt/admin/tariff?${q.toString()}`
    );
  }

  hjtAdminCreateVersion(body: { kepdir_ref: string; effective_date: string }) {
    return this.request("POST", "/api/v1/hjt/admin/tariff-versions", body);
  }

  hjtAdminActivateVersion(id: string) {
    return this.request("POST", `/api/v1/hjt/admin/tariff-versions/${id}/activate`);
  }

  hjtAdminIbbc(params?: { version?: string }) {
    const q = params?.version ? `?version=${encodeURIComponent(params.version)}` : "";
    return this.request<{ items: Array<Record<string, unknown>> }>("GET", `/api/v1/hjt/admin/ibbc${q}`);
  }

  hjtAdminOverhead(params?: { version?: string }) {
    const q = params?.version ? `?version=${encodeURIComponent(params.version)}` : "";
    return this.request<{ items: Array<Record<string, unknown>> }>("GET", `/api/v1/hjt/admin/overhead${q}`);
  }

  async hjtDownloadImportTemplate() {
    const blob = await this.requestBlob("/api/v1/hjt/admin/import/template");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hjt-tariff-template.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async hjtUploadImport(versionId: string, file: File) {
    const form = new FormData();
    form.append("version_id", versionId);
    form.append("file", file);
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${this.baseUrl}/api/v1/hjt/admin/import`, {
      method: "POST",
      headers,
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { message?: string }).message || "Upload gagal");
    }
    return data as { import: { id: string }; summary: Record<string, unknown> };
  }

  hjtImportPreview(importId: string) {
    return this.request<{
      import: { valid_rows?: number; error_rows?: number };
      rows: Array<{ row_no: number; product_name: string; region_code: string; row_status: string }>;
    }>("GET", `/api/v1/hjt/admin/import/${importId}/preview`);
  }

  hjtImportCommit(importId: string) {
    return this.request<{ committed: number }>("POST", `/api/v1/hjt/admin/import/${importId}/commit`);
  }

  hjtCreateKkfProject(quotationId: string) {
    return this.request<{ project_id: string; project_code: string }>(
      "POST",
      `/api/v1/hjt/quotations/${quotationId}/create-project`
    );
  }

  hjtLookupTariff(params: { product: number; region: number; version?: string }) {
    const q = new URLSearchParams({
      product: String(params.product),
      region: String(params.region),
    });
    if (params.version) q.set("version", params.version);
    return this.request<{
      found?: boolean;
      backbone: number;
      uplink: number;
      vas: number;
      access: number;
      tarif: number;
    }>("GET", `/api/v1/hjt/tariff?${q.toString()}`);
  }
}

export const navproApi = new NavproApi();
