import type {
  ApprovalQueueItem,
  NotificationItem,
  PortfolioResponse,
  Project,
  User,
} from "@/types/navpro";

const NAVPRO_API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export class NavproApi {
  private baseUrl: string;
  private defaultTimeoutMs = 4500;

  constructor(baseUrl: string = NAVPRO_API_BASE) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private getToken(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem("navpro_token");
    }
    return null;
  }

  public setToken(token: string | null) {
    if (typeof window !== "undefined") {
      if (token) localStorage.setItem("navpro_token", token);
      else localStorage.removeItem("navpro_token");
    }
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
    const { res, data } = await this.fetchJsonWithTimeout(`${this.baseUrl}/health`, { method: "GET" }, 2500);
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
    return this.request<{ token: string; user: User }>("POST", "/api/v1/auth/login", {
      email,
      password,
    }).then((data) => {
      this.setToken(data.token);
      return data;
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

  getDashboardApprovalQueue() {
    return this.request<{ items: ApprovalQueueItem[] }>(
      "GET",
      "/api/v1/dashboard/approval-queue"
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

  adminGetUsers() {
    return this.request("GET", "/api/v1/admin/users");
  }

  adminCreateUser(body: { email: string; full_name: string; role: string; is_active: boolean; password?: string }) {
    return this.request<{ id: string }>("POST", "/api/v1/admin/users", body);
  }

  adminUpdateUser(id: string, body: { email?: string; full_name: string; role: string; is_active: boolean }) {
    return this.request("PUT", `/api/v1/admin/users/${id}`, body);
  }

  adminResetUserPassword(id: string, new_password?: string) {
    return this.request<{ ok: true }>("POST", `/api/v1/admin/users/${id}/reset-password`, {
      new_password,
    });
  }

  adminGetAuditLogs() {
    return this.request("GET", "/api/v1/admin/audit-logs");
  }

  adminGetAuditLogsWithLimit(limit: number) {
    const q = new URLSearchParams({ limit: String(limit) }).toString();
    return this.request("GET", `/api/v1/admin/audit-logs?${q}`);
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
}

export const navproApi = new NavproApi();
