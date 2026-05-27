/**
 * NAVPRO API client — integrates frontend with backend /api/v1
 */
const NAVPRO_API_BASE =
  typeof window !== 'undefined' && window.NAVPRO_API_URL
    ? window.NAVPRO_API_URL
    : 'http://localhost:4000';

class NavproApi {
  constructor(baseUrl = NAVPRO_API_BASE) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = localStorage.getItem('navpro_token') || null;
  }

  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem('navpro_token', token);
    else localStorage.removeItem('navpro_token');
  }

  async request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || data.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  health() {
    return fetch(`${this.baseUrl}/health`).then((r) => r.json());
  }

  login(email, password) {
    return this.request('POST', '/api/v1/auth/login', { email, password }).then((data) => {
      this.setToken(data.token);
      return data;
    });
  }

  me() {
    return this.request('GET', '/api/v1/auth/me');
  }

  logout() {
    if (!this.token) {
      this.setToken(null);
      return Promise.resolve({ ok: true });
    }
    return this.request('POST', '/api/v1/auth/logout')
      .catch(() => ({}))
      .finally(() => this.setToken(null));
  }

  getProjects(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request('GET', `/api/v1/projects${q ? `?${q}` : ''}`);
  }

  getProject(id) {
    return this.request('GET', `/api/v1/projects/${id}`);
  }

  createProject(project) {
    return this.request('POST', '/api/v1/projects', project);
  }

  updateProject(id, project) {
    return this.request('PUT', `/api/v1/projects/${id}`, project);
  }

  deleteProject(id) {
    return this.request('DELETE', `/api/v1/projects/${id}`);
  }

  calculateProject(id) {
    return this.request('POST', `/api/v1/projects/${id}/calculate`);
  }

  submitProject(id, comment) {
    return this.request('POST', `/api/v1/projects/${id}/submit`, { comment });
  }

  approveProject(id, comment) {
    return this.request('POST', `/api/v1/projects/${id}/approve`, { comment });
  }

  rejectProject(id, comment) {
    return this.request('POST', `/api/v1/projects/${id}/reject`, { comment });
  }

  archiveProject(id) {
    return this.request('POST', `/api/v1/projects/${id}/archive`);
  }

  getProjectVersions(id) {
    return this.request('GET', `/api/v1/projects/${id}/versions`);
  }

  getProjectVersionSnapshot(id, versionNumber) {
    return this.request('GET', `/api/v1/projects/${id}/versions/${versionNumber}`);
  }

  getDashboardPortfolio() {
    return this.request('GET', '/api/v1/dashboard/portfolio');
  }

  getDashboardApprovalQueue() {
    return this.request('GET', '/api/v1/dashboard/approval-queue');
  }

  getNotifications() {
    return this.request('GET', '/api/v1/notifications');
  }

  markNotificationRead(id) {
    return this.request('PATCH', `/api/v1/notifications/${id}/read`);
  }

  markAllNotificationsRead() {
    return this.request('POST', '/api/v1/notifications/read-all');
  }

  getAssumptions() {
    return this.request('GET', '/api/v1/config/assumptions');
  }

  getPresets() {
    return this.request('GET', '/api/v1/config/presets');
  }

  getCategories() {
    return this.request('GET', '/api/v1/config/categories');
  }

  // Admin
  adminGetAssumptions() {
    return this.request('GET', '/api/v1/admin/assumptions');
  }

  adminUpdateAssumption(key, value) {
    return this.request('PUT', `/api/v1/admin/assumptions/${key}`, { value });
  }

  adminSaveAssumptions(data) {
    return this.request('PUT', '/api/v1/admin/assumptions', data);
  }

  adminGetAssumptionHistory() {
    return this.request('GET', '/api/v1/admin/assumptions/history');
  }

  adminGetPresets() {
    return this.request('GET', '/api/v1/admin/duration-presets');
  }

  adminSavePreset(preset) {
    if (preset.id && !preset._isNew) {
      return this.request('PUT', `/api/v1/admin/duration-presets/${preset.id}`, preset);
    }
    return this.request('POST', '/api/v1/admin/duration-presets', preset);
  }

  adminDeletePreset(id) {
    return this.request('DELETE', `/api/v1/admin/duration-presets/${id}`);
  }

  adminGetSla() {
    return this.request('GET', '/api/v1/admin/sla-config');
  }

  adminUpdateSla(roleKey, data) {
    return this.request('PUT', `/api/v1/admin/sla-config/${roleKey}`, data);
  }

  adminGetSystemConfig() {
    return this.request('GET', '/api/v1/admin/system-config');
  }

  adminUpdateSystemConfig(key, val) {
    return this.request('PUT', `/api/v1/admin/system-config/${key}`, { val });
  }

  adminGetUsers() {
    return this.request('GET', '/api/v1/admin/users');
  }

  adminSaveUser(user) {
    if (user.id && !user._isNew) {
      return this.request('PUT', `/api/v1/admin/users/${user.id}`, user);
    }
    return this.request('POST', '/api/v1/admin/users', user);
  }

  adminGetAuditLogs() {
    return this.request('GET', '/api/v1/admin/audit-logs');
  }

  adminGetSystemHealth() {
    return this.request('GET', '/api/v1/admin/system-health');
  }

  adminToggleMaintenance(enabled) {
    return this.request('POST', '/api/v1/admin/system-health/maintenance', { enabled });
  }
}

const navproApi = new NavproApi();
if (typeof window !== 'undefined') {
  window.navproApi = navproApi;
  window.NavproApi = NavproApi;
}
