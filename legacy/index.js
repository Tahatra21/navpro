// NAVPRO — Kajian Kelayakan Finansial Web Application

const NAVPRO = {
  brand: 'NAVPRO',
  tagline: 'Your Compass for Viable Project',
  productName: 'Navigate Project',
  org: 'Enterprise Investment Platform',
  codePrefix: 'NAVPRO',
  pageSize: 10,
  statusLabels: {
    DRAFT: 'Draf',
    COMPUTED: 'Dihitung',
    SUBMITTED: 'Diajukan',
    UNDER_REVIEW: 'Review',
    APPROVED_L1: 'L1',
    APPROVED_FINAL: 'Final',
    REJECTED: 'Ditolak',
    ARCHIVED: 'Arsip',
  },
  riskLabels: {
    LOW: 'Rendah',
    MEDIUM: 'Sedang',
    HIGH: 'Tinggi',
  },
  roleLabels: {
    SUPER_ADMIN: 'Super Admin',
    FINANCE_ADMIN: 'Finance Admin',
    SA: 'Solution Architect',
    MANAGER: 'Manager',
    GM_SRM: 'GM / SRM',
    VIEWER: 'Viewer',
  }
};

function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSafeProperty(obj, key, fallback) {
  if (obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key)) {
    return Reflect.get(obj, key);
  }
  return fallback !== undefined ? fallback : key;
}

class KKFApplication {
  constructor() {
    this.activePage = 'dashboard';
    this.activeAdminTab = 'health';
    this.currentRole = 'SUPER_ADMIN';
    this.useBackend = false;
    this.currentUser = null;
    this.projectsCache = null;
    this.assumptionsCache = null;
    this.presetsCache = null;
    this.slaCache = null;
    this.categoriesCache = null;
    this.systemParamsCache = null;
    this.usersCache = null;
    this.auditLogsCache = null;
    this.notificationsCache = null;
    this.backendStatus = 'checking';
    this.apiAvailable = false;
    this.isAuthenticated = false;
    this._userMenuOpen = false;

    // Store variables initialized from localStorage or defaults (fallback offline)
    this.initStore();
    this.migrateBranding();
    this.migrateOrgNeutral();
    
    // Financial engines
    this.xnpvChart = null;
    this.cashflowChart = null;
    this.costRevChart = null;
    
    // Wizard state
    this.wizardStep = 1;
    this.wizardProject = null; // temporary project being built
    this._wizardAutosaveTimer = null;
    this._wizardDirty = false;
    this._wizardLastSavedAt = null;
    this._wizardAutosaveBound = false;
    this._wizardServerCreated = false;

    // Projects list pagination
    this.projectsPage = 1;
    this.projectsPageSize = NAVPRO.pageSize;
  }

  // Initialize store with robust defaults matching the PRD
  initStore() {
    // 1. Assumption Master
    if (!localStorage.getItem('kkf_assumptions_master')) {
      // inflation_annual: 3% p.a. (Bank Dunia/BI Forecast)
      // inflation_monthly is auto-derived: (1+annual)^(1/12)-1 = 0.2466% per bulan
      const defaultAssumptions = {
        wacc_annual: 9.72,
        inflation_annual: 3.0,
        inflation_monthly: parseFloat(((Math.pow(1 + 3.0 / 100, 1 / 12) - 1) * 100).toFixed(6)),
        bcr_mandatory: 1.23,
        bcr_minimum: 1.08,
        ppn_rate: 12.0,
        kurs_usd: 16500,
        currency: 'IDR',
        effective_date: '2026-04-01',
        notes: 'Memo DirKeu 16 Sep 2025 & VP Keuangan April 2026'
      };
      localStorage.setItem('kkf_assumptions_master', JSON.stringify(defaultAssumptions));
      localStorage.setItem('kkf_assumptions_history', JSON.stringify([
        { ...defaultAssumptions, updated_at: '2026-04-01T00:00:00Z', updated_by: 'Finance Admin' }
      ]));
    } else {
      // Migration: ensure existing data has inflation_annual & kurs_usd fields
      const existing = JSON.parse(localStorage.getItem('kkf_assumptions_master'));
      if (existing) {
        let changed = false;
        if (existing.inflation_annual === undefined) {
          existing.inflation_annual = 3.0;
          existing.inflation_monthly = parseFloat(((Math.pow(1 + 3.0 / 100, 1 / 12) - 1) * 100).toFixed(6));
          changed = true;
        }
        if (existing.ppn_rate === undefined) {
          existing.ppn_rate = 12.0;
          changed = true;
        }
        if (existing.kurs_usd === undefined) {
          existing.kurs_usd = 16500;
          changed = true;
        }
        if (changed) {
          localStorage.setItem('kkf_assumptions_master', JSON.stringify(existing));
        }
      }
    }
    
    // 2. Duration Presets
    if (!localStorage.getItem('kkf_presets')) {
      const defaultPresets = [
        { id: 'pre-1', preset_name: 'Short Term (12 Bulan)', duration_months: 12, category: 'SHORT_TERM', bcr_mandatory: 1.23, bcr_minimum: 1.08, is_active: true },
        { id: 'pre-2', preset_name: 'Mid Term (24 Bulan)', duration_months: 24, category: 'MID_TERM', bcr_mandatory: 1.23, bcr_minimum: 1.08, is_active: true },
        { id: 'pre-3', preset_name: 'Mid Term (36 Bulan)', duration_months: 36, category: 'MID_TERM', bcr_mandatory: 1.23, bcr_minimum: 1.08, is_active: true },
        { id: 'pre-4', preset_name: 'Long Term (60 Bulan)', duration_months: 60, category: 'LONG_TERM', bcr_mandatory: 1.23, bcr_minimum: 1.08, is_active: true },
        { id: 'pre-5', preset_name: 'Extended (120 Bulan)', duration_months: 120, category: 'EXTENDED', bcr_mandatory: 1.23, bcr_minimum: 1.08, is_active: true }
      ];
      localStorage.setItem('kkf_presets', JSON.stringify(defaultPresets));
    }
    
    // 3. SLA Config
    if (!localStorage.getItem('kkf_sla_config')) {
      const defaultSLA = [
        { role_key: 'MANAGER', role_name: 'Manager', sla_working_days: 2, reminder_hours: 24, escalation_hours: 48, escalate_to_role: 'GM_SRM' },
        { role_key: 'GM_SRM', role_name: 'GM / SRM', sla_working_days: 1, reminder_hours: 12, escalation_hours: 24, escalate_to_role: 'FINANCE_ADMIN' }
      ];
      localStorage.setItem('kkf_sla_config', JSON.stringify(defaultSLA));
    }

    // 4. Categories
    if (!localStorage.getItem('kkf_categories')) {
      const defaultCats = {
        capex: ['HARDWARE', 'SOFTWARE', 'CIVIL', 'NETWORK', 'POWER', 'VEHICLE', 'INTEGRATION', 'OTHER'],
        opex: ['LABOR', 'MAINTENANCE', 'ELECTRICITY', 'BANDWIDTH', 'RENT', 'INSURANCE', 'ADMIN', 'TRANSPORT', 'OVERHEAD', 'OTHER']
      };
      localStorage.setItem('kkf_categories', JSON.stringify(defaultCats));
    }
    
    // 5. System Parameters (29 parameters key-value)
    if (!localStorage.getItem('kkf_system_params')) {
      const defaultParams = [
        { key: 'xirr_max_iterations', category: 'FORMULA', val: '1000', type: 'integer', desc: 'Maksimum iterasi Newton-Raphson XIRR' },
        { key: 'xirr_tolerance', category: 'FORMULA', val: '1e-7', type: 'float', desc: 'Toleransi batas error kalkulasi XIRR' },
        { key: 'npv_precision', category: 'FORMULA', val: '2', type: 'integer', desc: 'Desimal pembulatan NPV' },
        { key: 'cashflow_rounding', category: 'FORMULA', val: '0', type: 'integer', desc: 'Desimal pembulatan tabel cashflow' },
        { key: 'jwt_expiry_minutes', category: 'SECURITY', val: '60', type: 'integer', desc: 'Masa aktif JWT Token (menit)' },
        { key: 'refresh_token_days', category: 'SECURITY', val: '7', type: 'integer', desc: 'Masa aktif refresh token (hari)' },
        { key: 'max_login_attempts', category: 'SECURITY', val: '5', type: 'integer', desc: 'Percobaan login salah maksimal' },
        { key: 'enable_pdf_export', category: 'FEATURE_FLAG', val: 'true', type: 'boolean', desc: 'Aktifkan ekspor laporan ke PDF' },
        { key: 'enable_excel_export', category: 'FEATURE_FLAG', val: 'true', type: 'boolean', desc: 'Aktifkan ekspor cashflow ke Excel/CSV' },
        { key: 'maintenance_mode', category: 'FEATURE_FLAG', val: 'false', type: 'boolean', desc: 'Mode pemeliharaan sistem' }
      ];
      localStorage.setItem('kkf_system_params', JSON.stringify(defaultParams));
    }

    // 6. Users
    if (!localStorage.getItem('kkf_users')) {
      const defaultUsers = [
        { id: 'usr-1', full_name: 'Budi Santoso', email: 'budi.santoso@navpro.app', role: 'SUPER_ADMIN', is_active: true },
        { id: 'usr-2', full_name: 'Ani Lestari', email: 'ani.lestari@navpro.app', role: 'FINANCE_ADMIN', is_active: true },
        { id: 'usr-3', full_name: 'Rian Hidayat', email: 'rian.hidayat@navpro.app', role: 'SA', is_active: true },
        { id: 'usr-4', full_name: 'Dewi Sartika', email: 'dewi.sartika@navpro.app', role: 'MANAGER', is_active: true },
        { id: 'usr-5', full_name: 'Irwan Setiawan', email: 'irwan.setiawan@navpro.app', role: 'GM_SRM', is_active: true }
      ];
      localStorage.setItem('kkf_users', JSON.stringify(defaultUsers));
    }

    // 7. Projects & Mock Cashflow Data
    if (!localStorage.getItem('kkf_projects')) {
      const defaultProjects = this.generateMockProjects();
      localStorage.setItem('kkf_projects', JSON.stringify(defaultProjects));
    }
    this.migrateDemoProjectsV20();
    
    // 8. Audit Logs & Notifications
    if (!localStorage.getItem('kkf_audit_logs')) {
      localStorage.setItem('kkf_audit_logs', JSON.stringify([
        { id: 'log-1', timestamp: '2026-05-27T04:00:00Z', user: 'Rian Hidayat', action: 'CREATE_PROJECT', old_val: null, new_val: 'NAVPRO-2026-0001 (FTTH Expansion)' },
        { id: 'log-2', timestamp: '2026-05-27T04:10:00Z', user: 'Rian Hidayat', action: 'CALCULATE', old_val: null, new_val: 'NAVPRO-2026-0001 (XIRR: 18.52%)' },
        { id: 'log-3', timestamp: '2026-05-27T04:15:00Z', user: 'Dewi Sartika', action: 'APPROVE_L1', old_val: 'SUBMITTED', new_val: 'APPROVED_L1' },
        { id: 'log-4', timestamp: '2026-05-27T04:20:00Z', user: 'Irwan Setiawan', action: 'APPROVE_FINAL', old_val: 'APPROVED_L1', new_val: 'APPROVED_FINAL' }
      ]));
    }
    
    if (!localStorage.getItem('kkf_notifications')) {
      localStorage.setItem('kkf_notifications', JSON.stringify([
        { id: 'nt-1', timestamp: '2026-05-27T04:10:00Z', title: 'Proyek NAVPRO Baru', body: 'Proyek FTTH Expansion Jakarta Selatan menunggu review Anda.', is_read: false, project_id: 'proj-1' }
      ]));
    }
  }

  migrateBranding() {
    if (localStorage.getItem('navpro_branding_migrated') === '1') return;

    const replaceCode = (value) => typeof value === 'string'
      ? value.replace(/KKF-/g, `${NAVPRO.codePrefix}-`).replace(/\bKKF\b/g, NAVPRO.brand)
      : value;

    const projects = JSON.parse(localStorage.getItem('kkf_projects') || '[]');
    projects.forEach((project) => {
      if (project.project_code) project.project_code = replaceCode(project.project_code);
    });
    localStorage.setItem('kkf_projects', JSON.stringify(projects));

    const logs = JSON.parse(localStorage.getItem('kkf_audit_logs') || '[]');
    logs.forEach((log) => {
      if (log.new_val) log.new_val = replaceCode(log.new_val);
      if (log.old_val) log.old_val = replaceCode(log.old_val);
    });
    localStorage.setItem('kkf_audit_logs', JSON.stringify(logs));

    const notifications = JSON.parse(localStorage.getItem('kkf_notifications') || '[]');
    notifications.forEach((notification) => {
      if (notification.title) notification.title = replaceCode(notification.title);
      if (notification.body) notification.body = replaceCode(notification.body);
    });
    localStorage.setItem('kkf_notifications', JSON.stringify(notifications));

    localStorage.setItem('navpro_branding_migrated', '1');
  }

  migrateOrgNeutral() {
    if (localStorage.getItem('navpro_org_neutral') === '1') return;

    const users = JSON.parse(localStorage.getItem('kkf_users') || '[]');
    users.forEach((user) => {
      if (user.email?.includes('@iconplus.co.id')) {
        user.email = user.email.replace('@iconplus.co.id', '@navpro.app');
      }
    });
    localStorage.setItem('kkf_users', JSON.stringify(users));
    localStorage.setItem('navpro_org_neutral', '1');
  }

  migrateDemoProjectsV20() {
    if (this.useBackend || localStorage.getItem('navpro_demo_projects_v20') === '1') return;
    localStorage.setItem('kkf_projects', JSON.stringify(this.generateMockProjects()));
    localStorage.setItem('navpro_demo_projects_v20', '1');
  }

  generateProjectCode(sequence) {
    const year = new Date().getFullYear();
    return `${NAVPRO.codePrefix}-${year}-${String(sequence).padStart(4, '0')}`;
  }

  _demoApprovalChain(status) {
    const submit = { level: 'SUBMIT', user: 'Rian Hidayat', decided_at: '2026-05-26T08:00:00Z', status: 'SUBMITTED', comment: 'Pengajuan kelayakan finansial.' };
    const mgrApprove = { level: 'MANAGER', user: 'Dewi Sartika', decided_at: '2026-05-26T10:00:00Z', status: 'APPROVED_L1', comment: 'Disetujui level Manager.' };
    const gmApprove = { level: 'GM_SRM', user: 'Irwan Setiawan', decided_at: '2026-05-26T14:00:00Z', status: 'APPROVED_FINAL', comment: 'Disetujui final.' };
    const mgrReject = { level: 'MANAGER', user: 'Dewi Sartika', decided_at: '2026-05-26T10:00:00Z', status: 'REJECTED', comment: 'Perlu revisi CAPEX dan proyeksi revenue.' };
    if (status === 'SUBMITTED' || status === 'UNDER_REVIEW') return [submit];
    if (status === 'APPROVED_L1') return [submit, mgrApprove];
    if (status === 'APPROVED_FINAL') return [submit, mgrApprove, gmApprove];
    if (status === 'REJECTED') return [submit, mgrReject];
    return [];
  }

  _demoFinancials(months, scale = 1) {
    const s = scale;
    return {
      capex: [
        { name: 'Infrastruktur Utama', category: 'NETWORK', amount: Math.round(200000000 * s), period: 0 },
        { name: 'Instalasi & Integrasi', category: 'INTEGRATION', amount: Math.round(45000000 * s), period: 0 },
      ],
      opex: [{ name: 'Operasional & Maintenance', category: 'MAINTENANCE', baseline_amount: Math.round(4000000 * s), inflation_rate: 0.003, start_period: 1, end_period: months }],
      revenue: [{ name: 'Pendapatan Layanan Bulanan', monthly_amount: Math.round(28000000 * s), escalation_rate: 0.002, start_period: 1, end_period: months }],
      otc_amount: Math.round(10000000 * s),
    };
  }

  // 20 sample projects — all workflow statuses
  generateMockProjects() {
    const specs = [
      { seq: 1, name: 'FTTH Expansion Jakarta Selatan', customer: 'Korporat FTTH Jakarta Selatan', contract: 'BAKBB/2026/FTTH-001', pic: 'Ahmad Fauzi', status: 'APPROVED_FINAL', months: 36, category: 'MID_TERM', start: '2026-06-01', scale: 1.2 },
      { seq: 2, name: 'Datacenter Power Upgrade Cikarang', customer: 'PT Cikarang Industri Mandiri', contract: 'BAKBB/2026/DC-002', pic: 'Budi Prasetyo', status: 'UNDER_REVIEW', months: 12, category: 'SHORT_TERM', start: '2026-07-01', scale: 1.0 },
      { seq: 3, name: 'Smart Grid Connectivity Pilot', customer: 'PLN UID Jakarta', contract: 'BAKBB/2026/IOT-003', pic: 'Citra Dewi', status: 'REJECTED', months: 24, category: 'MID_TERM', start: '2026-08-01', scale: 2.5 },
      { seq: 4, name: 'Metro Ethernet Backbone Bandung', customer: 'PT Bandung Digital Nusantara', contract: 'BAKBB/2026/MET-004', pic: 'Doni Kurniawan', status: 'DRAFT', months: 24, category: 'MID_TERM', start: '2026-09-01', scale: 0.9 },
      { seq: 5, name: 'VSAT Remote Site Papua', customer: 'Pemerintah Kab. Mimika', contract: 'BAKBB/2026/VST-005', pic: 'Eka Putri', status: 'DRAFT', months: 12, category: 'SHORT_TERM', start: '2026-10-01', scale: 0.7 },
      { seq: 6, name: 'Cloud DR Site Semarang', customer: 'PT Asuransi Jiwa Sejahtera', contract: 'BAKBB/2026/CLD-006', pic: 'Fajar Nugroho', status: 'COMPUTED', months: 36, category: 'MID_TERM', start: '2026-06-15', scale: 1.1 },
      { seq: 7, name: 'GPON Residential Surabaya', customer: 'Perumahan Citra Harmoni', contract: 'BAKBB/2026/GPN-007', pic: 'Gita Maharani', status: 'COMPUTED', months: 48, category: 'LONG_TERM', start: '2026-07-15', scale: 1.3 },
      { seq: 8, name: 'MPLS Corporate Link Medan', customer: 'PT Sumatera Retail Group', contract: 'BAKBB/2026/MPL-008', pic: 'Hendra Wijaya', status: 'SUBMITTED', months: 24, category: 'MID_TERM', start: '2026-08-15', scale: 1.0 },
      { seq: 9, name: 'Tower BTS Lease Yogyakarta', customer: 'PT Jogja Telekomedia', contract: 'BAKBB/2026/BTS-009', pic: 'Indra Saputra', status: 'SUBMITTED', months: 60, category: 'LONG_TERM', start: '2026-09-15', scale: 1.4 },
      { seq: 10, name: 'Fiber Optic Ring Makassar', customer: 'Pemkot Makassar Smart City', contract: 'BAKBB/2026/FOR-010', pic: 'Joko Santoso', status: 'UNDER_REVIEW', months: 36, category: 'MID_TERM', start: '2026-05-01', scale: 1.15 },
      { seq: 11, name: 'IPTV Content Platform', customer: 'PT Media Nusantara Digital', contract: 'BAKBB/2026/IPT-011', pic: 'Kartika Sari', status: 'UNDER_REVIEW', months: 24, category: 'MID_TERM', start: '2026-06-01', scale: 0.85 },
      { seq: 12, name: 'Satellite Backhaul Kalimantan', customer: 'PT Kalimantan Energy', contract: 'BAKBB/2026/SAT-012', pic: 'Lukman Hakim', status: 'APPROVED_L1', months: 48, category: 'LONG_TERM', start: '2026-04-01', scale: 1.6 },
      { seq: 13, name: 'Enterprise VPN Banking', customer: 'Bank Daerah Nusantara', contract: 'BAKBB/2026/VPN-013', pic: 'Maya Anggraini', status: 'APPROVED_L1', months: 36, category: 'MID_TERM', start: '2026-05-15', scale: 1.25 },
      { seq: 14, name: 'IoT Fleet Tracking Logistics', customer: 'PT Logistik Express Indonesia', contract: 'BAKBB/2026/IOT-014', pic: 'Nanda Pratama', status: 'APPROVED_FINAL', months: 24, category: 'MID_TERM', start: '2026-03-01', scale: 0.95 },
      { seq: 15, name: 'WiFi Campus Education', customer: 'Universitas Nusantara Timur', contract: 'BAKBB/2026/WFI-015', pic: 'Oki Ramadhan', status: 'APPROVED_FINAL', months: 12, category: 'SHORT_TERM', start: '2026-04-15', scale: 0.75 },
      { seq: 16, name: 'Hybrid Cloud Migration SOE', customer: 'PT BUMN Infrastruktur Digital', contract: 'BAKBB/2026/HCM-016', pic: 'Putri Lestari', status: 'DRAFT', months: 60, category: 'LONG_TERM', start: '2026-11-01', scale: 1.8 },
      { seq: 17, name: 'SD-WAN Retail Chain', customer: 'PT Ritel Nusantara Jaya', contract: 'BAKBB/2026/SDW-017', pic: 'Qori Sandria', status: 'COMPUTED', months: 24, category: 'MID_TERM', start: '2026-07-01', scale: 1.05 },
      { seq: 18, name: 'Dark Fiber Lease Toll Road', customer: 'PT Jasa Marga Tbk', contract: 'BAKBB/2026/DFL-018', pic: 'Rizky Aditya', status: 'SUBMITTED', months: 120, category: 'EXTENDED', start: '2026-01-01', scale: 2.0 },
      { seq: 19, name: 'Microwave Link Mining Site', customer: 'PT Tambang Mineral Sejahtera', contract: 'BAKBB/2026/MWL-019', pic: 'Siti Aminah', status: 'REJECTED', months: 12, category: 'SHORT_TERM', start: '2026-08-01', scale: 1.9 },
      { seq: 20, name: 'Data Center Tier III Batam', customer: 'PT Batam Free Trade Zone', contract: 'BAKBB/2026/DCT-020', pic: 'Teguh Permana', status: 'REJECTED', months: 48, category: 'LONG_TERM', start: '2026-09-01', scale: 2.2 },
    ];

    return specs.map((d) => {
      const fin = this._demoFinancials(d.months, d.scale);
      const proj = {
        id: `proj-${d.seq}`,
        project_code: `NAVPRO-2026-${String(d.seq).padStart(4, '0')}`,
        project_name: d.name,
        customer_name: d.customer,
        contract_number: d.contract,
        pic_sales: d.pic,
        status: d.status,
        project_duration_months: d.months,
        duration_category: d.category,
        contract_start_date: d.start,
        wacc_override: null,
        inflation_rate_override: null,
        bcr_threshold_override: null,
        created_by: 'usr-3',
        created_at: '2026-05-27T05:00:00Z',
        ...fin,
        approval_chain: this._demoApprovalChain(d.status),
        versions: [{ version_number: 1, duration_months: d.months, created_at: '2026-05-27T05:00:00Z' }],
      };
      this.runCalculationOnProject(proj);
      if (proj.kpi) {
        proj.versions[0].xirr = proj.kpi.xirr;
        proj.versions[0].xnpv = proj.kpi.xnpv;
        proj.versions[0].bcr = proj.kpi.bcr;
      }
      return proj;
    });
  }

  // Get current system assumptions
  getAssumptions() {
    if (this.useBackend && this.assumptionsCache) return this.assumptionsCache;
    return JSON.parse(localStorage.getItem('kkf_assumptions_master'));
  }

  // Financial Computation Methods
  calculateXNPV(rate, cashflows, dates) {
    let npv = 0;
    const t0 = dates.at(0).getTime();
    for (let i = 0; i < cashflows.length; i++) {
      const t_i = dates.at(i).getTime();
      const t = (t_i - t0) / (365 * 24 * 60 * 60 * 1000);
      npv += cashflows.at(i) / Math.pow(1 + rate, t);
    }
    return npv;
  }

  calculateDXNPV(rate, cashflows, dates) {
    let dnpv = 0;
    const t0 = dates.at(0).getTime();
    for (let i = 0; i < cashflows.length; i++) {
      const t_i = dates.at(i).getTime();
      const t = (t_i - t0) / (365 * 24 * 60 * 60 * 1000);
      dnpv -= t * cashflows.at(i) / Math.pow(1 + rate, t + 1);
    }
    return dnpv;
  }

  // Newton-Raphson Solver with Bisection Fallback for XIRR
  calculateXIRR(cashflows, dates) {
    let r = 0.1; // guess 10%
    const tol = 1e-7;
    const max_iter = 1000;
    
    // Check total sum. If all signs are the same, XIRR has no solution
    let hasPos = false, hasNeg = false;
    for (let cf of cashflows) {
      if (cf > 0) hasPos = true;
      if (cf < 0) hasNeg = true;
    }
    if (!hasPos || !hasNeg) return 0;

    for (let i = 0; i < max_iter; i++) {
      const npv = this.calculateXNPV(r, cashflows, dates);
      const dnpv = this.calculateDXNPV(r, cashflows, dates);
      if (Math.abs(dnpv) < 1e-12) break;
      const rNext = r - npv / dnpv;
      if (Math.abs(rNext - r) < tol) {
        return rNext;
      }
      r = rNext;
    }

    // Bisection fallback if NR fails
    if (isNaN(r) || r < -0.99 || r > 10.0) {
      let low = -0.99;
      let high = 10.0;
      for (let i = 0; i < 100; i++) {
        let mid = (low + high) / 2;
        let npv = this.calculateXNPV(mid, cashflows, dates);
        if (Math.abs(npv) < tol) return mid;
        if (npv > 0) {
          low = mid;
        } else {
          high = mid;
        }
      }
      return (low + high) / 2;
    }

    return r;
  }

  // Compute exact fractional Payback Period in months
  calculatePayback(cumulative_cashflow, net_cashflows) {
    if (cumulative_cashflow.at(0) >= 0) return 0;
    for (let i = 0; i < cumulative_cashflow.length - 1; i++) {
      if (cumulative_cashflow.at(i) < 0 && cumulative_cashflow.at(i + 1) >= 0) {
        const fraction = Math.abs(cumulative_cashflow.at(i)) / (net_cashflows.at(i + 1) || 1);
        return i + fraction;
      }
    }
    return -1; // Never pays back
  }

  // Main cashflow array projector & KPI solver
  runCalculationOnProject(proj) {
    const globalAss = this.getAssumptions();
    const wacc = proj.wacc_override !== null ? proj.wacc_override / 100 : globalAss.wacc_annual / 100;
    
    // Inflation monthly: always derived as compound from annual rate per Excel formula
    // Excel: inflation_monthly = (1 + inflation_annual)^(1/12) - 1
    let inflation;
    if (proj.inflation_rate_override !== null && proj.inflation_rate_override !== undefined) {
      inflation = proj.inflation_rate_override / 100;
    } else if (globalAss.inflation_annual !== undefined) {
      inflation = Math.pow(1 + globalAss.inflation_annual / 100, 1 / 12) - 1;
    } else {
      // Fallback: compound from monthly stored value (legacy)
      inflation = globalAss.inflation_monthly / 100;
    }
    
    // Resolve BCR thresholds
    const bcr_mandatory = proj.bcr_threshold_override?.mandatory || globalAss.bcr_mandatory;
    const bcr_minimum = proj.bcr_threshold_override?.minimum || globalAss.bcr_minimum;

    const N = proj.project_duration_months;
    const start_date = new Date(proj.contract_start_date);
    
    // Generate dates: Month 0 (contract start date) to Month N
    const dates = [];
    for (let m = 0; m <= N; m++) {
      const d = new Date(start_date);
      d.setMonth(d.getMonth() + m);
      dates.push(d);
    }

    // Exchange rate
    const kurs_usd = proj.kurs_usd_override !== null && proj.kurs_usd_override !== undefined ? parseFloat(proj.kurs_usd_override) : (globalAss.kurs_usd || 16500);

    // Sum row-level OTC (or fallback to legacy)
    let otc = 0;
    if (proj.revenue && proj.revenue.length > 0) {
      let hasRowOtc = false;
      for (let r of proj.revenue) {
        if (r.otc !== undefined) {
          const rate_conv = r.currency === 'USD' ? kurs_usd : 1;
          otc += parseFloat(r.otc || 0) * rate_conv;
          hasRowOtc = true;
        }
      }
      if (!hasRowOtc) {
        otc = parseFloat(proj.otc_amount || 0);
      }
    } else {
      otc = parseFloat(proj.otc_amount || 0);
    }

    // Save calculated total OTC back to project
    proj.otc_amount = otc;

    // Calculate total recurring revenue baseline in IDR (converted if USD)
    let total_recurring_revenue_baseline = 0;
    if (proj.revenue) {
      for (let item of proj.revenue) {
        const harsat = parseFloat(item.harsat !== undefined ? item.harsat : (item.monthly_amount || 0));
        const qty = parseFloat(item.qty !== undefined ? item.qty : 1);
        const rate_conv = item.currency === 'USD' ? kurs_usd : 1;
        total_recurring_revenue_baseline += (harsat * qty) * rate_conv;
      }
    }

    // Projections arrays
    const periods = []; // indices 0 to N
    let total_capex_m0 = 0; // CAPEX at Month 0 only (for BCR denominator per Excel)
    
    for (let m = 0; m <= N; m++) {
      const active_flag = (m <= N && m > 0) ? 1 : 0;
      
      // CAPEX sum for period m (converted from USD if needed)
      let capex = 0;
      for (let item of proj.capex) {
        if (item.period === m) {
          const amt = parseFloat(item.amount || 0);
          const rate_conv = item.currency === 'USD' ? kurs_usd : 1;
          capex += amt * rate_conv;
        }
      }
      if (m === 0) total_capex_m0 = capex;

      // OPEX compounding: baseline × (1 + inflation_monthly)^(m - start_period)
      let opex = 0;
      if (active_flag) {
        for (let item of proj.opex) {
          if (m >= item.start_period && m <= item.end_period) {
            let base_amt = 0;
            if (item.is_percent) {
              const coef = parseFloat(item.coefficient_rate || 0);
              base_amt = coef * total_recurring_revenue_baseline;
            } else {
              base_amt = parseFloat(item.baseline_amount || 0);
              const rate_conv = item.currency === 'USD' ? kurs_usd : 1;
              base_amt = base_amt * rate_conv;
            }
            const item_inflation = item.inflation_rate !== undefined ? item.inflation_rate : inflation;
            opex += base_amt * Math.pow(1 + item_inflation, m - item.start_period);
          }
        }
      }

      // REVENUE compounding (recurring monthly, converted from USD if needed)
      let revenue = 0;
      if (active_flag) {
        for (let item of proj.revenue) {
          if (m >= item.start_period && m <= item.end_period) {
            const harsat = parseFloat(item.harsat !== undefined ? item.harsat : (item.monthly_amount || 0));
            const qty = parseFloat(item.qty !== undefined ? item.qty : 1);
            const rate_conv = item.currency === 'USD' ? kurs_usd : 1;
            const baseline = (harsat * qty) * rate_conv;
            
            const item_esc = item.escalation_rate !== undefined ? item.escalation_rate : 0;
            revenue += baseline * Math.pow(1 + item_esc, m - item.start_period);
          }
        }
        // Add OTC at Month 1 (one-time)
        if (m === 1 && otc > 0) {
          revenue += otc;
        }
      }

      const net_cashflow = revenue - opex - capex;
      
      periods.push({
        period_number: m,
        period_date: dates.at(m).toISOString().substring(0, 10),
        revenue: Math.round(revenue),
        otc: m === 1 ? Math.round(otc) : 0, // track OTC separately for display
        opex: Math.round(opex),
        capex: Math.round(capex),
        net_cashflow: Math.round(net_cashflow),
        active_flag: m === 0 ? 1 : active_flag
      });
    }

    // Cumulative Cashflows
    let cum = 0;
    const net_cfs = [];
    for (let m = 0; m <= N; m++) {
      cum += periods.at(m).net_cashflow;
      periods.at(m).cumulative_cashflow = Math.round(cum);
      net_cfs.push(periods.at(m).net_cashflow);
    }

    // NPV, XIRR
    const xnpv_val = this.calculateXNPV(wacc, net_cfs, dates);
    const xirr_val = this.calculateXIRR(net_cfs, dates);
    
    // ─── BCR / Profitability Index ── ALIGNED WITH EXCEL TEMPLATE ───
    const t0 = dates.at(0).getTime();
    let pv_revenue_m1_mn = 0;
    for (let m = 1; m <= N; m++) {
      const t = (dates.at(m).getTime() - t0) / (365 * 24 * 60 * 60 * 1000);
      const discount = Math.pow(1 + wacc, t);
      pv_revenue_m1_mn += periods.at(m).revenue / discount;
    }
    // Use total CAPEX across all periods as denominator if M0 capex is 0
    const capex_denom = total_capex_m0 > 0 ? total_capex_m0 :
      proj.capex.reduce((s, c) => {
        const rate_conv = c.currency === 'USD' ? kurs_usd : 1;
        return s + parseFloat(c.amount || 0) * rate_conv;
      }, 0);
    const bcr_val = capex_denom === 0 ? 0 : (pv_revenue_m1_mn / capex_denom);
    
    // ─── Simple ROI ── Total Net Inflow / |CAPEX| (undiscounted) ───
    let total_net_inflow = 0;
    for (let m = 1; m <= N; m++) {
      total_net_inflow += periods.at(m).net_cashflow;
    }
    const simple_roi = capex_denom === 0 ? 0 : (total_net_inflow / capex_denom);

    const payback_val = this.calculatePayback(periods.map(p => p.cumulative_cashflow), net_cfs);

    // Conclusion Decision Logic (matching Excel 01_Menu!B44 nested IFs)
    let conclusion = 'TIDAK_LAYAK';
    if (xnpv_val > 0 && xirr_val >= wacc && bcr_val >= bcr_mandatory && payback_val > 0 && payback_val < N) {
      conclusion = 'LAYAK';
    } else if (xnpv_val > 0 && xirr_val >= wacc && bcr_val >= bcr_minimum) {
      conclusion = 'BERSYARAT'; // BERSYARAT = LAYAK DENGAN CATATAN
    } else if (xnpv_val > 0 && xirr_val >= wacc && bcr_val > 1) {
      conclusion = 'MARGINAL';
    }

    proj.cashflow_monthly = periods;
    proj.kpi = {
      xirr: isNaN(xirr_val) ? 0 : xirr_val,
      xnpv: xnpv_val,
      bcr: bcr_val,
      simple_roi: simple_roi,
      payback_months: payback_val,
      conclusion: conclusion,
      wacc_used: wacc,
      inflation_used: inflation,
      kurs_usd_used: kurs_usd,
      capex_total: capex_denom,
      calculated_at: new Date().toISOString()
    };
  }

  // Data layer — API or localStorage
  getProjects() {
    if (this.useBackend && this.projectsCache) return this.projectsCache;
    const list = JSON.parse(localStorage.getItem('kkf_projects')) || [];
    list.forEach((p) => this.runCalculationOnProject(p));
    return list;
  }

  _setProjectsCache(list) {
    this.projectsCache = list;
  }

  saveProject(p, opts = {}) {
    const list = this.getProjects().slice();
    const idx = list.findIndex((item) => item.id === p.id);
    if (idx !== -1) list[idx] = p;
    else list.push(p);

    if (this.useBackend && window.navproApi) {
      this._setProjectsCache(list);
      const payload = { ...p };
      const req = idx !== -1
        ? navproApi.updateProject(p.id, payload)
        : navproApi.createProject(payload);
      req
        .then((res) => {
          const saved = res.project;
          const next = this.projectsCache.map((x) => (x.id === saved.id ? saved : x));
          if (!next.find((x) => x.id === saved.id)) next.push(saved);
          this._setProjectsCache(next);
        })
        .catch((err) => console.error('Gagal menyimpan proyek:', err));
      return;
    }

    localStorage.setItem('kkf_projects', JSON.stringify(list));
    if (!opts.silent) this.addAuditLog('SAVE_PROJECT', null, `${p.project_code} - ${p.project_name}`);
  }

  canEditProject(proj) {
    if (!proj) return false;
    const role = this.currentRole;
    const allowedRole = role === 'SA' || role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN';
    const allowedStatus = proj.status === 'DRAFT' || proj.status === 'COMPUTED' || proj.status === 'REJECTED';
    return allowedRole && allowedStatus;
  }

  _formatWizardSavedLabel(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return 'Tersimpan';
    return `Tersimpan ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
  }

  _setWizardIndicator(state, label) {
    const el = document.getElementById('wizard-save-indicator');
    if (!el) return;
    el.classList.remove('is-dirty', 'is-saved');
    if (state === 'dirty') el.classList.add('is-dirty');
    if (state === 'saved') el.classList.add('is-saved');
    el.textContent = label;
  }

  markWizardDirty() {
    this._wizardDirty = true;
    this._setWizardIndicator('dirty', 'Perubahan belum disimpan');
  }

  _bindWizardAutosaveOnce() {
    if (this._wizardAutosaveBound) return;
    const dlg = document.getElementById('project-wizard-dialog');
    if (!dlg) return;

    dlg.addEventListener('input', (ev) => {
      const t = ev.target;
      if (!t || !this.wizardProject) return;
      if (!(t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement)) return;
      if (!t.id || !t.id.startsWith('wiz-')) return;

      this.markWizardDirty();
      this.scheduleWizardAutosave();
    });

    dlg.addEventListener('change', (ev) => {
      const t = ev.target;
      if (!t || !this.wizardProject) return;
      if (!(t instanceof HTMLInputElement || t instanceof HTMLSelectElement)) return;
      if (!t.id || !t.id.startsWith('wiz-')) return;

      this.markWizardDirty();
      this.scheduleWizardAutosave();
    });

    this._wizardAutosaveBound = true;
  }

  _syncWizardInputs({ allowPartial = true } = {}) {
    if (!this.wizardProject) return;

    // Step 1 fields (can be partial for autosave)
    const nameEl = document.getElementById('wiz-proj-name');
    const startEl = document.getElementById('wiz-contract-start');
    const customerEl = document.getElementById('wiz-customer-name');
    const contractNoEl = document.getElementById('wiz-contract-number');
    const picSalesEl = document.getElementById('wiz-pic-sales');

    const name = nameEl ? nameEl.value.trim() : '';
    const start = startEl ? startEl.value : '';
    const customer = customerEl ? customerEl.value.trim() : '';
    const contractNo = contractNoEl ? contractNoEl.value.trim() : '';
    const picSales = picSalesEl ? picSalesEl.value.trim() : '';

    if (!allowPartial) {
      if (name === '' || start === '' || customer === '' || contractNo === '' || picSales === '') return;
    }

    if (nameEl) this.wizardProject.project_name = name;
    if (startEl) this.wizardProject.contract_start_date = start || this.wizardProject.contract_start_date;
    if (customerEl) this.wizardProject.customer_name = customer;
    if (contractNoEl) this.wizardProject.contract_number = contractNo;
    if (picSalesEl) this.wizardProject.pic_sales = picSales;

    // Step 2 duration + overrides (best-effort)
    const presetEl = document.getElementById('wiz-duration-preset');
    const customEl = document.getElementById('wiz-custom-duration-months');
    const waccEl = document.getElementById('wiz-wacc-override');
    const infEl = document.getElementById('wiz-inflation-override');
    const kursEl = document.getElementById('wiz-kurs-usd-override');
    const bcrToggleEl = document.getElementById('wiz-bcr-override-toggle');
    const bcrMandEl = document.getElementById('wiz-bcr-mandatory-override');
    const bcrMinEl = document.getElementById('wiz-bcr-minimum-override');

    if (presetEl) {
      const preset = presetEl.value;
      let months = this.wizardProject.project_duration_months;
      if (preset === 'CUSTOM') {
        const customVal = customEl ? parseInt(customEl.value) : NaN;
        if (!Number.isNaN(customVal) && Number.isInteger(customVal) && customVal >= 1 && customVal <= 120) months = customVal;
      } else {
        const parsed = parseInt(preset);
        if (!Number.isNaN(parsed) && Number.isInteger(parsed) && parsed >= 1 && parsed <= 120) months = parsed;
      }
      this.wizardProject.project_duration_months = months;
      if (months <= 12) this.wizardProject.duration_category = 'SHORT_TERM';
      else if (months <= 36) this.wizardProject.duration_category = 'MID_TERM';
      else if (months <= 60) this.wizardProject.duration_category = 'LONG_TERM';
      else this.wizardProject.duration_category = 'EXTENDED';
    }

    if (waccEl) {
      const v = waccEl.value;
      this.wizardProject.wacc_override = v !== '' && !Number.isNaN(parseFloat(v)) ? parseFloat(v) : null;
    }
    if (infEl) {
      const v = infEl.value;
      this.wizardProject.inflation_rate_override = v !== '' && !Number.isNaN(parseFloat(v)) ? parseFloat(v) : null;
    }
    if (kursEl) {
      const v = kursEl.value;
      this.wizardProject.kurs_usd_override = v !== '' && !Number.isNaN(parseFloat(v)) ? parseFloat(v) : null;
    }

    if (bcrToggleEl) {
      const on = bcrToggleEl.checked;
      if (!on) {
        this.wizardProject.bcr_threshold_override = null;
      } else {
        const mand = bcrMandEl ? parseFloat(bcrMandEl.value) : NaN;
        const min = bcrMinEl ? parseFloat(bcrMinEl.value) : NaN;
        if (!Number.isNaN(mand) && !Number.isNaN(min) && mand >= 0 && min >= 0 && mand >= min) {
          this.wizardProject.bcr_threshold_override = { mandatory: mand, minimum: min };
        }
      }
    }

    // OTC
    const otcEl = document.getElementById('wiz-otc-amount');
    if (otcEl) {
      const otc = parseFloat(otcEl.value || 0);
      if (!Number.isNaN(otc) && otc >= 0) this.wizardProject.otc_amount = otc;
    }
  }

  scheduleWizardAutosave() {
    if (!this.wizardProject) return;
    clearTimeout(this._wizardAutosaveTimer);
    this._wizardAutosaveTimer = setTimeout(() => this.autosaveWizardDraft(), 900);
  }

  async autosaveWizardDraft() {
    if (!this.wizardProject) return;
    if (!this._wizardDirty) return;

    this._syncWizardInputs({ allowPartial: true });

    // Always keep a local safety copy
    try {
      localStorage.setItem('navpro_wizard_draft', JSON.stringify({
        saved_at: new Date().toISOString(),
        wizard_step: this.wizardStep,
        project: this.wizardProject,
      }));
    } catch (_) {}

    // Autosave into projects list only when editable/creating
    const existing = this.getProjectById(this.wizardProject.id);
    const shouldPersist = !existing || this.canEditProject(existing) || existing.status === 'DRAFT';

    if (!shouldPersist) {
      this._wizardDirty = false;
      this._wizardLastSavedAt = new Date().toISOString();
      this._setWizardIndicator('saved', this._formatWizardSavedLabel(this._wizardLastSavedAt));
      return;
    }

    const payload = { ...this.wizardProject, status: 'DRAFT' };

    // Backend: only create after required fields exist (avoid 400)
    if (this.useBackend && window.navproApi) {
      const canCreate = payload.project_name?.trim()
        && payload.contract_start_date?.trim()
        && payload.customer_name?.trim()
        && payload.contract_number?.trim()
        && payload.pic_sales?.trim();

      if (!existing && !this._wizardServerCreated) {
        if (!canCreate) {
          this._setWizardIndicator('dirty', 'Draft lokal (lengkapi Langkah 1 untuk simpan ke server)');
          return;
        }
      }

      try {
        await (existing || this._wizardServerCreated ? navproApi.updateProject(payload.id, payload) : navproApi.createProject(payload));
        this._wizardServerCreated = true;
      } catch (err) {
        this._setWizardIndicator('dirty', 'Gagal simpan (draft lokal)');
        return;
      }

      this._wizardDirty = false;
      this._wizardLastSavedAt = new Date().toISOString();
      this._setWizardIndicator('saved', this._formatWizardSavedLabel(this._wizardLastSavedAt));
      return;
    }

    // Offline/local
    this.saveProject(payload, { silent: true });
    this._wizardDirty = false;
    this._wizardLastSavedAt = new Date().toISOString();
    this._setWizardIndicator('saved', this._formatWizardSavedLabel(this._wizardLastSavedAt));
  }

  getProjectById(id) {
    return this.getProjects().find((p) => p.id === id);
  }

  addAuditLog(action, old_val, new_val) {
    if (this.useBackend) {
      const entry = {
        id: 'log-' + Date.now(),
        timestamp: new Date().toISOString(),
        user: this.getLoggedInUser().full_name,
        action,
        old_val,
        new_val,
      };
      this.auditLogsCache = [entry, ...(this.auditLogsCache || [])].slice(0, 200);
      return;
    }
    const logs = JSON.parse(localStorage.getItem('kkf_audit_logs')) || [];
    logs.unshift({
      id: 'log-' + Date.now() + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      user: this.getLoggedInUser().full_name,
      action,
      old_val,
      new_val,
    });
    localStorage.setItem('kkf_audit_logs', JSON.stringify(logs.slice(0, 200)));
  }

  addNotification(title, body, project_id) {
    if (this.useBackend) {
      const entry = {
        id: 'nt-' + Date.now(),
        timestamp: new Date().toISOString(),
        title,
        body,
        is_read: false,
        project_id,
      };
      this.notificationsCache = [entry, ...(this.notificationsCache || [])].slice(0, 50);
      this.renderNotificationBell();
      return;
    }
    const notifs = JSON.parse(localStorage.getItem('kkf_notifications')) || [];
    notifs.unshift({
      id: 'nt-' + Date.now(),
      timestamp: new Date().toISOString(),
      title,
      body,
      is_read: false,
      project_id,
    });
    localStorage.setItem('kkf_notifications', JSON.stringify(notifs.slice(0, 50)));
    this.renderNotificationBell();
  }

  getLoggedInUser() {
    if (this.useBackend && this.currentUser) return this.currentUser;
    const users = JSON.parse(localStorage.getItem('kkf_users'));
    return users.find((u) => u.role === this.currentRole) || users[0];
  }

  formatRoleLabel(role) {
    return getSafeProperty(NAVPRO.roleLabels, role, role.replace(/_/g, ' '));
  }

  async probeApi() {
    if (!window.navproApi) {
      this.apiAvailable = false;
      this.backendStatus = 'offline';
      return false;
    }
    try {
      const health = await navproApi.health();
      this.apiAvailable = health?.status === 'ok';
      this.backendStatus = this.apiAvailable ? 'online' : 'offline';
      return this.apiAvailable;
    } catch {
      this.apiAvailable = false;
      this.backendStatus = 'offline';
      return false;
    }
  }

  _setLoginStatus(message, type = 'info') {
    const el = document.getElementById('login-api-status');
    if (!el) return;
    el.textContent = message;
    el.className = 'login-api-status' + (type === 'offline' ? ' offline' : type === 'error' ? ' error' : '');
  }

  _showLoginError(message) {
    const el = document.getElementById('login-error');
    if (!el) return;
    if (message) {
      el.textContent = message;
      el.hidden = false;
    } else {
      el.hidden = true;
      el.textContent = '';
    }
  }

  bindLoginForm() {
    const form = document.getElementById('login-form');
    if (!form || form.dataset.bound === '1') return;
    form.dataset.bound = '1';
    form.addEventListener('submit', (e) => this.handleLoginSubmit(e));

    const toggle = document.getElementById('login-password-toggle');
    const passInput = document.getElementById('login-password');
    if (toggle && passInput) {
      toggle.addEventListener('click', () => {
        const show = passInput.type === 'password';
        passInput.type = show ? 'text' : 'password';
        toggle.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
      });
    }

    const remembered = localStorage.getItem('navpro_remember_email');
    if (remembered) {
      const emailEl = document.getElementById('login-email');
      if (emailEl) emailEl.value = remembered;
    }

  }

  _setLoadingStatus(message) {
    const el = document.getElementById('loading-status-text');
    if (el) el.textContent = message;
  }

  showLoadingScreen(message = 'Memuat NAVPRO…') {
    this._loadingStartedAt = Date.now();
    document.body.classList.add('loading-active');
    document.body.classList.remove('auth-locked');
    const screen = document.getElementById('loading-screen');
    if (screen) {
      screen.classList.remove('hidden', 'loading-screen--out');
      screen.setAttribute('aria-busy', 'true');
    }
    this._setLoadingStatus(message);
  }

  async hideLoadingScreen() {
    const screen = document.getElementById('loading-screen');
    const minMs = 750;
    const elapsed = Date.now() - (this._loadingStartedAt || 0);
    if (elapsed < minMs) {
      await new Promise((r) => setTimeout(r, minMs - elapsed));
    }
    if (screen) {
      screen.classList.add('loading-screen--out');
      screen.setAttribute('aria-busy', 'false');
      await new Promise((r) => setTimeout(r, 450));
      screen.classList.add('hidden');
    }
    document.body.classList.remove('loading-active');
  }

  showLoginScreen() {
    document.body.classList.add('auth-locked');
    const login = document.getElementById('login-screen');
    const shell = document.getElementById('app-shell');
    if (login) {
      login.classList.remove('hidden');
      login.setAttribute('aria-hidden', 'false');
    }
    if (shell) {
      shell.classList.add('hidden');
      shell.setAttribute('aria-hidden', 'true');
    }
    this.isAuthenticated = false;
    this.closeUserMenu();
  }

  showAppShell() {
    document.body.classList.remove('auth-locked');
    const login = document.getElementById('login-screen');
    const shell = document.getElementById('app-shell');
    if (login) {
      login.classList.add('hidden');
      login.setAttribute('aria-hidden', 'true');
    }
    if (shell) {
      shell.classList.remove('hidden');
      shell.setAttribute('aria-hidden', 'false');
    }
    this.isAuthenticated = true;
  }

  _updateRoleSwitcherVisibility() {
    const el = document.getElementById('role-switcher-container');
    if (!el) return;
    if (this.useBackend) el.classList.add('hidden');
    else el.classList.remove('hidden');
  }

  updateUserChrome() {
    const user = this.getLoggedInUser();
    if (!user) return;

    document.body.setAttribute('data-role', this.currentRole);
    document.getElementById('user-display-name').innerText = user.full_name;
    document.getElementById('user-display-role').innerText = this.formatRoleLabel(this.currentRole);
    document.getElementById('user-avatar-initial').innerText = user.full_name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    const emailEl = document.getElementById('user-display-email');
    if (emailEl) emailEl.textContent = user.email || '—';

    const selector = document.getElementById('simulated-role-selector');
    if (selector) selector.value = this.currentRole;

    this._updateRoleSwitcherVisibility();
    this._updateBackendIndicator();
  }

  async establishSession(user, { useBackend }) {
    this.currentUser = user;
    this.currentRole = user.role;
    this.useBackend = useBackend;

    if (useBackend) {
      await this.reloadFromBackend();
    } else {
      this.projectsCache = null;
    }

    this.showAppShell();
    this.updateUserChrome();
    this.renderNotificationBell();
  }

  async tryRestoreSession() {
    if (!window.navproApi?.token) return false;

    const apiUp = await this.probeApi();
    if (!apiUp) {
      navproApi.setToken(null);
      return false;
    }

    try {
      const { user } = await navproApi.me();
      await this.establishSession(user, { useBackend: true });
      return true;
    } catch {
      navproApi.setToken(null);
      return false;
    }
  }

  async handleLoginSubmit(e) {
    e.preventDefault();
    this._showLoginError('');

    const email = document.getElementById('login-email')?.value?.trim().toLowerCase();
    const password = document.getElementById('login-password')?.value || '';
    const remember = document.getElementById('login-remember')?.checked;
    const submitBtn = document.getElementById('login-submit-btn');

    if (!email || !password) {
      this._showLoginError('Email dan kata sandi wajib diisi.');
      return;
    }

    if (remember) localStorage.setItem('navpro_remember_email', email);
    else localStorage.removeItem('navpro_remember_email');

    submitBtn.disabled = true;
    submitBtn.classList.add('is-loading');
    submitBtn.setAttribute('aria-busy', 'true');
    this.showLoadingScreen('Masuk ke NAVPRO…');

    try {
      const apiUp = await this.probeApi();

      if (!apiUp) {
        throw new Error(
          'Backend NAVPRO tidak tersedia. Jalankan API (port 4000) dan gunakan aplikasi Next.js di /frontend.'
        );
      }

      this._setLoadingStatus('Memuat data portofolio…');
      const login = await navproApi.login(email, password);
      await this.establishSession(login.user, { useBackend: true });
      await this.hideLoadingScreen();
      this.navigateTo('dashboard');
    } catch (err) {
      await this.hideLoadingScreen();
      this.showLoginScreen();
      this._showLoginError(err.message || 'Login gagal. Periksa email dan kata sandi.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove('is-loading');
      submitBtn.removeAttribute('aria-busy');
    }
  }

  async logout() {
    this.closeUserMenu();

    if (this.useBackend && window.navproApi) {
      await navproApi.logout().catch(() => {});
    }

    navproApi?.setToken(null);
    this.useBackend = false;
    this.currentUser = null;
    this.projectsCache = null;
    this.isAuthenticated = false;

    document.getElementById('notifications-dropdown')?.classList.remove('active');
    this.showLoginScreen();
    this._setLoginStatus(
      this.apiAvailable
        ? 'Server API aktif — silakan masuk kembali.'
        : 'Mode offline — data disimpan di browser.',
      this.apiAvailable ? 'info' : 'offline'
    );
    document.getElementById('login-password')?.focus();
  }

  toggleUserMenu(e) {
    e?.stopPropagation();
    const dropdown = document.getElementById('user-profile-dropdown');
    const btn = document.getElementById('user-profile-btn');
    if (!dropdown || !btn) return;

    this._userMenuOpen = !this._userMenuOpen;
    dropdown.classList.toggle('open', this._userMenuOpen);
    btn.setAttribute('aria-expanded', this._userMenuOpen ? 'true' : 'false');
  }

  closeUserMenu() {
    this._userMenuOpen = false;
    document.getElementById('user-profile-dropdown')?.classList.remove('open');
    document.getElementById('user-profile-btn')?.setAttribute('aria-expanded', 'false');
  }

  async reloadFromBackend() {
    if (!this.useBackend) return;
    const [projRes, assump, presets, cats, notifRes, auditRes, usersRes, sysRes] =
      await Promise.all([
        navproApi.getProjects(),
        navproApi.getAssumptions(),
        navproApi.getPresets(),
        navproApi.getCategories(),
        navproApi.getNotifications(),
        navproApi.adminGetAuditLogs().catch(() => ({ logs: [] })),
        navproApi.adminGetUsers().catch(() => ({ users: [] })),
        navproApi.adminGetSystemConfig().catch(() => ({ config: [] })),
      ]);

    this._setProjectsCache(projRes.projects || []);
    this.assumptionsCache = assump;
    this.presetsCache = presets.presets || [];
    this.categoriesCache = cats;
    this.notificationsCache = notifRes.notifications || [];
    this.auditLogsCache = auditRes.logs || [];
    this.usersCache = usersRes.users || [];

    const sysList = sysRes.config || [];
    this.systemParamsCache = sysList.map((r) => ({
      key: r.config_key,
      val: r.config_val,
      category: r.category,
      type: r.data_type,
      desc: r.description,
    }));

    try {
      const slaRes = await navproApi.adminGetSla();
      this.slaCache = slaRes.sla || [];
    } catch {
      this.slaCache = JSON.parse(localStorage.getItem('kkf_sla_config') || '[]');
    }

    try {
      const histRes = await navproApi.adminGetAssumptionHistory();
      this._assumptionHistoryCache = (histRes.history || []).map((h) => ({
        ...(h.data || h),
        updated_at: h.updated_at,
        updated_by: h.updated_by,
      }));
    } catch {
      this._assumptionHistoryCache = null;
    }
  }

  _updateBackendIndicator() {
    const el = document.getElementById('backend-status-badge');
    if (!el) return;
    if (this.backendStatus === 'online') {
      el.textContent = 'Online';
      el.className = 'backend-status-badge online';
    } else {
      el.textContent = 'Mode Offline';
      el.className = 'backend-status-badge offline';
    }
  }

  _getAuditLogs() {
    return this.useBackend
      ? this.auditLogsCache || []
      : JSON.parse(localStorage.getItem('kkf_audit_logs') || '[]');
  }

  _getNotifications() {
    return this.useBackend
      ? this.notificationsCache || []
      : JSON.parse(localStorage.getItem('kkf_notifications') || '[]');
  }

  _getPresetsList() {
    return this.useBackend
      ? this.presetsCache || []
      : JSON.parse(localStorage.getItem('kkf_presets') || '[]');
  }

  _getCategoriesData() {
    if (this.useBackend && this.categoriesCache) return this.categoriesCache;
    return JSON.parse(localStorage.getItem('kkf_categories') || '{"capex":[],"opex":[]}');
  }

  _getUsersList() {
    return this.useBackend
      ? this.usersCache || []
      : JSON.parse(localStorage.getItem('kkf_users') || '[]');
  }

  _getSystemParamsList() {
    return this.useBackend
      ? this.systemParamsCache || []
      : JSON.parse(localStorage.getItem('kkf_system_params') || '[]');
  }

  _getSlaList() {
    return this.useBackend
      ? this.slaCache || []
      : JSON.parse(localStorage.getItem('kkf_sla_config') || '[]');
  }

  _isMaintenanceMode() {
    if (this.useBackend) {
      const p = (this.systemParamsCache || []).find((x) => x.key === 'maintenance_mode');
      return p?.val === 'true';
    }
    return localStorage.getItem('kkf_maintenance_mode') === 'true';
  }

  // Switch role (offline simulator only)
  async switchRole(role) {
    if (this.useBackend) return;

    this.currentRole = role;
    const users = JSON.parse(localStorage.getItem('kkf_users') || '[]');
    const user = users.find((u) => u.role === role);
    if (user) this.currentUser = user;

    this.updateUserChrome();
    this.renderActivePage();
  }

  // Standard Routing navigation
  navigateTo(page, paramId = null) {
    if (!this.isAuthenticated) return;
    this.activePage = page;
    this.activeParamId = paramId;
    
    // Set active link visually in header
    document.querySelectorAll('.nav-link-btn').forEach(btn => btn.classList.remove('active'));
    const targetBtn = document.getElementById(`nav-${page}-btn`);
    if (targetBtn) targetBtn.classList.add('active');
    
    // Toggle active panel
    document.querySelectorAll('.page-panel').forEach(panel => panel.classList.remove('active'));
    const targetPanel = document.getElementById(`${page}-panel`);
    if (targetPanel) targetPanel.classList.add('active');
    
    this.renderActivePage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  renderActivePage() {
    // Audit log update if needed
    if (this.activePage === 'dashboard') {
      this.renderDashboard();
    } else if (this.activePage === 'projects') {
      this.renderProjectsList();
    } else if (this.activePage === 'approvals') {
      this.renderApprovalsQueuePage();
    } else if (this.activePage === 'project-detail') {
      this.renderProjectDetail(this.activeParamId);
    } else if (this.activePage === 'admin') {
      this.renderAdminCMS();
    }
  }

  async renderApprovalsQueuePage() {
    const summaryEl = document.getElementById('approvals-result-summary');
    const tbody = document.getElementById('approvals-list-body');
    if (!summaryEl || !tbody) return;

    summaryEl.textContent = 'Memuat antrian approval...';
    tbody.innerHTML = '';

    try {
      let items = [];
      if (this.useBackend && window.navproApi) {
        const res = await navproApi.getDashboardApprovalQueue();
        items = res.items || [];
      } else {
        // Offline fallback: reuse role-based filters from dashboard queue
        const projects = this.getProjects();
        const role = this.currentRole;
        const authorName = (createdBy) => this._getUsersList().find((u) => u.id === createdBy)?.full_name || '—';
        if (role === 'MANAGER') items = projects.filter((p) => p.status === 'SUBMITTED' || p.status === 'UNDER_REVIEW').map((p) => ({ project_id: p.id, project_code: p.project_code, project_name: p.project_name, status: p.status, duration_months: p.project_duration_months, created_by: p.created_by, created_by_name: authorName(p.created_by), sla_due_at: null, sla_overdue: false }));
        else if (role === 'GM_SRM') items = projects.filter((p) => p.status === 'APPROVED_L1').map((p) => ({ project_id: p.id, project_code: p.project_code, project_name: p.project_name, status: p.status, duration_months: p.project_duration_months, created_by: p.created_by, created_by_name: authorName(p.created_by), sla_due_at: null, sla_overdue: false }));
        else if (role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN') items = projects.filter((p) => p.status === 'SUBMITTED' || p.status === 'UNDER_REVIEW' || p.status === 'APPROVED_L1').map((p) => ({ project_id: p.id, project_code: p.project_code, project_name: p.project_name, status: p.status, duration_months: p.project_duration_months, created_by: p.created_by, created_by_name: authorName(p.created_by), sla_due_at: null, sla_overdue: false }));
        // compute SLA locally (same logic as dashboard)
        const sla = this._getSlaList();
        const mgrSla = sla.find((s) => s.role_key === 'MANAGER')?.sla_working_days ?? 2;
        const gmSla = sla.find((s) => s.role_key === 'GM_SRM')?.sla_working_days ?? 1;
        items = items.map((it) => {
          const proj = this.getProjectById(it.project_id);
          const submitNode = (proj?.approval_chain || []).find((x) => x.level === 'SUBMIT');
          const l1Node = (proj?.approval_chain || []).find((x) => x.level === 'MANAGER');
          const startTs =
            proj?.status === 'APPROVED_L1'
              ? (l1Node?.decided_at || submitNode?.decided_at || proj?.updated_at || proj?.created_at)
              : (submitNode?.decided_at || proj?.updated_at || proj?.created_at);
          const startDate = startTs ? new Date(startTs) : new Date();
          const slaDays = proj?.status === 'APPROVED_L1' ? gmSla : mgrSla;
          const dueDate = this._addWorkingDays(startDate, slaDays);
          const now = new Date();
          return { ...it, sla_start_at: startDate.toISOString(), sla_due_at: dueDate.toISOString(), sla_overdue: now.getTime() > dueDate.getTime() };
        }).sort((a, b) => new Date(a.sla_due_at).getTime() - new Date(b.sla_due_at).getTime());
      }

      this._approvalsQueueCache = items;
      this.filterApprovalsQueue();
    } catch (err) {
      summaryEl.textContent = 'Gagal memuat antrian approval.';
      tbody.innerHTML = `<tr><td colspan="6" class="text-center">Gagal memuat data: ${escapeHTML(err?.message || 'Unknown error')}</td></tr>`;
    }
  }

  filterApprovalsQueue() {
    const items = (this._approvalsQueueCache || []).slice();
    const q = (document.getElementById('approvals-search-input')?.value || '').toLowerCase().trim();
    const overdueFilter = document.getElementById('approvals-filter-overdue')?.value || '';
    const statusFilter = document.getElementById('approvals-filter-status')?.value || '';

    const filtered = items.filter((it) => {
      const matchesQ = !q || it.project_code.toLowerCase().includes(q) || it.project_name.toLowerCase().includes(q);
      const matchesOverdue =
        !overdueFilter ||
        (overdueFilter === 'OVERDUE' ? !!it.sla_overdue : !it.sla_overdue);
      const matchesStatus = !statusFilter || it.status === statusFilter;
      return matchesQ && matchesOverdue && matchesStatus;
    });

    const summaryEl = document.getElementById('approvals-result-summary');
    if (summaryEl) {
      summaryEl.textContent = filtered.length === 0 ? 'Tidak ada item approval untuk filter ini.' : `Menampilkan ${filtered.length} item approval`;
    }

    const tbody = document.getElementById('approvals-list-body');
    if (!tbody) return;
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center">Tidak ada proyek menunggu approval.</td></tr>`;
      return;
    }

    const html = filtered.map((it) => {
      const due = it.sla_due_at ? new Date(it.sla_due_at).toLocaleDateString('id-ID') : '—';
      const slaStart = it.sla_start_at ? new Date(it.sla_start_at).toLocaleDateString('id-ID') : '—';
      const slaBadge = it.sla_due_at
        ? `<span class="badge ${it.sla_overdue ? 'badge-rejected' : 'badge-review'}">${it.sla_overdue ? 'Overdue' : 'Due'}: ${due}</span>`
        : `<span class="badge badge-secondary">—</span>`;

      const canAct =
        this.currentRole === 'SUPER_ADMIN' ||
        this.currentRole === 'FINANCE_ADMIN' ||
        (this.currentRole === 'MANAGER' && (it.status === 'SUBMITTED' || it.status === 'UNDER_REVIEW')) ||
        (this.currentRole === 'GM_SRM' && it.status === 'APPROVED_L1');

      return `
        <tr>
          <td class="col-code"><span class="project-code">${escapeHTML(it.project_code)}</span></td>
          <td class="col-name"><a href="#" class="project-name-link" onclick="event.preventDefault(); app.navigateTo('project-detail', '${escapeHTML(it.project_id)}')">${escapeHTML(it.project_name)}</a></td>
          <td class="col-date">${escapeHTML(it.created_by_name || '—')}</td>
          <td class="col-duration">${it.duration_months} bln</td>
          <td class="col-status"><span class="badge ${this.getBadgeClassForStatus(it.status)}">${this.formatStatusLabel(it.status)}</span></td>
          <td class="col-date">${slaStart}</td>
          <td class="col-metric-wide">${slaBadge}</td>
          <td class="col-actions">
            <div class="projects-actions">
              <button type="button" class="btn btn-primary btn-xs" onclick="app.navigateTo('project-detail', '${escapeHTML(it.project_id)}')">Review</button>
              ${canAct ? `<button type="button" class="btn btn-secondary btn-xs" onclick="app.quickApproveFromQueue('${escapeHTML(it.project_id)}')">Approve</button>` : ''}
              ${canAct ? `<button type="button" class="btn btn-danger btn-xs" onclick="app.quickRejectFromQueue('${escapeHTML(it.project_id)}')">Reject</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
    tbody.innerHTML = html;
  }

  async quickApproveFromQueue(projectId) {
    const comment = (prompt('Catatan approval (opsional):', 'Disetujui.') || 'Disetujui.').trim() || 'Disetujui.';
    if (this.useBackend && window.navproApi) {
      try {
        await navproApi.approveProject(projectId, comment);
        await this.reloadFromBackend();
        if (this.activePage === 'approvals') await this.renderApprovalsQueuePage();
        alert('Berhasil approve.');
      } catch (err) {
        alert(err?.data?.message || err.message || 'Gagal approve');
      }
      return;
    }
    const proj = this.getProjectById(projectId);
    if (!proj) return;
    this.executeWorkflowDecision(proj, true, comment);
    if (this.activePage === 'approvals') this.renderApprovalsQueuePage();
  }

  async quickRejectFromQueue(projectId) {
    const comment = (prompt('Catatan penolakan (wajib):', '') || '').trim();
    if (!comment) {
      alert('Catatan penolakan wajib diisi.');
      return;
    }
    if (this.useBackend && window.navproApi) {
      try {
        await navproApi.rejectProject(projectId, comment);
        await this.reloadFromBackend();
        if (this.activePage === 'approvals') await this.renderApprovalsQueuePage();
        alert('Berhasil reject.');
      } catch (err) {
        alert(err?.data?.message || err.message || 'Gagal reject');
      }
      return;
    }
    const proj = this.getProjectById(projectId);
    if (!proj) return;
    this.executeWorkflowDecision(proj, false, comment);
    if (this.activePage === 'approvals') this.renderApprovalsQueuePage();
  }

  // Format Helper methods
  formatCurrency(value) {
    return 'Rp ' + Math.round(value).toLocaleString('id-ID');
  }

  formatPercent(value) {
    return (value * 100).toFixed(2) + '%';
  }

  // VIEW 1: EXECUTIVE DASHBOARD RENDERS
  renderDashboard() {
    const projects = this.getProjects();
    
    // 1. Fill statistics KPI numbers
    document.getElementById('dash-kpi-total-projects').innerText = projects.length;
    const approvedCount = projects.filter(p => p.status === 'APPROVED_FINAL').length;
    document.getElementById('dash-kpi-approved-projects').innerText = approvedCount;
    
    // Under review total contains SUBMITTED and UNDER_REVIEW
    const underReviewCount = projects.filter(p => p.status === 'SUBMITTED' || p.status === 'UNDER_REVIEW' || p.status === 'APPROVED_L1').length;
    document.getElementById('dash-kpi-pending-projects').innerText = underReviewCount;
    const rejectedCount = projects.filter(p => p.status === 'REJECTED').length;
    document.getElementById('dash-kpi-rejected-projects').innerText = rejectedCount;

    const draftCount = projects.filter(p => p.status === 'DRAFT' || p.status === 'COMPUTED').length;
    const totalTrendEl = document.getElementById('dash-kpi-total-trend');
    if (totalTrendEl) {
      totalTrendEl.textContent = projects.length === 0
        ? 'Belum ada proyek'
        : (draftCount > 0 ? `${draftCount} masih draf` : `${projects.length} terdaftar`);
    }

    const approvedRateEl = document.getElementById('dash-kpi-approved-rate');
    if (approvedRateEl) {
      approvedRateEl.textContent = projects.length > 0
        ? `${Math.round((approvedCount / projects.length) * 100)}% dari portofolio`
        : '—';
    }

    const pendingNoteEl = document.getElementById('dash-kpi-pending-note');
    if (pendingNoteEl) {
      pendingNoteEl.textContent = underReviewCount > 0
        ? `${underReviewCount} perlu tindakan`
        : 'Tidak ada antrian';
    }

    const rejectedNoteEl = document.getElementById('dash-kpi-rejected-note');
    if (rejectedNoteEl) {
      rejectedNoteEl.textContent = rejectedCount > 0
        ? `${rejectedCount} perlu revisi`
        : 'Semua clear';
    }
    
    // 2. Render 2D Project Category Heatmap Grid Matrix
    this.render2DHeatmap(projects);
    
    // 3. Render Cost & Revenue Interactive Chart
    this.updateCostRevChart();
    
    // 3. Render recent activities logs with color-coded fresh badges
    const getActionBadgeHtml = (action) => {
      switch (action) {
        case 'CREATE_PROJECT':
          return `<span class="badge" style="font-size:0.6rem; vertical-align:middle; margin-right:0.35rem; background-color: rgba(16, 185, 129, 0.12); color: var(--accent-green); border: 1px solid rgba(16, 185, 129, 0.3);">CREATE</span>`;
        case 'CALCULATE':
          return `<span class="badge" style="font-size:0.6rem; vertical-align:middle; margin-right:0.35rem; background-color: var(--primary-glow); color: var(--primary); border: 1px solid rgba(59, 130, 246, 0.3);">CALC</span>`;
        case 'SAVE_PROJECT':
          return `<span class="badge" style="font-size:0.6rem; vertical-align:middle; margin-right:0.35rem; background-color: rgba(59, 130, 246, 0.12); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3);">SAVE</span>`;
        case 'APPROVE_L1':
        case 'APPROVE_FINAL':
          return `<span class="badge" style="font-size:0.6rem; vertical-align:middle; margin-right:0.35rem; background-color: var(--accent-green-glow); color: var(--accent-green); border: 1px solid rgba(16, 185, 129, 0.3);">APPROVE</span>`;
        case 'REJECT':
          return `<span class="badge" style="font-size:0.6rem; vertical-align:middle; margin-right:0.35rem; background-color: var(--accent-red-glow); color: var(--accent-red); border: 1px solid rgba(239, 68, 68, 0.3);">REJECT</span>`;
        default:
          return `<span class="badge badge-draft" style="font-size:0.6rem; vertical-align:middle; margin-right:0.35rem;">${action}</span>`;
      }
    };

    const logs = this._getAuditLogs();
    const logsHtml = logs.slice(0, 6).map(log => {
      const d = new Date(log.timestamp);
      const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
      return `
        <tr>
          <td style="color:var(--text-secondary); font-size:0.75rem;">${timeStr}</td>
          <td><strong>${escapeHTML(log.user)}</strong></td>
          <td>${getActionBadgeHtml(log.action)} <span style="font-size:0.8rem;">${escapeHTML(log.new_val)}</span></td>
        </tr>
      `;
    }).join('');
    const auditTbody = document.getElementById('dashboard-audit-logs');
    if (auditTbody) {
      auditTbody.innerHTML =
        logsHtml || '<tr><td colspan="3" class="text-center">Belum ada aktivitas tercatat</td></tr>';
    }

    // 4. Load Approvals Queue based on current role permissions
    this.renderApprovalQueueTable(projects);
  }

  // Helpers for Heatmap and cost calculation
  getProjectCapexTotal(p) {
    if (!p.capex) return 0;
    return p.capex.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
  }

  getProjectSeverity(p) {
    const capex = this.getProjectCapexTotal(p);
    if (capex < 100000000) return 'LOW';
    if (capex < 500000000) return 'MEDIUM';
    return 'HIGH';
  }

  getProjectLikelihood(p) {
    if (!p.kpi) return 'LOW';
    const bcr = p.kpi.bcr || 0;
    const xirr = p.kpi.xirr || 0;
    const wacc = p.kpi.wacc_used || 0.0972; // default 9.72%
    
    // Low failure risk: BCR >= 1.23 and IRR >= WACC
    if (bcr >= 1.23 && xirr >= wacc) {
      return 'LOW';
    }
    // High failure risk: BCR < 1.08 or XIRR is negative / very low
    if (bcr < 1.08 || xirr < (wacc - 0.02) || p.status === 'REJECTED') {
      return 'HIGH';
    }
    // Else: Medium failure risk
    return 'MEDIUM';
  }

  render2DHeatmap(projects) {
    const container = document.getElementById('heatmap-grid-container');
    if (!container) return;

    // Define the matrix dimensions
    const severityRows = [
      { key: 'HIGH', label: 'Tinggi (≥500M)' },
      { key: 'MEDIUM', label: 'Sedang (100M–500M)' },
      { key: 'LOW', label: 'Rendah (<100M)' }
    ];

    const likelihoodCols = [
      { key: 'LOW', label: 'Rendah' },
      { key: 'MEDIUM', label: 'Sedang' },
      { key: 'HIGH', label: 'Tinggi' }
    ];

    // Compute cell counts and matching projects
    const gridData = {};
    severityRows.forEach(row => {
      Reflect.set(gridData, row.key, {});
      likelihoodCols.forEach(col => {
        Reflect.set(Reflect.get(gridData, row.key), col.key, []);
      });
    });

    projects.forEach(p => {
      const severity = this.getProjectSeverity(p);
      const likelihood = this.getProjectLikelihood(p);
      
      // Safety checks
      const sevObj = Reflect.get(gridData, severity);
      if (sevObj) {
        const list = Reflect.get(sevObj, likelihood);
        if (list) {
          list.push(p);
        }
      }
    });

    // Build the risk matrix table HTML
    let tableHtml = `
      <table class="heatmap-grid-table">
        <thead>
          <tr>
            <th></th> <!-- Rotated axis column spacer -->
            <th></th> <!-- Row label spacer -->
            <th title="Tingkat kemungkinan risiko">Kemungkinan: Rendah</th>
            <th title="Tingkat kemungkinan risiko">Kemungkinan: Sedang</th>
            <th title="Tingkat kemungkinan risiko">Kemungkinan: Tinggi</th>
          </tr>
        </thead>
        <tbody>
    `;

    // Severity mapping to static risk classes
    const riskClasses = {
      'HIGH': {
        'LOW': 'risk-medium',
        'MEDIUM': 'risk-high',
        'HIGH': 'risk-critical'
      },
      'MEDIUM': {
        'LOW': 'risk-low',
        'MEDIUM': 'risk-medium',
        'HIGH': 'risk-high'
      },
      'LOW': {
        'LOW': 'risk-very-low',
        'MEDIUM': 'risk-low',
        'HIGH': 'risk-medium'
      }
    };

    severityRows.forEach((row, idx) => {
      tableHtml += `<tr>`;
      
      // Rotated axis label rendered only in the first row with rowspan
      if (idx === 0) {
        tableHtml += `
          <td class="rotated-axis-label" rowspan="3">
            Dampak (Severity)
          </td>
        `;
      }

      tableHtml += `
          <td class="heatmap-label-cell" title="Tingkat keparahan dampak finansial">${row.label}</td>
      `;

      likelihoodCols.forEach(col => {
        const matches = Reflect.get(Reflect.get(gridData, row.key), col.key);
        const count = matches.length;
        const riskClass = Reflect.get(Reflect.get(riskClasses, row.key), col.key);
        
        let badgeHtml = `<span class="risk-count-badge empty-cell">0</span>`;
        if (count > 0) {
          badgeHtml = `<span class="risk-count-badge">${count}</span>`;
        }

        // Format browser native tooltip details
        let tooltipText = `Severity: ${row.label}\nLikelihood: ${col.label}\nJumlah Proyek: ${count} proyek`;
        if (count > 0) {
          tooltipText += `\n\nDaftar Proyek:\n` + matches.map(p => {
            const capexVal = this.getProjectCapexTotal(p);
            return `• ${escapeHTML(p.project_code)}: ${escapeHTML(p.project_name)} (${this.formatCurrency(capexVal)})`;
          }).join('\n');
        }

        tableHtml += `
          <td class="heatmap-cell ${riskClass}" 
              title="${tooltipText.replace(/"/g, '&quot;')}" 
              onclick="app.filterByRiskCell('${row.key}', '${col.key}')">
            ${badgeHtml}
          </td>
        `;
      });

      tableHtml += `
        </tr>
      `;
    });

    tableHtml += `
        </tbody>
      </table>
      <div style="text-align: center; font-size: 0.65rem; color: var(--text-secondary); font-weight: 600; margin-top: 0.25rem;">
        Kemungkinan Risiko (Likelihood)
      </div>
    `;

    container.innerHTML = tableHtml;
  }

  filterByRiskCell(severity, likelihood) {
    // Navigate to projects panel
    this.navigateTo('projects');
    
    // Set UI filters
    const statusSelect = document.getElementById('project-filter-status');
    const severitySelect = document.getElementById('project-filter-severity');
    const likelihoodSelect = document.getElementById('project-filter-likelihood');
    const searchInput = document.getElementById('project-search-input');
    
    if (statusSelect) statusSelect.value = ''; // Reset status
    if (searchInput) searchInput.value = ''; // Reset search
    if (severitySelect) severitySelect.value = severity;
    if (likelihoodSelect) likelihoodSelect.value = likelihood;
    
    // Trigger list update
    this.filterProjects();
  }

  updateCostRevChart() {
    const canvas = document.getElementById('cost-revenue-chart-canvas');
    if (!canvas) return;
    
    const metric = document.getElementById('cost-rev-metric').value;
    const chartType = document.getElementById('cost-rev-type').value;
    
    const projects = this.getProjects();
    
    // Destroy previous instance if it exists
    if (this.costRevChart) {
      this.costRevChart.destroy();
      this.costRevChart = null;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Aggregate values
    if (metric === 'portfolio_aggregate') {
      let totalCapex = 0;
      let totalOpex = 0;
      let totalRevenue = 0;
      
      projects.forEach(p => {
        // Sum Capex
        totalCapex += this.getProjectCapexTotal(p);
        
        // Sum Opex & Revenue over periods
        if (p.cashflow_monthly) {
          p.cashflow_monthly.forEach(period => {
            totalOpex += period.opex || 0;
            totalRevenue += period.revenue || 0;
          });
        }
      });
      
      const data = {
        labels: ['CAPEX', 'OPEX', 'Revenue'],
        datasets: [{
          label: 'Total Nilai (Rupiah)',
          data: [totalCapex, totalOpex, totalRevenue],
          backgroundColor: [
            'rgba(27, 46, 88, 0.85)',
            'rgba(76, 139, 209, 0.75)',
            'rgba(16, 185, 129, 0.75)'
          ],
          borderColor: [
            'rgb(27, 46, 88)',
            'rgb(76, 139, 209)',
            'rgb(16, 185, 129)'
          ],
          borderWidth: 1.5
        }]
      };
      
      const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: chartType === 'doughnut',
            position: 'bottom',
            labels: {
              boxWidth: 12,
              font: { size: 10, family: 'Outfit' }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                let label = context.label || '';
                if (label) label += ': ';
                label += this.formatCurrency(context.raw);
                return label;
              }
            }
          }
        },
        scales: chartType === 'doughnut' ? {} : {
          y: {
            beginAtZero: true,
            ticks: {
              font: { size: 8, family: 'Outfit' },
              callback: (value) => {
                if (value >= 1e9) return (value / 1e9).toFixed(1) + 'B';
                if (value >= 1e6) return (value / 1e6).toFixed(0) + 'M';
                return value;
              }
            }
          },
          x: {
            ticks: {
              font: { size: 9, family: 'Outfit' }
            }
          }
        }
      };
      
      this.costRevChart = new Chart(ctx, {
        type: chartType,
        data: data,
        options: options
      });
      
    } else {
      // project_comparison
      const labels = [];
      const capexData = [];
      const opexData = [];
      const revData = [];
      
      projects.forEach(p => {
        labels.push(p.project_code);
        capexData.push(this.getProjectCapexTotal(p));
        
        let projOpex = 0;
        let projRev = 0;
        if (p.cashflow_monthly) {
          p.cashflow_monthly.forEach(period => {
            projOpex += period.opex || 0;
            projRev += period.revenue || 0;
          });
        }
        opexData.push(projOpex);
        revData.push(projRev);
      });
      
      let datasets = [];
      if (chartType === 'doughnut') {
        const totals = projects.map((p, idx) => capexData.at(idx) + opexData.at(idx));
        datasets = [{
          label: 'Total Biaya (CAPEX + OPEX)',
          data: totals,
          backgroundColor: projects.map((p, idx) => {
            const hues = [39, 140, 200, 280, 330];
            return `hsla(${hues.at(idx % hues.length)}, 70%, 55%, 0.75)`;
          }),
          borderWidth: 1
        }];
      } else {
        datasets = [
          {
            label: 'CAPEX',
            data: capexData,
            backgroundColor: 'rgba(239, 68, 68, 0.75)',
            borderColor: 'rgb(239, 68, 68)',
            borderWidth: 1.5,
            tension: 0.1
          },
          {
            label: 'OPEX',
            data: opexData,
            backgroundColor: 'rgba(245, 158, 11, 0.75)',
            borderColor: 'rgb(245, 158, 11)',
            borderWidth: 1.5,
            tension: 0.1
          },
          {
            label: 'Revenue',
            data: revData,
            backgroundColor: 'rgba(16, 185, 129, 0.75)',
            borderColor: 'rgb(16, 185, 129)',
            borderWidth: 1.5,
            tension: 0.1
          }
        ];
      }
      
      const data = {
        labels: labels,
        datasets: datasets
      };
      
      const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              font: { size: 8, family: 'Outfit' }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                label += this.formatCurrency(context.raw);
                return label;
              }
            }
          }
        },
        scales: chartType === 'doughnut' ? {} : {
          y: {
            beginAtZero: true,
            ticks: {
              font: { size: 8, family: 'Outfit' },
              callback: (value) => {
                if (value >= 1e9) return (value / 1e9).toFixed(1) + 'B';
                if (value >= 1e6) return (value / 1e6).toFixed(0) + 'M';
                return value;
              }
            }
          },
          x: {
            ticks: {
              font: { size: 8, family: 'Outfit' }
            }
          }
        }
      };
      
      this.costRevChart = new Chart(ctx, {
        type: chartType,
        data: data,
        options: options
      });
    }
  }

  renderApprovalQueueTable(projects) {
    const queueBody = document.getElementById('dashboard-approval-queue');
    if (!queueBody) return;
    const role = this.currentRole;
    
    // Filters projects requiring approval at this specific user's level
    let filtered = [];
    if (role === 'MANAGER') {
      filtered = projects.filter(p => p.status === 'SUBMITTED' || p.status === 'UNDER_REVIEW');
    } else if (role === 'GM_SRM') {
      filtered = projects.filter(p => p.status === 'APPROVED_L1');
    } else if (role === 'SUPER_ADMIN') {
      // Super admin sees everything waiting
      filtered = projects.filter(p => p.status === 'SUBMITTED' || p.status === 'UNDER_REVIEW' || p.status === 'APPROVED_L1');
    }
    
    // Update Badge and Pulse elements in layout
    const badgeCount = document.getElementById('approval-queue-badge-count');
    const pulseInd = document.getElementById('approval-queue-pulse');
    const cardEl = document.getElementById('dashboard-approval-card');
    const instEl = document.getElementById('approval-queue-instructions');
    
    if (badgeCount) {
      if (filtered.length > 0) {
        badgeCount.innerText = `${filtered.length} Pending`;
        badgeCount.style.display = 'inline-flex';
        if (pulseInd) pulseInd.style.display = 'inline-block';
        if (cardEl) cardEl.classList.add('has-pending-actions');
        if (instEl) {
          instEl.innerHTML = `<strong>Tindakan segera diperlukan!</strong> Ada ${filtered.length} usulan proyek menunggu keputusan kelayakan finansial Anda.`;
          instEl.style.color = 'var(--accent-red)';
        }
      } else {
        badgeCount.style.display = 'none';
        if (pulseInd) pulseInd.style.display = 'none';
        if (cardEl) cardEl.classList.remove('has-pending-actions');
        if (instEl) {
          instEl.innerText = 'Tidak ada usulan proyek dalam antrian persetujuan untuk role Anda saat ini.';
          instEl.style.color = 'var(--text-secondary)';
        }
      }
    }
    
    const html = filtered.map(p => {
      const author = this._getUsersList().find(u => u.id === p.created_by)?.full_name || 'Solution Architect';

      const sla = this._getSlaList();
      const mgrSla = sla.find((s) => s.role_key === 'MANAGER')?.sla_working_days ?? 2;
      const gmSla = sla.find((s) => s.role_key === 'GM_SRM')?.sla_working_days ?? 1;

      const submitNode = (p.approval_chain || []).find((x) => x.level === 'SUBMIT');
      const l1Node = (p.approval_chain || []).find((x) => x.level === 'MANAGER');
      const startTs =
        p.status === 'APPROVED_L1'
          ? (l1Node?.decided_at || submitNode?.decided_at || p.updated_at || p.created_at)
          : (submitNode?.decided_at || p.updated_at || p.created_at);
      const startDate = startTs ? new Date(startTs) : new Date();
      const slaDays = p.status === 'APPROVED_L1' ? gmSla : mgrSla;
      const dueDate = this._addWorkingDays(startDate, slaDays);
      const now = new Date();
      const isOverdue = now.getTime() > dueDate.getTime();
      const slaLabel = `${dueDate.toLocaleDateString('id-ID')} • ${slaDays} hari`;
      const slaBadge = `<span class="badge ${isOverdue ? 'badge-rejected' : 'badge-review'}" title="Due date SLA">${isOverdue ? 'Overdue' : 'Due'}: ${slaLabel}</span>`;
      return `
        <tr>
          <td><strong>${escapeHTML(p.project_code)}</strong></td>
          <td><a href="#" onclick="event.preventDefault(); app.navigateTo('project-detail', '${escapeHTML(p.id)}')">${escapeHTML(p.project_name)}</a></td>
          <td>${escapeHTML(author)}</td>
          <td>${p.project_duration_months} Bulan</td>
          <td><span class="badge ${this.getBadgeClassForStatus(p.status)}">${escapeHTML(p.status)}</span></td>
          <td>${slaBadge}</td>
          <td>
            <button class="btn btn-primary btn-sm btn-review-pulse" onclick="app.navigateTo('project-detail', '${escapeHTML(p.id)}')">Review Kelayakan</button>
          </td>
        </tr>
      `;
    }).join('');
    
    queueBody.innerHTML = html || `<tr><td colspan="7" class="text-center" style="color:var(--text-muted); padding: 1.5rem;">Tidak ada proyek dalam antrian persetujuan untuk role Anda saat ini.</td></tr>`;
  }

  _addWorkingDays(date, days) {
    const d = new Date(date);
    let left = Math.max(0, parseInt(days, 10) || 0);
    while (left > 0) {
      d.setDate(d.getDate() + 1);
      const day = d.getDay(); // 0 Sun, 6 Sat
      if (day !== 0 && day !== 6) left -= 1;
    }
    return d;
  }

  getBadgeClassForStatus(status) {
    switch (status) {
      case 'DRAFT': return 'badge-draft';
      case 'COMPUTED': return 'badge-computed';
      case 'SUBMITTED': return 'badge-submitted';
      case 'UNDER_REVIEW': return 'badge-review';
      case 'APPROVED_L1': return 'badge-l1';
      case 'APPROVED_FINAL': return 'badge-approved';
      case 'REJECTED': return 'badge-rejected';
      case 'ARCHIVED': return 'badge-archived';
      default: return 'badge-draft';
    }
  }

  // VIEW 2: PROJECT LIST RENDERS
  renderProjectsList() {
    this.filterProjects();
  }

  formatStatusLabel(status) {
    return getSafeProperty(NAVPRO.statusLabels, status, status);
  }

  formatRiskLabel(level) {
    return getSafeProperty(NAVPRO.riskLabels, level, level);
  }

  getRiskBadgeClass(level) {
    if (level === 'HIGH') return 'risk-chip--high';
    if (level === 'MEDIUM') return 'risk-chip--medium';
    return 'risk-chip--low';
  }

  getFilteredProjects() {
    const searchVal = document.getElementById('project-search-input').value.toLowerCase().trim();
    const statusVal = document.getElementById('project-filter-status').value;
    const severitySelect = document.getElementById('project-filter-severity');
    const likelihoodSelect = document.getElementById('project-filter-likelihood');
    const severityVal = severitySelect ? severitySelect.value : '';
    const likelihoodVal = likelihoodSelect ? likelihoodSelect.value : '';

    return this.getProjects().filter((project) => {
      const matchesSearch = project.project_name.toLowerCase().includes(searchVal)
        || project.project_code.toLowerCase().includes(searchVal);
      const matchesStatus = statusVal === '' || project.status === statusVal;
      const matchesSeverity = severityVal === '' || this.getProjectSeverity(project) === severityVal;
      const matchesLikelihood = likelihoodVal === '' || this.getProjectLikelihood(project) === likelihoodVal;
      return matchesSearch && matchesStatus && matchesSeverity && matchesLikelihood;
    });
  }

  _renderProjectListActions(project) {
    return `
      <div class="projects-actions">
        <button
          type="button"
          class="btn btn-secondary btn-icon-only projects-eye-btn"
          title="Lihat detail"
          aria-label="Lihat detail"
          onclick="app.navigateTo('project-detail', '${project.id}')"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </div>
    `;
  }

  goToProjectsPage(page) {
    const filtered = this.getFilteredProjects();
    const totalPages = Math.max(1, Math.ceil(filtered.length / this.projectsPageSize));
    this.projectsPage = Math.min(Math.max(1, page), totalPages);
    this.renderProjectsTable(filtered);
  }

  renderProjectsPagination(totalItems) {
    const paginationEl = document.getElementById('projects-pagination');
    const summaryEl = document.getElementById('projects-result-summary');
    if (!paginationEl || !summaryEl) return;

    const totalPages = Math.max(1, Math.ceil(totalItems / this.projectsPageSize));
    if (this.projectsPage > totalPages) this.projectsPage = totalPages;

    const start = totalItems === 0 ? 0 : (this.projectsPage - 1) * this.projectsPageSize + 1;
    const end = Math.min(this.projectsPage * this.projectsPageSize, totalItems);

    summaryEl.textContent = totalItems === 0
      ? 'Tidak ada proyek yang cocok dengan filter'
      : `Menampilkan ${start}–${end} dari ${totalItems} proyek`;

    if (totalItems === 0) {
      paginationEl.innerHTML = '';
      return;
    }

    const pageButtons = [];
    const maxVisible = 5;
    let startPage = Math.max(1, this.projectsPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    startPage = Math.max(1, endPage - maxVisible + 1);

    for (let page = startPage; page <= endPage; page += 1) {
      pageButtons.push(`
        <button
          type="button"
          class="pagination-page${page === this.projectsPage ? ' is-active' : ''}"
          onclick="app.goToProjectsPage(${page})"
          ${page === this.projectsPage ? 'aria-current="page"' : ''}
        >${page}</button>
      `);
    }

    paginationEl.innerHTML = `
      <div class="pagination-info">Halaman ${this.projectsPage} dari ${totalPages}</div>
      <div class="pagination-controls">
        <button type="button" class="btn btn-secondary btn-sm pagination-btn" onclick="app.goToProjectsPage(${this.projectsPage - 1})" ${this.projectsPage <= 1 ? 'disabled' : ''}>Sebelumnya</button>
        <div class="pagination-pages">${pageButtons.join('')}</div>
        <button type="button" class="btn btn-secondary btn-sm pagination-btn" onclick="app.goToProjectsPage(${this.projectsPage + 1})" ${this.projectsPage >= totalPages ? 'disabled' : ''}>Selanjutnya</button>
      </div>
    `;
  }

  renderProjectsTable(filtered) {
    const listBody = document.getElementById('projects-list-body');
    const totalItems = filtered.length;
    const startIndex = (this.projectsPage - 1) * this.projectsPageSize;
    const pageItems = filtered.slice(startIndex, startIndex + this.projectsPageSize);

    this.renderProjectsPagination(totalItems);

    if (pageItems.length === 0) {
      listBody.innerHTML = `
        <tr>
          <td colspan="11" class="projects-empty-state">
            <strong>Tidak ada proyek ditemukan</strong>
            <span>Ubah kata kunci pencarian atau filter untuk melihat hasil lain.</span>
          </td>
        </tr>
      `;
      return;
    }

    const html = pageItems.map((project) => {
      const xirrLabel = project.kpi?.xirr != null ? this.formatPercent(project.kpi.xirr) : '—';
      const xnpvLabel = project.kpi?.xnpv != null ? this.formatCurrency(project.kpi.xnpv) : '—';
      const bcrLabel = project.kpi?.bcr != null ? project.kpi.bcr.toFixed(2) : '—';
      const severity = this.getProjectSeverity(project);
      const likelihood = this.getProjectLikelihood(project);

      return `
        <tr>
          <td class="col-code"><span class="project-code">${escapeHTML(project.project_code)}</span></td>
          <td class="col-name">
            <a href="#" class="project-name-link" onclick="event.preventDefault(); app.navigateTo('project-detail', '${escapeHTML(project.id)}')">${escapeHTML(project.project_name)}</a>
          </td>
          <td class="col-date">${new Date(project.contract_start_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
          <td class="col-duration">${project.project_duration_months} bln</td>
          <td class="col-risk col-impact"><span class="risk-chip ${this.getRiskBadgeClass(severity)}">${this.formatRiskLabel(severity)}</span></td>
          <td class="col-risk col-likelihood"><span class="risk-chip ${this.getRiskBadgeClass(likelihood)}">${this.formatRiskLabel(likelihood)}</span></td>
          <td class="col-status"><span class="badge ${this.getBadgeClassForStatus(project.status)}">${this.formatStatusLabel(project.status)}</span></td>
          <td class="col-metric">${xirrLabel}</td>
          <td class="col-metric col-metric-wide">${xnpvLabel}</td>
          <td class="col-metric">${bcrLabel}</td>
          <td class="col-actions">
            ${this._renderProjectListActions(project)}
          </td>
        </tr>
      `;
    }).join('');

    listBody.innerHTML = html;
  }

  filterProjects() {
    this.projectsPage = 1;
    const filtered = this.getFilteredProjects();
    this.renderProjectsTable(filtered);
  }

  // VIEW 3: PROJECT DETAIL RENDERS
  renderProjectDetail(id) {
    const proj = this.getProjectById(id);
    if (!proj) {
      alert('Proyek tidak ditemukan!');
      this.navigateTo('projects');
      return;
    }

    this._renderProjectDetailWithData(proj, { viewingVersion: null });
  }

  _renderProjectDetailWithData(proj, { viewingVersion }) {
    // Header info
    document.getElementById('detail-project-name').innerText = proj.project_name;
    document.getElementById('detail-project-code-meta').innerText = `Kode Proyek: ${proj.project_code} | Mulai Kontrak: ${new Date(proj.contract_start_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    
    // Customer & contract identity info
    const customerMetaEl = document.getElementById('detail-project-customer-meta');
    if (customerMetaEl) {
      const parts = [];
      if (proj.customer_name) parts.push(`Pelanggan: ${proj.customer_name}`);
      if (proj.contract_number) parts.push(`Kontrak: ${proj.contract_number}`);
      if (proj.pic_sales) parts.push(`PIC Sales: ${proj.pic_sales}`);
      customerMetaEl.innerText = parts.join(' | ');
    }
    
    const statusBadge = document.getElementById('detail-project-status');
    statusBadge.innerText = this.formatStatusLabel(proj.status);
    statusBadge.className = `badge ${this.getBadgeClassForStatus(proj.status)}`;

    const verBadge = document.getElementById('detail-version-badge');
    if (verBadge) {
      if (viewingVersion) {
        verBadge.classList.remove('hidden');
        verBadge.innerText = `Versi ${viewingVersion}`;
      } else {
        verBadge.classList.add('hidden');
        verBadge.innerText = 'Versi —';
      }
    }

    // Render KPI Cards
    const kpi = proj.kpi || {};
    document.getElementById('detail-kpi-xirr').innerText = kpi.xirr ? this.formatPercent(kpi.xirr) : '0.00%';
    document.getElementById('detail-kpi-xnpv').innerText = kpi.xnpv ? this.formatCurrency(kpi.xnpv) : 'Rp 0';
    document.getElementById('detail-kpi-bcr').innerText = kpi.bcr ? kpi.bcr.toFixed(3) : '0.000';
    
    // Simple ROI — Net Inflow / CAPEX (undiscounted), per Excel formula
    const simpleRoiEl = document.getElementById('detail-kpi-simple-roi');
    if (simpleRoiEl) {
      const roi = kpi.simple_roi;
      simpleRoiEl.innerText = roi !== undefined ? roi.toFixed(3) + 'x' : '-';
      simpleRoiEl.className = 'kpi-value ' + (roi >= 1 ? 'text-success' : 'text-danger');
    }
    
    // Auto-conclusion text & card color overrides
    const conc = kpi.conclusion || 'TIDAK_LAYAK';
    const concEl = document.getElementById('detail-kpi-conclusion');
    const concCard = document.getElementById('kpi-conclusion-card');
    
    concCard.className = 'card';
    if (conc === 'LAYAK') {
      concEl.innerText = 'LAYAK';
      concEl.className = 'kpi-value text-success';
      concCard.classList.add('card-success');
    } else if (conc === 'BERSYARAT') {
      concEl.innerText = 'BERSYARAT';
      concEl.className = 'kpi-value text-warning';
      concCard.classList.add('card-warning');
    } else {
      concEl.innerText = 'TIDAK LAYAK';
      concEl.className = 'kpi-value text-danger';
      concCard.classList.add('card-danger');
    }

    document.getElementById('detail-kpi-payback').innerText = `Payback: ${kpi.payback_months > 0 ? kpi.payback_months.toFixed(1) + ' Bulan' : 'Tidak Terbayar'}`;

    // Assumptions displays
    const globalAss = this.getAssumptions();
    const wacc = proj.wacc_override !== null ? proj.wacc_override : globalAss.wacc_annual;
    // Derive monthly from annual: (1+annual)^(1/12)-1 matching Excel formula
    const inflAnnual = globalAss.inflation_annual !== undefined ? globalAss.inflation_annual : 3.0;
    const inflMonthly = ((Math.pow(1 + inflAnnual / 100, 1 / 12) - 1) * 100).toFixed(4);
    document.getElementById('detail-config-wacc').innerText = `${wacc}% p.a.`;
    document.getElementById('detail-config-inflation').innerText = `${inflAnnual}% p.a. → ${inflMonthly}% p.bln (compound)`;
    
    const bcrMand = proj.bcr_threshold_override?.mandatory || globalAss.bcr_mandatory;
    const bcrMin = proj.bcr_threshold_override?.minimum || globalAss.bcr_minimum;
    document.getElementById('detail-config-bcr').innerText = `Mandatory: ≥${bcrMand} | Minimum: ≥${bcrMin}`;

    // Comparison notes on cards
    document.getElementById('detail-kpi-wacc-comparison').innerText = `WACC: ${wacc}% (XIRR ${kpi.xirr * 100 >= wacc ? '≥' : '<'} WACC)`;
    document.getElementById('detail-kpi-bcr-comparison').innerText = `BCR Min ≥${bcrMand} | PI ${kpi.bcr >= bcrMand ? '≥' : '<'} Threshold`;

    // Context Actions Bar Injection
    this.renderDetailActionsBar(proj);

    // Dynamic Spreadsheet cells injection
    this.renderCashflowSpreadsheet(proj);

    // Approval logs timeline rendering
    this.renderApprovalTimeline(proj);

    // Version calc snapshots table
    this.renderCalcVersionsTable(proj);

    // Initialize/Update Chart.js visualizations
    this.renderProjectCharts(proj);
  }

  // Renders the dynamic cashflow spreadsheet grid (Horizontal scrolling)
  renderCashflowSpreadsheet(proj) {
    const grid = document.getElementById('project-cashflow-spreadsheet');
    const cf = proj.cashflow_monthly || [];
    if (cf.length === 0) {
      grid.innerHTML = '<tr><td class="text-center" style="padding:2rem;">Data cashflow kosong. Silakan hitung ulang.</td></tr>';
      return;
    }

    // 1. Generate Header Row: Period, Month indices
    let headerHtml = `<tr class="header-row"><th class="sticky-col">Deskripsi Periode</th>`;
    for (let m = 0; m < cf.length; m++) {
      headerHtml += `<th>Bulan ${m}</th>`;
    }
    headerHtml += `</tr>`;

    // 2. Generate Date Row
    let dateHtml = `<tr><td class="sticky-col">Tanggal Cashflow</td>`;
    for (let m = 0; m < cf.length; m++) {
      const d = new Date(cf.at(m).period_date);
      dateHtml += `<td>${d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })}</td>`;
    }
    dateHtml += `</tr>`;

    // 3. Generate Revenue Row
    let revHtml = `<tr><td class="sticky-col">Revenue (Pendapatan)</td>`;
    for (let m = 0; m < cf.length; m++) {
      revHtml += `<td>${cf.at(m).revenue.toLocaleString('id-ID')}</td>`;
    }
    revHtml += `</tr>`;

    // 4. Generate CAPEX Row
    let capexHtml = `<tr><td class="sticky-col">CAPEX (Belanja Modal)</td>`;
    for (let m = 0; m < cf.length; m++) {
      capexHtml += `<td>${cf.at(m).capex.toLocaleString('id-ID')}</td>`;
    }
    capexHtml += `</tr>`;

    // 5. Generate OPEX Row
    let opexHtml = `<tr><td class="sticky-col">OPEX (Operasional)</td>`;
    for (let m = 0; m < cf.length; m++) {
      opexHtml += `<td>${cf.at(m).opex.toLocaleString('id-ID')}</td>`;
    }
    opexHtml += `</tr>`;

    // 6. Generate Net Cashflow Row
    let netHtml = `<tr class="net-cf-row"><td class="sticky-col">Net Cashflow</td>`;
    for (let m = 0; m < cf.length; m++) {
      const val = cf.at(m).net_cashflow;
      netHtml += `<td class="${val < 0 ? 'text-danger' : 'text-success'}">${val.toLocaleString('id-ID')}</td>`;
    }
    netHtml += `</tr>`;

    // 7. Generate Cumulative Cashflow Row
    let cumHtml = `<tr class="cum-cf-row"><td class="sticky-col">Cumulative Cashflow</td>`;
    for (let m = 0; m < cf.length; m++) {
      const val = cf.at(m).cumulative_cashflow;
      cumHtml += `<td class="${val < 0 ? 'text-danger' : 'text-success'}">${val.toLocaleString('id-ID')}</td>`;
    }
    cumHtml += `</tr>`;

    // 8. Generate Active Flag Row
    let flagHtml = `<tr><td class="sticky-col">Active Flag</td>`;
    for (let m = 0; m < cf.length; m++) {
      flagHtml += `<td>${cf.at(m).active_flag}</td>`;
    }
    flagHtml += `</tr>`;

    grid.innerHTML = headerHtml + dateHtml + revHtml + capexHtml + opexHtml + netHtml + cumHtml + flagHtml;
  }

  // Renders the visual approval tree
  renderApprovalTimeline(proj) {
    const timeline = document.getElementById('detail-approval-timeline');
    const chain = proj.approval_chain || [];
    
    // We expect nodes for: Created (Submit), L1 Approval (Manager), Final Approval (GM/SRM)
    const isSubmitted = chain.some(c => c.status === 'SUBMITTED');
    const isApprovedL1 = chain.some(c => c.status === 'APPROVED_L1' || c.status === 'APPROVED_FINAL');
    const isApprovedFinal = chain.some(c => c.status === 'APPROVED_FINAL');
    const isRejected = proj.status === 'REJECTED';

    let html = '';

    // Node 1: Solution Architect Submission
    const sub = chain.find(c => c.level === 'SUBMIT');
    html += `
      <div class="approval-timeline-node completed">
        <div class="approval-timeline-dot"></div>
        <div class="approval-node-title">
          <span>Solution Architect (Draft & Hitung)</span>
          <span style="color:var(--accent-green); font-size:0.7rem;">SUBMITTED</span>
        </div>
        <div class="approval-node-meta">Oleh: ${sub ? escapeHTML(sub.user) : 'Solution Architect'}</div>
        ${sub?.comment ? `<div class="approval-node-comment">"${escapeHTML(sub.comment)}"</div>` : ''}
      </div>
    `;

    // Node 2: Manager Level Review
    let mgrNodeClass = 'active';
    let mgrStatusText = 'PENDING REVIEW';
    const mgr = chain.find(c => c.level === 'MANAGER');
    
    if (mgr) {
      if (mgr.status === 'APPROVED_L1') {
        mgrNodeClass = 'completed';
        mgrStatusText = 'APPROVED';
      } else if (mgr.status === 'REJECTED') {
        mgrNodeClass = 'rejected';
        mgrStatusText = 'REJECTED / REVISI';
      }
    } else if (!isSubmitted) {
      mgrNodeClass = '';
      mgrStatusText = 'WAITING SUBMIT';
    } else if (proj.status === 'REJECTED') {
      mgrNodeClass = 'rejected';
      mgrStatusText = 'REJECTED';
    }

    html += `
      <div class="approval-timeline-node ${mgrNodeClass}">
        <div class="approval-timeline-dot"></div>
        <div class="approval-node-title">
          <span>Manager Keuangan (Review Level 1)</span>
          <span style="font-size:0.7rem;" class="${mgrStatusText.includes('APPROVED') ? 'text-success' : (mgrStatusText.includes('REJECTED') ? 'text-danger' : 'text-warning')}">${mgrStatusText}</span>
        </div>
        <div class="approval-node-meta">SLA: 2 Hari Kerja ${mgr ? ' | Diputuskan: ' + new Date(mgr.decided_at).toLocaleDateString('id-ID') : ''}</div>
        ${mgr?.comment ? `<div class="approval-node-comment">"${escapeHTML(mgr.comment)}"</div>` : ''}
      </div>
    `;

    // Node 3: GM / SRM Review
    let gmNodeClass = '';
    let gmStatusText = 'WAITING L1';
    const gm = chain.find(c => c.level === 'GM_SRM');

    if (isApprovedL1) {
      gmNodeClass = 'active';
      gmStatusText = 'PENDING DECISION';
    }
    if (gm) {
      if (gm.status === 'APPROVED_FINAL') {
        gmNodeClass = 'completed';
        gmStatusText = 'APPROVED FINAL (FROZEN)';
      } else if (gm.status === 'REJECTED') {
        gmNodeClass = 'rejected';
        gmStatusText = 'REJECTED';
      }
    }

    html += `
      <div class="approval-timeline-node ${gmNodeClass}">
        <div class="approval-timeline-dot"></div>
        <div class="approval-node-title">
          <span>GM / SRM (Persetujuan Akhir)</span>
          <span style="font-size:0.7rem;" class="${gmStatusText.includes('FINAL') ? 'text-success' : (gmStatusText.includes('REJECTED') ? 'text-danger' : 'text-warning')}">${gmStatusText}</span>
        </div>
        <div class="approval-node-meta">SLA: 1 Hari Kerja ${gm ? ' | Diputuskan: ' + new Date(gm.decided_at).toLocaleDateString('id-ID') : ''}</div>
        ${gm?.comment ? `<div class="approval-node-comment">"${escapeHTML(gm.comment)}"</div>` : ''}
      </div>
    `;

    timeline.innerHTML = html;

    // Show/Hide action comments inputs depending on status and active user
    const actionBlock = document.getElementById('detail-approval-action-block');
    let showActions = false;
    
    if ((proj.status === 'SUBMITTED' || proj.status === 'UNDER_REVIEW') && this.currentRole === 'MANAGER') {
      showActions = true;
    } else if (proj.status === 'APPROVED_L1' && this.currentRole === 'GM_SRM') {
      showActions = true;
    } else if (
      (this.currentRole === 'SUPER_ADMIN' || this.currentRole === 'FINANCE_ADMIN') &&
      (proj.status === 'SUBMITTED' || proj.status === 'UNDER_REVIEW' || proj.status === 'APPROVED_L1')
    ) {
      showActions = true; // Super Admin can override any approval
    }

    actionBlock.style.display = showActions ? 'block' : 'none';
    document.getElementById('approval-comment-input').value = '';
  }

  // Dynamic context action buttons bar for project status transitions
  renderDetailActionsBar(proj) {
    const container = document.getElementById('detail-actions-bar');
    const role = this.currentRole;
    let html = '';

    // 1. Submit approval button: DRAFT -> SUBMITTED (SA / Super Admin / Finance Admin)
    if (
      (proj.status === 'DRAFT' || proj.status === 'COMPUTED' || proj.status === 'REJECTED') &&
      (role === 'SA' || role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN')
    ) {
      html += `<button class="btn btn-primary" onclick="app.submitProjectForApproval('${escapeHTML(proj.id)}')">Submit ke Manager (Approval)</button>`;
    }

    // 2. Edit cashflow parameters button (DRAFT / COMPUTED / REJECTED only)
    if ((proj.status === 'DRAFT' || proj.status === 'COMPUTED' || proj.status === 'REJECTED') && (role === 'SA' || role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN')) {
      html += `<button class="btn btn-secondary" onclick="app.openEditProjectWizard('${escapeHTML(proj.id)}')">Edit Konfigurasi</button>`;
    }

    // 3. Recalculate button
    if ((proj.status === 'DRAFT' || proj.status === 'COMPUTED' || proj.status === 'REJECTED') && (role === 'SA' || role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN')) {
      html += `<button class="btn btn-secondary" onclick="app.triggerProjectRecalculation('${escapeHTML(proj.id)}')">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right:2px;"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M21 3v5h-5"/></svg>
        Hitung Ulang (Async)
      </button>`;
    }

    // 4. Archive button for approved/rejected projects
    if ((proj.status === 'APPROVED_FINAL' || proj.status === 'REJECTED') && (role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN')) {
      html += `<button class="btn btn-secondary" onclick="app.archiveProject('${escapeHTML(proj.id)}')">Arsipkan Proyek</button>`;
    }

    container.innerHTML = html;
  }

  renderCalcVersionsTable(proj) {
    const tbody = document.getElementById('detail-versions-body');
    const list = proj.versions || [];
    
    const html = list.map(v => {
      const canLoad = this.useBackend && window.navproApi;
      const disabledAttr = canLoad ? '' : 'aria-disabled="true" data-disabled="true"';
      const disabledClass = canLoad ? '' : ' is-disabled';
      return `
        <tr>
          <td><strong>Versi ${v.version_number}</strong></td>
          <td>${v.duration_months} Bulan</td>
          <td>${new Date(v.created_at).toLocaleDateString('id-ID', { hour:'2-digit', minute:'2-digit' })}</td>
          <td style="font-weight:600;">${this.formatPercent(v.xirr)}</td>
          <td style="font-weight:600;">${this.formatCurrency(v.xnpv)}</td>
          <td style="font-weight:600;">${v.bcr.toFixed(2)}</td>
          <td>
            <button class="btn btn-secondary btn-sm${disabledClass}" onclick="app.loadCalcVersionSnapshot('${escapeHTML(proj.id)}', ${v.version_number})" ${disabledAttr}>Load Snapshot</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = html || '<tr><td colspan="7" class="text-center">Belum ada versi perhitungan tersimpan</td></tr>';
  }

  async loadCalcVersionSnapshot(projectId, versionNumber) {
    if (!this.useBackend || !window.navproApi) {
      alert('Fitur snapshot versi hanya tersedia saat API aktif (online).');
      return;
    }
    try {
      const { version } = await navproApi.getProjectVersionSnapshot(projectId, versionNumber);
      const base = this.getProjectById(projectId);
      if (!base) throw new Error('Proyek tidak ditemukan');

      const merged = {
        ...base,
        ...(version.input_snapshot || {}),
        kpi: version.result_snapshot?.kpi || base.kpi,
        cashflow_monthly: version.result_snapshot?.cashflow_monthly || base.cashflow_monthly,
      };

      this._renderProjectDetailWithData(merged, { viewingVersion: versionNumber });

      // Replace actions bar with "Back to latest"
      const container = document.getElementById('detail-actions-bar');
      if (container) {
        const backBtn = `<button class="btn btn-secondary" onclick="app.renderProjectDetail('${projectId}')">Kembali ke Versi Terbaru</button>`;
        container.insertAdjacentHTML('afterbegin', backBtn);
      }
    } catch (err) {
      alert(err?.data?.message || err.message || 'Gagal memuat snapshot versi');
    }
  }

  // Draw chart visual displays using Chart.js on the canvases
  renderProjectCharts(proj) {
    const cf = proj.cashflow_monthly || [];
    if (cf.length === 0) return;

    const labels = cf.map(c => `Bln ${c.period_number}`);
    const cumulativeData = cf.map(c => c.cumulative_cashflow);
    const netData = cf.map(c => c.net_cashflow);

    const xTickLimit = cf.length > 36 ? 12 : cf.length > 24 ? 18 : undefined;
    const xAxisTicks = {
      color: '#4b5563',
      font: { size: 9 },
      maxRotation: 0,
      autoSkip: true,
      maxTicksLimit: xTickLimit,
    };

    // Line Chart: XNPV / Cumulative Trend
    if (this.xnpvChart) this.xnpvChart.destroy();
    const ctx1 = document.getElementById('xnpv-trend-chart-canvas').getContext('2d');
    this.xnpvChart = new Chart(ctx1, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Cumulative Cashflow (Rp)',
          data: cumulativeData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.2,
          borderWidth: 2,
          pointRadius: cf.length > 24 ? 0 : 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 8, right: 12, bottom: 4, left: 8 } },
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: 'rgba(0, 0, 0, 0.06)' }, ticks: { color: '#4b5563', font: { size: 9 } } },
          x: { grid: { display: false }, ticks: xAxisTicks }
        }
      }
    });

    // Bar Chart: Monthly net flows
    if (this.cashflowChart) this.cashflowChart.destroy();
    const ctx2 = document.getElementById('cashflow-bar-chart-canvas').getContext('2d');
    this.cashflowChart = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Net Cashflow (Rp)',
          data: netData,
          backgroundColor: netData.map(v => v >= 0 ? '#3b82f6' : '#ef4444'),
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 8, right: 12, bottom: 4, left: 8 } },
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: 'rgba(0, 0, 0, 0.06)' }, ticks: { color: '#4b5563', font: { size: 9 } } },
          x: { grid: { display: false }, ticks: xAxisTicks }
        }
      }
    });
  }

  // Handle Approve/Reject action click by Managers or GMs
  handleApprovalAction(isApproved) {
    const proj = this.getProjectById(this.activeParamId);
    const comment = document.getElementById('approval-comment-input').value.trim();
    
    if (!isApproved && comment === '') {
      // Reject requires a comment
      document.getElementById('reject-reason-textarea').value = '';
      document.getElementById('reject-reason-dialog').showModal();
      return;
    }

    this.executeWorkflowDecision(proj, isApproved, comment);
  }

  submitRejection() {
    const proj = this.getProjectById(this.activeParamId);
    const comment = document.getElementById('reject-reason-textarea').value.trim();
    
    if (comment === '') {
      alert('Komentar penolakan wajib diisi!');
      return;
    }

    document.getElementById('reject-reason-dialog').close();
    this.executeWorkflowDecision(proj, false, comment);
  }

  executeWorkflowDecision(proj, isApproved, comment) {
    const user = this.getLoggedInUser();
    let oldStatus = proj.status;
    let newStatus = oldStatus;
    let levelKey =
      this.currentRole === 'SUPER_ADMIN' || this.currentRole === 'FINANCE_ADMIN'
        ? (oldStatus === 'SUBMITTED' || oldStatus === 'UNDER_REVIEW' ? 'MANAGER' : 'GM_SRM')
        : this.currentRole;

    if (isApproved) {
      if (oldStatus === 'SUBMITTED' || oldStatus === 'UNDER_REVIEW') {
        newStatus = 'APPROVED_L1';
        this.addNotification('Proyek Disetujui Manager', `Proyek ${proj.project_name} disetujui L1 oleh ${user.full_name}.`, proj.id);
      } else if (oldStatus === 'APPROVED_L1') {
        newStatus = 'APPROVED_FINAL';
        this.addNotification('Proyek APPROVED FINAL', `Proyek ${proj.project_name} disetujui final (frozen) oleh GM/SRM ${user.full_name}.`, proj.id);
      }
    } else {
      newStatus = 'REJECTED';
      this.addNotification('Proyek Ditolak / Perlu Revisi', `Proyek ${proj.project_name} ditolak oleh ${user.full_name} dengan catatan: "${comment}".`, proj.id);
    }

    // Push into approval chain log array
    if (!proj.approval_chain) proj.approval_chain = [];
    proj.approval_chain.push({
      level: levelKey,
      user: user.full_name,
      decided_at: new Date().toISOString(),
      status: newStatus,
      comment: comment
    });

    proj.status = newStatus;
    this.saveProject(proj);
    
    this.addAuditLog(isApproved ? 'APPROVE' : 'REJECT', oldStatus, newStatus);
    
    alert(`Status proyek berhasil diperbarui ke: ${newStatus}`);
    this.renderProjectDetail(proj.id);
  }

  // Triggers recalculations with simulated async loader
  triggerProjectRecalculation(id) {
    const proj = this.getProjectById(id);
    proj.status = 'DRAFT';
    this.saveProject(proj);

    alert('Proses kalkulasi async di BullMQ antrian berjalan...');
    
    // Switch to details page and load recalculate animations
    this.renderProjectDetail(proj.id);
    
    // Simulate BullMQ worker loading data
    setTimeout(() => {
      this.runCalculationOnProject(proj);
      
      // Update snapshot version numbers
      const nextVerNum = (proj.versions?.length || 0) + 1;
      if (!proj.versions) proj.versions = [];
      proj.versions.unshift({
        version_number: nextVerNum,
        duration_months: proj.project_duration_months,
        created_at: new Date().toISOString(),
        xirr: proj.kpi.xirr,
        xnpv: proj.kpi.xnpv,
        bcr: proj.kpi.bcr
      });
      
      proj.status = 'COMPUTED';
      this.saveProject(proj);
      
      this.addAuditLog('CALCULATE_RETRY', null, `${proj.project_code} - Versi ${nextVerNum} XIRR: ${this.formatPercent(proj.kpi.xirr)}`);
      
      this.renderProjectDetail(proj.id);
      this.addNotification('Kalkulasi Selesai', `Kalkulasi versi baru ${nextVerNum} untuk proyek ${proj.project_name} selesai dihitung.`, proj.id);
    }, 1200);
  }

  async submitProjectForApproval(id) {
    const proj = this.getProjectById(id);
    const oldStatus = proj.status;

    if (this.useBackend && window.navproApi) {
      try {
        const res = await navproApi.submitProject(id);
        const saved = res.project;
        const list = this.projectsCache.map((p) => (p.id === saved.id ? saved : p));
        this._setProjectsCache(list);
        await this.reloadFromBackend();
        alert('Proyek berhasil dikirim ke Manager Keuangan!');
        this.renderProjectDetail(id);
      } catch (err) {
        alert(err.message || 'Gagal mengajukan proyek');
      }
      return;
    }

    proj.status = 'SUBMITTED';
    if (!proj.approval_chain) proj.approval_chain = [];
    proj.approval_chain = proj.approval_chain.filter((c) => c.level === 'SUBMIT');
    proj.approval_chain.push({
      level: 'SUBMIT',
      user: this.getLoggedInUser().full_name,
      decided_at: new Date().toISOString(),
      status: 'SUBMITTED',
      comment: 'Diajukan kembali setelah penyesuaian.',
    });
    this.saveProject(proj);
    this.addAuditLog('SUBMIT_APPROVAL', oldStatus, 'SUBMITTED');
    this.addNotification(
      'Proyek Submitted',
      `Proyek ${proj.project_name} diajukan untuk ditinjau oleh Manager.`,
      proj.id
    );
    alert('Proyek berhasil dikirim ke Manager Keuangan!');
    this.renderProjectDetail(proj.id);
  }

  duplicateProject(id) {
    const src = this.getProjectById(id);
    const count = this.getProjects().length + 1;
    
    const clone = {
      ...JSON.parse(JSON.stringify(src)),
      id: 'proj-' + Date.now(),
      project_code: this.generateProjectCode(count),
      project_name: src.project_name + ' (Duplikat Template)',
      status: 'DRAFT',
      created_at: new Date().toISOString(),
      approval_chain: [],
      versions: []
    };
    
    this.runCalculationOnProject(clone);
    this.saveProject(clone);
    this.addAuditLog('DUPLICATE_PROJECT', src.project_code, clone.project_code);
    
    alert(`Proyek berhasil diduplikasi dengan kode: ${clone.project_code}`);
    this.navigateTo('projects');
  }

  async deleteProject(id) {
    if (!confirm('Apakah Anda yakin ingin membatalkan/menghapus proyek DRAFT ini?')) return;

    const target = this.getProjectById(id);

    if (this.useBackend && window.navproApi) {
      try {
        await navproApi.deleteProject(id);
        this._setProjectsCache(this.projectsCache.filter((p) => p.id !== id));
        alert('Proyek berhasil dihapus dari sistem.');
        this.navigateTo('projects');
      } catch (err) {
        alert(err.message || 'Gagal menghapus proyek');
      }
      return;
    }

    let list = this.getProjects();
    list = list.filter((p) => p.id !== id);
    localStorage.setItem('kkf_projects', JSON.stringify(list));
    this.addAuditLog('DELETE_PROJECT', target.project_code, null);
    alert('Proyek berhasil dihapus dari sistem.');
    this.navigateTo('projects');
  }

  archiveProject(id) {
    const proj = this.getProjectById(id);
    proj.status = 'ARCHIVED';
    this.saveProject(proj);
    this.addAuditLog('ARCHIVE_PROJECT', null, proj.project_code);
    alert('Proyek berhasil diarsipkan.');
    this.renderProjectDetail(proj.id);
  }

  // WIZARD CREATION CONTROLLERS (6 STEPS)
  openNewProjectWizard() {
    this.wizardStep = 1;
    this._wizardDirty = false;
    this._wizardLastSavedAt = null;
    this._wizardServerCreated = false;
    this._setWizardIndicator('dirty', 'Belum disimpan');
    this._bindWizardAutosaveOnce();
    
    // Auto-generate project code
    const count = this.getProjects().length + 1;
    const autoCode = this.generateProjectCode(count);
    
    // Setup temporary wizard project storage object
    this.wizardProject = {
      id: 'proj-' + Date.now(),
      project_code: autoCode,
      project_name: '',
      customer_name: '',
      contract_number: '',
      pic_sales: '',
      contract_start_date: new Date().toISOString().substring(0, 10),
      project_duration_months: 12,
      duration_category: 'SHORT_TERM',
      wacc_override: null,
      inflation_rate_override: null,
      bcr_threshold_override: null,
      otc_amount: 0,
      capex: [],
      opex: [],
      revenue: []
    };

    // Fill Step 1 HTML form inputs
    document.getElementById('wiz-proj-code').value = autoCode;
    document.getElementById('wiz-proj-name').value = '';
    document.getElementById('wiz-contract-start').value = this.wizardProject.contract_start_date;
    document.getElementById('wiz-customer-name').value = '';
    document.getElementById('wiz-contract-number').value = '';
    document.getElementById('wiz-pic-sales').value = '';
    
    // Reset OTC field
    const otcEl = document.getElementById('wiz-otc-amount');
    if (otcEl) otcEl.value = 0;
    
    // Populate Duration Preset options
    this.populateWizardPresetsSelect();
    
    // Populate category dropdowns
    this.populateWizardCategoriesSelects();

    // Render wizard lists empty
    this.renderWizardCapexRows();
    this.renderWizardOpexRows();
    this.renderWizardRevenueRows();

    // Draw active dialog step
    this.renderWizardActiveStep();
    
    document.getElementById('wizard-dialog-title').innerText = 'Proyek NAVPRO Baru';
    document.getElementById('project-wizard-dialog').showModal();
  }

  openEditProjectWizard(id) {
    const proj = this.getProjectById(id);
    if (!this.canEditProject(proj)) {
      alert('Proyek hanya dapat diedit pada status DRAFT/DIHITUNG/DITOLAK untuk role SA / Finance Admin / Super Admin.');
      return;
    }
    this.wizardStep = 1;
    this.wizardProject = JSON.parse(JSON.stringify(proj)); // clone
    this._wizardDirty = false;
    this._wizardLastSavedAt = new Date().toISOString();
    this._wizardServerCreated = true;
    this._setWizardIndicator('saved', this._formatWizardSavedLabel(this._wizardLastSavedAt));
    this._bindWizardAutosaveOnce();

    // Step 1 values
    document.getElementById('wiz-proj-code').value = proj.project_code;
    document.getElementById('wiz-proj-name').value = proj.project_name;
    document.getElementById('wiz-contract-start').value = proj.contract_start_date;
    // Populate identity fields
    document.getElementById('wiz-customer-name').value = proj.customer_name || '';
    document.getElementById('wiz-contract-number').value = proj.contract_number || '';
    document.getElementById('wiz-pic-sales').value = proj.pic_sales || '';
    // OTC
    const otcEditEl = document.getElementById('wiz-otc-amount');
    if (otcEditEl) otcEditEl.value = proj.otc_amount || 0;

    this.populateWizardPresetsSelect();
    
    // Set overrides in UI
    document.getElementById('wiz-wacc-override').value = proj.wacc_override || '';
    document.getElementById('wiz-inflation-override').value = proj.inflation_rate_override || '';
    
    const hasBcrOverride = proj.bcr_threshold_override !== null;
    document.getElementById('wiz-bcr-override-toggle').checked = hasBcrOverride;
    document.getElementById('wiz-bcr-override-fields').style.display = hasBcrOverride ? 'grid' : 'none';
    document.getElementById('wiz-bcr-mandatory-override').value = proj.bcr_threshold_override?.mandatory || '';
    document.getElementById('wiz-bcr-minimum-override').value = proj.bcr_threshold_override?.minimum || '';

    this.populateWizardCategoriesSelects();
    this.renderWizardCapexRows();
    this.renderWizardOpexRows();
    this.renderWizardRevenueRows();

    this.renderWizardActiveStep();

    document.getElementById('wizard-dialog-title').innerText = `Edit Konfigurasi Proyek: ${proj.project_code}`;
    document.getElementById('project-wizard-dialog').showModal();
  }

  closeProjectWizard() {
    clearTimeout(this._wizardAutosaveTimer);
    document.getElementById('project-wizard-dialog').close();
    this.wizardProject = null;
    this._wizardDirty = false;
  }

  populateWizardPresetsSelect() {
    const select = document.getElementById('wiz-duration-preset');
    const presets = this._getPresetsList().filter(p => p.is_active);
    
    let html = presets.map(p => `<option value="${p.duration_months}">${escapeHTML(p.preset_name)}</option>`).join('');
    html += `<option value="CUSTOM">Custom (Input Bebas)</option>`;
    select.innerHTML = html;

    // Set selected preset
    const duration = this.wizardProject.project_duration_months;
    const isPreset = presets.some(p => p.duration_months === duration);
    
    if (isPreset) {
      select.value = duration;
      document.getElementById('wiz-custom-duration-wrapper').style.display = 'none';
    } else {
      select.value = 'CUSTOM';
      document.getElementById('wiz-custom-duration-wrapper').style.display = 'block';
      document.getElementById('wiz-custom-duration-months').value = duration;
    }
  }

  populateWizardCategoriesSelects() {
    const cats = this._getCategoriesData();
    
    document.getElementById('wiz-capex-cat').innerHTML = cats.capex.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
    document.getElementById('wiz-opex-cat').innerHTML = cats.opex.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
  }

  handleWizardDurationPresetChange(val) {
    const wrapper = document.getElementById('wiz-custom-duration-wrapper');
    if (val === 'CUSTOM') {
      wrapper.style.display = 'block';
      document.getElementById('wiz-custom-duration-months').value = 12;
      this.wizardProject.project_duration_months = 12;
    } else {
      wrapper.style.display = 'none';
      this.wizardProject.project_duration_months = parseInt(val);
    }
  }

  // Wizard dynamic table appends
  addWizardCapexRow() {
    const name = document.getElementById('wiz-capex-name').value.trim();
    const cat = document.getElementById('wiz-capex-cat').value;
    const amount = parseFloat(document.getElementById('wiz-capex-amount').value);
    const period = parseInt(document.getElementById('wiz-capex-period').value);

    const maxP = this.wizardProject?.project_duration_months ?? 120;
    if (
      name === '' ||
      Number.isNaN(amount) ||
      Number.isNaN(period) ||
      amount < 0 ||
      !Number.isInteger(period) ||
      period < 0 ||
      period > maxP
    ) {
      alert(`CAPEX tidak valid. Pastikan: nama terisi, amount >= 0, dan periode 0–${maxP}.`);
      return;
    }

    this.wizardProject.capex.push({ name, category: cat, amount, period });
    
    // Clear forms inputs
    document.getElementById('wiz-capex-name').value = '';
    document.getElementById('wiz-capex-amount').value = '';
    document.getElementById('wiz-capex-period').value = '';

    this.renderWizardCapexRows();
  }

  deleteWizardCapexRow(idx) {
    this.wizardProject.capex.splice(idx, 1);
    this.renderWizardCapexRows();
  }

  renderWizardCapexRows() {
    const tbody = document.getElementById('wiz-capex-rows-list');
    let total = 0;
    
    const html = this.wizardProject.capex.map((item, idx) => {
      total += item.amount;
      return `
        <tr>
          <td>${escapeHTML(item.name)}</td>
          <td><span class="badge badge-draft" style="font-size:0.6rem;">${escapeHTML(item.category)}</span></td>
          <td class="text-right">${this.formatCurrency(item.amount)}</td>
          <td>Bulan ${item.period}</td>
          <td><button class="btn btn-danger btn-sm btn-icon-only" onclick="app.deleteWizardCapexRow(${idx})">&times;</button></td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = html || '<tr><td colspan="5" class="text-center" style="color:var(--text-muted);">Belum ada belanja modal (CAPEX) ditambahkan</td></tr>';
    document.getElementById('wiz-capex-total-label').innerText = `Total CAPEX: ${this.formatCurrency(total)}`;
  }

  // OPEX Wizard row handlers
  addWizardOpexRow() {
    const name = document.getElementById('wiz-opex-name').value.trim();
    const cat = document.getElementById('wiz-opex-cat').value;
    const amount = parseFloat(document.getElementById('wiz-opex-amount').value);
    const start = parseInt(document.getElementById('wiz-opex-start').value);
    const end = parseInt(document.getElementById('wiz-opex-end').value || this.wizardProject.project_duration_months);

    const maxP = this.wizardProject?.project_duration_months ?? 120;
    if (
      name === '' ||
      Number.isNaN(amount) ||
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      amount < 0 ||
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 1 ||
      end < start ||
      end > maxP
    ) {
      alert(`OPEX tidak valid. Pastikan: nama terisi, amount >= 0, start 1–${maxP}, end >= start.`);
      return;
    }

    this.wizardProject.opex.push({ name, category: cat, baseline_amount: amount, start_period: start, end_period: end });
    
    document.getElementById('wiz-opex-name').value = '';
    document.getElementById('wiz-opex-amount').value = '';
    document.getElementById('wiz-opex-start').value = 1;
    document.getElementById('wiz-opex-end').value = '';

    this.renderWizardOpexRows();
  }

  deleteWizardOpexRow(idx) {
    this.wizardProject.opex.splice(idx, 1);
    this.renderWizardOpexRows();
  }

  renderWizardOpexRows() {
    const tbody = document.getElementById('wiz-opex-rows-list');
    let total = 0;
    
    const html = this.wizardProject.opex.map((item, idx) => {
      total += item.baseline_amount;
      return `
        <tr>
          <td>${escapeHTML(item.name)}</td>
          <td><span class="badge badge-draft" style="font-size:0.6rem;">${escapeHTML(item.category)}</span></td>
          <td class="text-right">${this.formatCurrency(item.baseline_amount)}/bln</td>
          <td>Bulan ${item.start_period} s/d ${item.end_period}</td>
          <td><button class="btn btn-danger btn-sm btn-icon-only" onclick="app.deleteWizardOpexRow(${idx})">&times;</button></td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = html || '<tr><td colspan="5" class="text-center" style="color:var(--text-muted);">Belum ada biaya operasional (OPEX) ditambahkan</td></tr>';
    document.getElementById('wiz-opex-total-label').innerText = `Total OPEX Baseline: ${this.formatCurrency(total)}/bln`;
  }

  // REVENUE Wizard row handlers
  addWizardRevenueRow() {
    const name = document.getElementById('wiz-rev-name').value.trim();
    const amount = parseFloat(document.getElementById('wiz-rev-amount').value);
    const esc = parseFloat(document.getElementById('wiz-rev-escalation').value || 0) / 100;
    const start = parseInt(document.getElementById('wiz-rev-start').value);
    const end = parseInt(document.getElementById('wiz-rev-end').value || this.wizardProject.project_duration_months);

    const maxP = this.wizardProject?.project_duration_months ?? 120;
    if (
      name === '' ||
      Number.isNaN(amount) ||
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      amount < 0 ||
      esc < 0 ||
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 1 ||
      end < start ||
      end > maxP
    ) {
      alert(`Revenue tidak valid. Pastikan: nama terisi, amount >= 0, escalation >= 0, start 1–${maxP}, end >= start.`);
      return;
    }

    this.wizardProject.revenue.push({ name, monthly_amount: amount, escalation_rate: esc, start_period: start, end_period: end });
    
    document.getElementById('wiz-rev-name').value = '';
    document.getElementById('wiz-rev-amount').value = '';
    document.getElementById('wiz-rev-escalation').value = 0;
    document.getElementById('wiz-rev-start').value = 1;
    document.getElementById('wiz-rev-end').value = '';

    this.renderWizardRevenueRows();
  }

  deleteWizardRevenueRow(idx) {
    this.wizardProject.revenue.splice(idx, 1);
    this.renderWizardRevenueRows();
  }

  renderWizardRevenueRows() {
    const tbody = document.getElementById('wiz-rev-rows-list');
    let total = 0;
    
    const html = this.wizardProject.revenue.map((item, idx) => {
      total += item.monthly_amount;
      return `
        <tr>
          <td>${escapeHTML(item.name)}</td>
          <td class="text-right">${this.formatCurrency(item.monthly_amount)}/bln</td>
          <td>${(item.escalation_rate * 100).toFixed(2)}%</td>
          <td>Bulan ${item.start_period} s/d ${item.end_period}</td>
          <td><button class="btn btn-danger btn-sm btn-icon-only" onclick="app.deleteWizardRevenueRow(${idx})">&times;</button></td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = html || '<tr><td colspan="5" class="text-center" style="color:var(--text-muted);">Belum ada pendapatan (Revenue Stream) ditambahkan</td></tr>';
    document.getElementById('wiz-rev-total-label').innerText = `Total Revenue Baseline: ${this.formatCurrency(total)}/bln`;
  }

  // Wizard Step rendering and flow control
  renderWizardActiveStep() {
    // 1. Toggle Wizard pages visibility
    for (let s = 1; s <= 6; s++) {
      const el = document.getElementById(`wizard-step-${s}`);
      const node = document.getElementById(`wizard-step-node-${s}`);
      
      if (s === this.wizardStep) {
        el.classList.add('active');
        node.classList.add('active');
      } else {
        el.classList.remove('active');
        node.classList.remove('active');
      }
      
      // Step nodes completed styles
      if (s < this.wizardStep) {
        node.classList.add('completed');
      } else {
        node.classList.remove('completed');
      }
    }

    // 2. Adjust footer button labels
    const prevBtn = document.getElementById('wizard-prev-btn');
    const nextBtn = document.getElementById('wizard-next-btn');

    prevBtn.disabled = this.wizardStep === 1;
    
    if (this.wizardStep === 6) {
      nextBtn.innerText = 'Hitung & Simpan';
    } else {
      nextBtn.innerText = 'Lanjut';
    }
  }

  navigateWizard(dir) {
    // Step Validation checks before moving forward
    if (dir === 1) {
      if (this.wizardStep === 1) {
        const name = document.getElementById('wiz-proj-name').value.trim();
        const start = document.getElementById('wiz-contract-start').value;
        const customer = document.getElementById('wiz-customer-name').value.trim();
        const contractNo = document.getElementById('wiz-contract-number').value.trim();
        const picSales = document.getElementById('wiz-pic-sales').value.trim();
        if (name === '' || start === '' || customer === '' || contractNo === '' || picSales === '') {
          alert('Lengkapi field wajib: Nama Proyek, Tanggal Mulai, Nama Pelanggan, Nomor Kontrak, dan PIC Sales.');
          return;
        }
        this.wizardProject.project_name = name;
        this.wizardProject.contract_start_date = start;
        this.wizardProject.customer_name = customer;
        this.wizardProject.contract_number = contractNo;
        this.wizardProject.pic_sales = picSales;
      }
      
      if (this.wizardStep === 2) {
        const preset = document.getElementById('wiz-duration-preset').value;
        if (preset === 'CUSTOM') {
          const customVal = parseInt(document.getElementById('wiz-custom-duration-months').value);
          if (Number.isNaN(customVal) || !Number.isInteger(customVal) || customVal < 1 || customVal > 120) {
            alert('Durasi kustom harus bernilai antara 1 sampai 120 bulan!');
            return;
          }
          this.wizardProject.project_duration_months = customVal;
        } else {
          const parsed = parseInt(preset);
          if (Number.isNaN(parsed) || !Number.isInteger(parsed) || parsed < 1 || parsed > 120) {
            alert('Durasi preset tidak valid');
            return;
          }
          this.wizardProject.project_duration_months = parsed;
        }
        
        // Auto categorize
        const months = this.wizardProject.project_duration_months;
        if (months <= 12) this.wizardProject.duration_category = 'SHORT_TERM';
        else if (months <= 36) this.wizardProject.duration_category = 'MID_TERM';
        else if (months <= 60) this.wizardProject.duration_category = 'LONG_TERM';
        else this.wizardProject.duration_category = 'EXTENDED';

        // Overrides
        const wacc = document.getElementById('wiz-wacc-override').value;
        this.wizardProject.wacc_override = wacc !== '' ? parseFloat(wacc) : null;
        
        const inf = document.getElementById('wiz-inflation-override').value;
        this.wizardProject.inflation_rate_override = inf !== '' ? parseFloat(inf) : null;

        const kurs = document.getElementById('wiz-kurs-usd-override')?.value;
        this.wizardProject.kurs_usd_override = kurs !== '' ? parseFloat(kurs) : null;

        if (this.wizardProject.wacc_override != null && (Number.isNaN(this.wizardProject.wacc_override) || this.wizardProject.wacc_override < 0)) {
          alert('WACC override harus angka >= 0');
          return;
        }
        if (this.wizardProject.inflation_rate_override != null && (Number.isNaN(this.wizardProject.inflation_rate_override) || this.wizardProject.inflation_rate_override < 0)) {
          alert('Inflasi override harus angka >= 0');
          return;
        }
        if (this.wizardProject.kurs_usd_override != null && (Number.isNaN(this.wizardProject.kurs_usd_override) || this.wizardProject.kurs_usd_override < 0)) {
          alert('Kurs USD override harus angka >= 0');
          return;
        }

        const bcrToggle = document.getElementById('wiz-bcr-override-toggle').checked;
        if (bcrToggle) {
          const mand = parseFloat(document.getElementById('wiz-bcr-mandatory-override').value);
          const min = parseFloat(document.getElementById('wiz-bcr-minimum-override').value);
          if (Number.isNaN(mand) || Number.isNaN(min) || mand < 0 || min < 0 || mand < min) {
            alert('Masukkan nilai ambang batas BCR override yang valid!');
            return;
          }
          this.wizardProject.bcr_threshold_override = { mandatory: mand, minimum: min };
        } else {
          this.wizardProject.bcr_threshold_override = null;
        }
      }

      if (this.wizardStep === 6) {
        // Capture OTC before triggering calculation
        const otcEl = document.getElementById('wiz-otc-amount');
        const otc = otcEl ? parseFloat(otcEl.value || 0) : 0;
        if (Number.isNaN(otc) || otc < 0) {
          alert('OTC harus angka >= 0');
          return;
        }
        this.wizardProject.otc_amount = otc;
        // Step 6 triggers calculations & save
        this.runWizardCalculation();
        return;
      }
    }

    // Step transition: persist draft snapshot (best-effort)
    this.markWizardDirty();
    this._syncWizardInputs({ allowPartial: true });
    this.scheduleWizardAutosave();

    this.wizardStep += dir;
    
    // Prepare Step 6 summary fields if rendering step 6
    if (this.wizardStep === 6) {
      document.getElementById('wiz-rev-pcode').innerText = this.wizardProject.project_code;
      document.getElementById('wiz-rev-pname').innerText = this.wizardProject.project_name;
      document.getElementById('wiz-rev-pstart').innerText = new Date(this.wizardProject.contract_start_date).toLocaleDateString('id-ID');
      document.getElementById('wiz-rev-pduration').innerText = `${this.wizardProject.project_duration_months} Bulan (${this.wizardProject.duration_category})`;
      
      const globalAss = this.getAssumptions();
      document.getElementById('wiz-rev-pwacc').innerText = this.wizardProject.wacc_override !== null ? `${this.wizardProject.wacc_override}%` : `Default (${globalAss.wacc_annual}%)`;
      document.getElementById('wiz-rev-pinflation').innerText = this.wizardProject.inflation_rate_override !== null ? `${this.wizardProject.inflation_rate_override}%` : `Default (${globalAss.inflation_monthly}%)`;
      
      document.getElementById('wiz-rev-pcapex-cnt').innerText = `${this.wizardProject.capex.length} item`;
      document.getElementById('wiz-rev-popex-cnt').innerText = `${this.wizardProject.opex.length} item`;
    }

    this.renderWizardActiveStep();
  }

  // Simulates the background BullMQ async processing for the wizard completion
  runWizardCalculation() {
    const loader = document.getElementById('wiz-calculating-loader');
    const statusText = document.getElementById('wiz-loader-status');
    const prevBtn = document.getElementById('wizard-prev-btn');
    const nextBtn = document.getElementById('wizard-next-btn');

    loader.style.display = 'block';
    prevBtn.disabled = true;
    nextBtn.disabled = true;

    // Phase 1 loader simulation
    setTimeout(() => {
      statusText.innerText = `Menyusun ${this.wizardProject.project_duration_months} periode arus kas bulanan...`;
      
      // Phase 2 Newton Raphson
      setTimeout(() => {
        statusText.innerText = 'Menyelesaikan iterasi Newton-Raphson XIRR & discounting NPV...';
        
        // Phase 3 Save
        setTimeout(() => {
          const user = this.getLoggedInUser();
          this.wizardProject.created_by = user.id;
          this.wizardProject.created_at = new Date().toISOString();
          this.wizardProject.status = 'COMPUTED';
          
          // Initial version calculation snapshot
          this.runCalculationOnProject(this.wizardProject);
          this.wizardProject.versions = [{
            version_number: 1,
            duration_months: this.wizardProject.project_duration_months,
            created_at: new Date().toISOString(),
            xirr: this.wizardProject.kpi.xirr,
            xnpv: this.wizardProject.kpi.xnpv,
            bcr: this.wizardProject.kpi.bcr
          }];

          this.saveProject(this.wizardProject);
          
          this.addAuditLog('CREATE_PROJECT', null, `${this.wizardProject.project_code} - ${this.wizardProject.project_name}`);
          this.addNotification('Kalkulasi Selesai', `Kalkulasi awal berhasil dihitung untuk proyek ${this.wizardProject.project_name}.`, this.wizardProject.id);

          alert(`Kalkulasi sukses! Proyek ${this.wizardProject.project_code} berhasil disimpan.`);
          
          // Hide loader, close dialog, redirect to project detail page
          loader.style.display = 'none';
          this.closeProjectWizard();
          this.navigateTo('project-detail', this.wizardProject.id);
        }, 800);
      }, 700);
    }, 600);
  }

  // VIEW 4: ADMIN CMS SYSTEM RENDERS
  renderAdminCMS() {
    this.switchAdminTab(this.activeAdminTab);
  }

  switchAdminTab(tabName) {
    this.activeAdminTab = tabName;
    
    // Active sidebar class
    document.querySelectorAll('.admin-nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`admin-nav-${tabName}`).classList.add('active');
    
    // Toggle tab panels
    document.querySelectorAll('.admin-tab-content').forEach(p => p.style.display = 'none');
    document.getElementById(`admin-tab-${tabName}`).style.display = 'block';

    // Call sub renderers
    switch(tabName) {
      case 'health': this.renderCMSHealth(); break;
      case 'assumptions': this.renderCMSAssumptions(); break;
      case 'presets': this.renderCMSPresets(); break;
      case 'sla': this.renderCMSSLA(); break;
      case 'categories': this.renderCMSCategories(); break;
      case 'params': this.renderCMSParams(); break;
      case 'users': this.renderCMSUsers(); break;
      case 'audit': this.renderCMSAuditLogs(); break;
    }
  }

  // CMS: System Health diagnostics simulator
  renderCMSHealth() {
    const grid = document.getElementById('admin-health-grid');
    // Simulated state of containers
    const isMaintenance = this._isMaintenanceMode();
    
    const services = [
      { name: 'nginx-gateway', port: '80/443', status: 'ONLINE', desc: 'Proxy & Rate Limiting' },
      { name: 'fastify-backend', port: '4000', status: isMaintenance ? 'MAINTENANCE' : 'ONLINE', desc: 'API & JWT Auth' },
      { name: 'bullmq-worker', port: 'N/A', status: 'ONLINE', desc: 'Active queues: 0 depth' },
      { name: 'postgresql-database', port: '5432', status: 'ONLINE', desc: 'NUMERIC accuracy engine' },
      { name: 'redis-queue', port: '6379', status: 'ONLINE', desc: 'Job store & caches' },
      { name: 'minio-s3-store', port: '9000', status: 'ONLINE', desc: 'Laporan PDF & Excel storage' }
    ];

    const html = services.map(s => {
      const isOnline = s.status === 'ONLINE';
      const isMaint = s.status === 'MAINTENANCE';
      return `
        <div class="health-tile">
          <div class="health-indicator ${isOnline ? 'health-indicator-online' : (isMaint ? 'health-indicator-online' : 'health-indicator-offline')}" style="background-color:${isMaint ? 'var(--accent-yellow)' : ''};"></div>
          <div>
            <div class="health-tile-title">${escapeHTML(s.name)}</div>
            <div class="health-tile-sub">Port: ${escapeHTML(s.port)} | Status: <strong style="color:${isOnline ? 'var(--accent-green)' : (isMaint ? 'var(--accent-yellow)' : 'var(--accent-red)')}">${escapeHTML(s.status)}</strong></div>
            <div style="font-size:0.65rem; color:var(--text-muted);">${escapeHTML(s.desc)}</div>
          </div>
        </div>
      `;
    }).join('');

    grid.innerHTML = html;

    const mToggle = document.getElementById('maintenance-toggle-btn');
    if (isMaintenance) {
      mToggle.innerText = 'Matikan Maintenance Mode';
      mToggle.className = 'btn btn-success btn-sm';
    } else {
      mToggle.innerText = 'Aktifkan Maintenance Mode';
      mToggle.className = 'btn btn-danger btn-sm';
    }
  }

  async toggleMaintenanceMode() {
    const isMaintenance = this._isMaintenanceMode();
    const next = !isMaintenance;
    if (this.useBackend && window.navproApi) {
      try {
        await navproApi.adminToggleMaintenance(next);
        const p = (this.systemParamsCache || []).find((x) => x.key === 'maintenance_mode');
        if (p) p.val = next ? 'true' : 'false';
        else
          this.systemParamsCache.push({
            key: 'maintenance_mode',
            val: next ? 'true' : 'false',
            category: 'FEATURE_FLAG',
            type: 'boolean',
          });
      } catch (err) {
        alert(err.message || 'Gagal mengubah maintenance mode');
        return;
      }
    } else {
      localStorage.setItem('kkf_maintenance_mode', next.toString());
    }
    this.addAuditLog('TOGGLE_MAINTENANCE', isMaintenance ? 'ON' : 'OFF', next ? 'ON' : 'OFF');
    alert(`Maintenance mode berhasil diubah menjadi: ${next ? 'AKTIF' : 'NON-AKTIF'}`);
    this.renderCMSHealth();
  }

  // CMS-01: Assumption Master
  renderCMSAssumptions() {
    const ass = this.getAssumptions();
    
    document.getElementById('ass-wacc').value = ass.wacc_annual;
    
    // Inflation: use annual field if available, else back-derive from monthly
    const annualInfl = ass.inflation_annual !== undefined ? ass.inflation_annual :
      parseFloat(((Math.pow(1 + (ass.inflation_monthly || 0.2466) / 100, 12) - 1) * 100).toFixed(4));
    document.getElementById('ass-inflation-annual').value = annualInfl;
    
    // Show derived monthly inflation
    const monthlyDerived = (Math.pow(1 + annualInfl / 100, 1 / 12) - 1) * 100;
    document.getElementById('ass-inflation-monthly-display').value = monthlyDerived.toFixed(6) + '%';
    
    document.getElementById('ass-ppn').value = ass.ppn_rate !== undefined ? ass.ppn_rate : 12.0;
    document.getElementById('ass-kurs-usd').value = ass.kurs_usd !== undefined ? ass.kurs_usd : 16500;
    document.getElementById('ass-bcr-mandatory').value = ass.bcr_mandatory;
    document.getElementById('ass-bcr-minimum').value = ass.bcr_minimum;
    document.getElementById('ass-effective-date').value = ass.effective_date;

    const hist = this._assumptionHistoryCache || JSON.parse(localStorage.getItem('kkf_assumptions_history') || '[]');
    const html = hist.map(h => {
      return `
        <tr>
          <td>${new Date(h.updated_at).toLocaleDateString('id-ID')}</td>
          <td>${h.wacc_annual}%</td>
          <td>${h.inflation_annual !== undefined ? h.inflation_annual + '% p.a.' : h.inflation_monthly + '% p.bln'}</td>
          <td>${h.bcr_mandatory}</td>
          <td>${h.bcr_minimum}</td>
          <td>${new Date(h.effective_date).toLocaleDateString('id-ID')}</td>
        </tr>
      `;
    }).join('');
    document.getElementById('admin-assumptions-history-table').innerHTML = html || '<tr><td colspan="6" class="text-center">Belum ada riwayat tercatat</td></tr>';
  }

  // Live-updates the derived monthly inflation display in the admin form
  updateMonthlyInflationDisplay() {
    const annualEl = document.getElementById('ass-inflation-annual');
    const monthlyEl = document.getElementById('ass-inflation-monthly-display');
    if (annualEl && monthlyEl) {
      const annual = parseFloat(annualEl.value || 0);
      const monthly = (Math.pow(1 + annual / 100, 1 / 12) - 1) * 100;
      monthlyEl.value = isNaN(monthly) ? '' : monthly.toFixed(6) + '%';
    }
  }

  async saveAssumptionMaster(e) {
    e.preventDefault();
    const wacc = parseFloat(document.getElementById('ass-wacc').value);
    const inflAnnual = parseFloat(document.getElementById('ass-inflation-annual').value);
    const inflMonthly = parseFloat(((Math.pow(1 + inflAnnual / 100, 1 / 12) - 1) * 100).toFixed(6));
    const ppnRate = parseFloat(document.getElementById('ass-ppn').value);
    const kursUsd = parseFloat(document.getElementById('ass-kurs-usd').value) || 16500;
    const mand = parseFloat(document.getElementById('ass-bcr-mandatory').value);
    const min = parseFloat(document.getElementById('ass-bcr-minimum').value);
    const eff = document.getElementById('ass-effective-date').value;

    const old = this.getAssumptions();
    const user = this.getLoggedInUser();

    const nextAssumptions = {
      wacc_annual: wacc,
      inflation_annual: inflAnnual,
      inflation_monthly: inflMonthly,
      ppn_rate: ppnRate,
      kurs_usd: kursUsd,
      bcr_mandatory: mand,
      bcr_minimum: min,
      currency: 'IDR',
      effective_date: eff,
      notes: 'Diperbarui via CMS Admin',
    };

    if (this.useBackend && window.navproApi) {
      try {
        const res = await navproApi.adminSaveAssumptions(nextAssumptions);
        this.assumptionsCache = res.assumptions;
        const histRes = await navproApi.adminGetAssumptionHistory();
        this._assumptionHistoryCache = (histRes.history || []).map((h) => h.data || h);
      } catch (err) {
        alert(err.message || 'Gagal menyimpan asumsi');
        return;
      }
    } else {
      localStorage.setItem('kkf_assumptions_master', JSON.stringify(nextAssumptions));
      const hist = JSON.parse(localStorage.getItem('kkf_assumptions_history') || '[]');
      hist.unshift({
        ...nextAssumptions,
        updated_at: new Date().toISOString(),
        updated_by: user.full_name,
      });
      localStorage.setItem('kkf_assumptions_history', JSON.stringify(hist));
    }

    this.addAuditLog('UPDATE_GLOBAL_ASSUMPTIONS', JSON.stringify(old), JSON.stringify(nextAssumptions));
    alert(`Asumsi Keuangan Global berhasil disimpan!\nInflasi bulanan auto-derived: ${inflMonthly.toFixed(4)}% per bulan (dari ${inflAnnual}% p.a.)`);
    this.renderCMSAssumptions();
  }

  // CMS-02: Presets manager
  renderCMSPresets() {
    const body = document.getElementById('admin-presets-table-body');
    const list = this._getPresetsList();

    const html = list.map(p => {
      return `
        <tr>
          <td><strong>${escapeHTML(p.preset_name)}</strong></td>
          <td>${p.duration_months} Bulan</td>
          <td><span class="badge badge-draft" style="font-size:0.6rem;">${escapeHTML(p.category)}</span></td>
          <td>≥ ${p.bcr_mandatory}</td>
          <td>≥ ${p.bcr_minimum}</td>
          <td><span class="badge ${p.is_active ? 'badge-approved' : 'badge-draft'}">${p.is_active ? 'AKTIF' : 'NON-AKTIF'}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="app.togglePresetActive('${escapeHTML(p.id)}')">${p.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
          </td>
        </tr>
      `;
    }).join('');

    body.innerHTML = html || '<tr><td colspan="7" class="text-center">Preset durasi kosong</td></tr>';
  }

  async togglePresetActive(id) {
    const list = this._getPresetsList();
    const p = list.find((item) => item.id === id);
    if (!p) return;
    p.is_active = !p.is_active;
    if (this.useBackend && window.navproApi) {
      await navproApi.adminSavePreset(p).catch(() => {});
      this.presetsCache = list;
    } else {
      localStorage.setItem('kkf_presets', JSON.stringify(list));
    }
    this.addAuditLog('TOGGLE_PRESET', p.preset_name, p.is_active ? 'ACTIVE' : 'INACTIVE');
    this.renderCMSPresets();
  }

  openAddPresetModal() {
    document.getElementById('pre-name').value = '';
    document.getElementById('pre-months').value = '';
    document.getElementById('pre-bcr-mandatory').value = 1.23;
    document.getElementById('pre-bcr-minimum').value = 1.08;

    // Listen to changes to auto update category in form
    const mInput = document.getElementById('pre-months');
    const catSelect = document.getElementById('pre-category');
    mInput.oninput = () => {
      const val = parseInt(mInput.value);
      if (val <= 12) catSelect.value = 'SHORT_TERM';
      else if (val <= 36) catSelect.value = 'MID_TERM';
      else if (val <= 60) catSelect.value = 'LONG_TERM';
      else catSelect.value = 'EXTENDED';
    };

    document.getElementById('add-preset-dialog').showModal();
  }

  async saveNewPreset(e) {
    e.preventDefault();
    const name = document.getElementById('pre-name').value;
    const months = parseInt(document.getElementById('pre-months').value);
    const mand = parseFloat(document.getElementById('pre-bcr-mandatory').value);
    const min = parseFloat(document.getElementById('pre-bcr-minimum').value);
    const cat = document.getElementById('pre-category').value;

    const newPreset = {
      id: 'pre-' + Date.now(),
      preset_name: name,
      duration_months: months,
      category: cat,
      bcr_mandatory: mand,
      bcr_minimum: min,
      is_active: true,
      _isNew: true,
    };

    if (this.useBackend && window.navproApi) {
      await navproApi.adminSavePreset(newPreset);
      const res = await navproApi.adminGetPresets();
      this.presetsCache = res.presets || [];
    } else {
      const list = this._getPresetsList();
      list.push(newPreset);
      localStorage.setItem('kkf_presets', JSON.stringify(list));
    }
    this.addAuditLog('CREATE_PRESET', null, name);

    document.getElementById('add-preset-dialog').close();
    this.renderCMSPresets();
    alert(`Preset ${name} berhasil ditambahkan!`);
  }

  // CMS-03: SLA Manager
  renderCMSSLA() {
    const tbody = document.getElementById('admin-sla-table-body');
    const list = this._getSlaList();

    const html = list.map(s => {
      return `
        <tr>
          <td><strong>${escapeHTML(s.role_name)}</strong></td>
          <td>${s.sla_working_days} Hari Kerja</td>
          <td>${s.reminder_hours} Jam</td>
          <td>${s.escalation_hours} Jam (Eskalasi ke: ${escapeHTML(s.escalate_to_role)})</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="app.editSLALimit('${escapeHTML(s.role_key)}')">Edit SLA</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = html;
  }

  async editSLALimit(roleKey) {
    const list = this._getSlaList();
    const s = list.find((item) => item.role_key === roleKey);
    if (!s) return;

    const nextDays = prompt(`Ubah batas SLA ${s.role_name} (Hari Kerja):`, s.sla_working_days);
    if (nextDays !== null && !isNaN(parseInt(nextDays, 10))) {
      s.sla_working_days = parseInt(nextDays, 10);
      if (this.useBackend && window.navproApi) {
        await navproApi.adminUpdateSla(roleKey, s);
        this.slaCache = list;
      } else {
        localStorage.setItem('kkf_sla_config', JSON.stringify(list));
      }
      this.addAuditLog('UPDATE_SLA', roleKey, `${nextDays} hari`);
      this.renderCMSSLA();
    }
  }

  // CMS-04/05: Category lists
  renderCMSCategories() {
    const cats = this._getCategoriesData();
    
    const capList = document.getElementById('admin-capex-cats-list');
    capList.innerHTML = cats.capex.map((c, i) => `
      <div class="category-pill">
        <span>${escapeHTML(c)}</span>
        <button onclick="app.deleteCategory('CAPEX', ${i})" style="background:none; border:none; color:var(--accent-red); cursor:pointer; font-weight:700;">&times;</button>
      </div>
    `).join('');

    const opexList = document.getElementById('admin-opex-cats-list');
    opexList.innerHTML = cats.opex.map((c, i) => `
      <div class="category-pill">
        <span>${escapeHTML(c)}</span>
        <button onclick="app.deleteCategory('OPEX', ${i})" style="background:none; border:none; color:var(--accent-red); cursor:pointer; font-weight:700;">&times;</button>
      </div>
    `).join('');
  }

  addCategory(type) {
    const input = document.getElementById(type === 'CAPEX' ? 'admin-new-capex-cat' : 'admin-new-opex-cat');
    const val = input.value.trim().toUpperCase();
    if (val === '') return;

    const cats = this._getCategoriesData();
    const list = type === 'CAPEX' ? cats.capex : cats.opex;

    if (list.includes(val)) {
      alert('Kategori sudah ada!');
      return;
    }

    list.push(val);
    localStorage.setItem('kkf_categories', JSON.stringify(cats));
    this.addAuditLog('ADD_CATEGORY', type, val);

    input.value = '';
    this.renderCMSCategories();
  }

  deleteCategory(type, idx) {
    const cats = this._getCategoriesData();
    const list = type === 'CAPEX' ? cats.capex : cats.opex;
    const removed = list.splice(idx, 1);
    
    localStorage.setItem('kkf_categories', JSON.stringify(cats));
    this.addAuditLog('DELETE_CATEGORY', type, removed[0]);
    this.renderCMSCategories();
  }

  // CMS-09: Parameters configuration store
  renderCMSParams() {
    const tbody = document.getElementById('admin-system-params-table');
    const list = this._getSystemParamsList();

    const html = list.map((p, i) => {
      return `
        <tr>
          <td><code>${escapeHTML(p.key)}</code></td>
          <td><span class="badge badge-draft" style="font-size:0.6rem;">${escapeHTML(p.category)}</span></td>
          <td><strong>${escapeHTML(p.val)}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">(${escapeHTML(p.desc)})</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="app.editParamValue(${i})">Ubah Nilai</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = html;
  }

  async editParamValue(idx) {
    const list = this._getSystemParamsList();
    const p = list.at(idx);

    const nextVal = prompt(`Ubah parameter ${p.key}:`, p.val);
    if (nextVal !== null) {
      const oldVal = p.val;
      p.val = nextVal;
      if (this.useBackend && window.navproApi) {
        await navproApi.adminUpdateSystemConfig(p.key, nextVal);
      } else {
        localStorage.setItem('kkf_system_params', JSON.stringify(list));
      }
      this.addAuditLog('EDIT_SYSTEM_PARAM', `${p.key}=${oldVal}`, `${p.key}=${nextVal}`);
      this.renderCMSParams();
    }
  }

  // CMS-10: Users administration
  renderCMSUsers() {
    const tbody = document.getElementById('admin-users-table-body');
    const list = this._getUsersList();

    const html = list.map(u => {
      return `
        <tr>
          <td><strong>${escapeHTML(u.full_name)}</strong></td>
          <td><code>${escapeHTML(u.email)}</code></td>
          <td><span class="badge badge-draft">${escapeHTML(u.role.replace('_', ' '))}</span></td>
          <td><span class="badge ${u.is_active ? 'badge-approved' : 'badge-rejected'}">${u.is_active ? 'AKTIF' : 'INAKTIF'}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="app.toggleUserStatus('${escapeHTML(u.id)}')">${u.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = html;
  }

  async toggleUserStatus(id) {
    const list = this._getUsersList();
    const u = list.find((item) => item.id === id);
    if (!u) return;
    u.is_active = !u.is_active;
    if (this.useBackend && window.navproApi) {
      await navproApi.adminSaveUser(u);
      this.usersCache = list;
    } else {
      localStorage.setItem('kkf_users', JSON.stringify(list));
    }
    this.addAuditLog('TOGGLE_USER_STATUS', u.email, u.is_active ? 'ACTIVE' : 'INACTIVE');
    this.renderCMSUsers();
  }

  openAddUserModal() {
    document.getElementById('usr-fullname').value = '';
    document.getElementById('usr-email').value = '';
    document.getElementById('usr-role').value = 'SA';
    document.getElementById('add-user-dialog').showModal();
  }

  saveNewUser(e) {
    e.preventDefault();
    const name = document.getElementById('usr-fullname').value;
    const email = document.getElementById('usr-email').value;
    const role = document.getElementById('usr-role').value;

    const list = JSON.parse(localStorage.getItem('kkf_users')) || [];
    const newUser = {
      id: 'usr-' + Date.now(),
      full_name: name,
      email: email,
      role: role,
      is_active: true
    };

    list.push(newUser);
    localStorage.setItem('kkf_users', JSON.stringify(list));
    this.addAuditLog('CREATE_USER', null, email);

    document.getElementById('add-user-dialog').close();
    this.renderCMSUsers();
    alert(`User ${email} berhasil ditambahkan!`);
  }

  // CMS-11: Audit log viewer
  renderCMSAuditLogs() {
    const tbody = document.getElementById('admin-audit-logs-table-body');
    const logs = this._getAuditLogs();

    const html = logs.map(log => {
      const d = new Date(log.timestamp);
      const timeStr = d.toLocaleDateString('id-ID') + ' ' + d.toLocaleTimeString('id-ID');
      return `
        <tr>
          <td style="color:var(--text-secondary);">${timeStr}</td>
          <td><strong>${escapeHTML(log.user)}</strong></td>
          <td><span class="badge badge-draft" style="font-size:0.6rem; margin-right:0.25rem;">${escapeHTML(log.action)}</span></td>
          <td style="color:var(--text-muted); font-size:0.75rem;">${log.old_val ? escapeHTML(log.old_val.substring(0, 50)) : '-'}</td>
          <td style="color:var(--text-secondary); font-size:0.75rem;">${log.new_val ? escapeHTML(log.new_val.substring(0, 80)) : '-'}</td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = html || '<tr><td colspan="5" class="text-center">Belum ada log aktivitas</td></tr>';
  }

  // NOTIFICATION DROPDOWN POPUP
  toggleNotificationsPanel(e) {
    e.stopPropagation();
    const p = document.getElementById('notifications-dropdown');
    p.classList.toggle('active');
    
    if (p.classList.contains('active')) {
      this.renderNotificationsList();
    }
  }

  renderNotificationsList() {
    const listContainer = document.getElementById('notifications-list-container');
    const notifs = this._getNotifications();
    
    const html = notifs.map(n => {
      const timeStr = new Date(n.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(n.timestamp).toLocaleDateString('id-ID', { day:'2-digit', month:'2-digit' });
      return `
        <div class="inapp-notif-item ${n.is_read ? '' : 'unread'}" onclick="app.handleNotifClick('${escapeHTML(n.project_id)}', '${escapeHTML(n.id)}')">
          <div class="inapp-notif-title">${escapeHTML(n.title)}</div>
          <div class="inapp-notif-body">${escapeHTML(n.body)}</div>
          <div class="inapp-notif-time">${timeStr}</div>
        </div>
      `;
    }).join('');

    listContainer.innerHTML = html || '<div class="text-center" style="padding:1.5rem; color:var(--text-muted); font-size:0.8rem;">Tidak ada notifikasi baru</div>';
  }

  renderNotificationBell() {
    const notifs = this._getNotifications();
    const unread = notifs.filter(n => !n.is_read);
    const badge = document.getElementById('app-notif-badge');
    
    if (unread.length > 0) {
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }

  async markAllNotificationsRead(e) {
    e.stopPropagation();
    if (this.useBackend && window.navproApi) {
      await navproApi.markAllNotificationsRead().catch(() => {});
      this.notificationsCache = (this.notificationsCache || []).map((n) => ({
        ...n,
        is_read: true,
      }));
    } else {
      const notifs = this._getNotifications();
      notifs.forEach((n) => (n.is_read = true));
      localStorage.setItem('kkf_notifications', JSON.stringify(notifs));
    }
    this.renderNotificationBell();
    this.renderNotificationsList();
  }

  async handleNotifClick(projId, notifId) {
    if (this.useBackend && window.navproApi) {
      await navproApi.markNotificationRead(notifId).catch(() => {});
      const target = (this.notificationsCache || []).find((n) => n.id === notifId);
      if (target) target.is_read = true;
    } else {
      const notifs = this._getNotifications();
      const target = notifs.find((n) => n.id === notifId);
      if (target) target.is_read = true;
      localStorage.setItem('kkf_notifications', JSON.stringify(notifs));
    }
    
    this.renderNotificationBell();
    document.getElementById('notifications-dropdown').classList.remove('active');
    
    // Direct navigate to project detail
    if (projId) {
      this.navigateTo('project-detail', projId);
    }
  }

  // EXPORT FILE EXPORTERS (CSV client-side generator)
  exportToExcel() {
    const proj = this.getProjectById(this.activeParamId);
    if (!proj) return;
    const cf = proj.cashflow_monthly || [];
    if (cf.length === 0) {
      alert('Cashflow kosong. Hitung dulu sebelum ekspor.');
      return;
    }
    if (typeof XLSX === 'undefined' || !XLSX.utils) {
      alert('Library Excel belum termuat. Refresh halaman lalu coba lagi.');
      return;
    }

    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const kpi = proj.kpi || {};
    const globalAss = this.getAssumptions();
    const bcrMand = proj.bcr_threshold_override?.mandatory || globalAss.bcr_mandatory;
    const bcrMin = proj.bcr_threshold_override?.minimum || globalAss.bcr_minimum;

    const summaryAoa = [
      [`${NAVPRO.brand} — Laporan Kelayakan Finansial`],
      [],
      ['Kode Proyek', proj.project_code],
      ['Nama Proyek', proj.project_name],
      ['Status', proj.status],
      ['Mulai Kontrak', proj.contract_start_date],
      ['Durasi (bulan)', proj.project_duration_months],
      [],
      ['KPI'],
      ['XIRR (p.a.)', kpi.xirr ?? 0],
      ['XNPV', kpi.xnpv ?? 0],
      ['BCR / PI', kpi.bcr ?? 0],
      ['Simple ROI', kpi.simple_roi ?? 0],
      ['Payback (bulan)', kpi.payback_months ?? -1],
      ['Kesimpulan', kpi.conclusion || '—'],
      [],
      ['Threshold BCR'],
      ['Mandatory', bcrMand],
      ['Minimum', bcrMin],
      [],
      ['Generated at', new Date().toISOString()],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Sheet 2: Cashflow
    const cashflowAoa = [
      [
        'Periode',
        'Tanggal',
        'Revenue',
        'OTC',
        'OPEX',
        'CAPEX',
        'Net Cashflow',
        'Cumulative Cashflow',
        'Active Flag',
      ],
      ...cf.map((p) => [
        p.period_number,
        p.period_date,
        p.revenue,
        p.otc ?? (p.period_number === 1 ? proj.otc_amount || 0 : 0),
        p.opex,
        p.capex,
        p.net_cashflow,
        p.cumulative_cashflow,
        p.active_flag,
      ]),
    ];
    const wsCashflow = XLSX.utils.aoa_to_sheet(cashflowAoa);
    XLSX.utils.book_append_sheet(wb, wsCashflow, 'Cashflow');

    const filename = `${NAVPRO.brand}_KKF_${proj.project_code}_${new Date().toISOString().substring(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);

    this.addAuditLog('EXPORT_XLSX', null, proj.project_code);
  }

  exportToPDF() {
    const proj = this.getProjectById(this.activeParamId);
    if (!proj) return;
    document.body.classList.add('print-mode');
    const title = document.title;
    document.title = `${NAVPRO.brand} - ${proj.project_code}`;
    setTimeout(() => {
      window.print();
      document.title = title;
      document.body.classList.remove('print-mode');
      this.addAuditLog('EXPORT_PDF', null, proj.project_code);
    }, 50);
  }

  exportToCSV() {
    const proj = this.getProjectById(this.activeParamId);
    const cf = proj.cashflow_monthly || [];
    if (cf.length === 0) return;

    let csv = `SPESIFIKASI PROYEK ${NAVPRO.brand}\n`;
    csv += `Kode Proyek;${proj.project_code}\n`;
    csv += `Nama Proyek;${proj.project_name}\n`;
    csv += `Status Approval;${proj.status}\n`;
    csv += `Durasi Proyek;${proj.project_duration_months} Bulan\n`;
    csv += `Mulai Kontrak;${proj.contract_start_date}\n\n`;
    
    csv += `KPI FINANSIAL\n`;
    csv += `XIRR;${this.formatPercent(proj.kpi.xirr)}\n`;
    csv += `XNPV;${proj.kpi.xnpv}\n`;
    csv += `Benefit Cost Ratio (BCR);${proj.kpi.bcr.toFixed(2)}\n`;
    csv += `Payback Period;${proj.kpi.payback_months.toFixed(1)} Bulan\n`;
    csv += `Kesimpulan;${proj.kpi.conclusion}\n\n`;

    csv += `TABEL ARUS KAS BULANAN (CASHFLOW)\n`;
    
    // Header columns
    csv += `Deskripsi;`;
    for (let m = 0; m < cf.length; m++) csv += `Bulan ${m};`;
    csv += `\n`;

    csv += `Tanggal;`;
    for (let m = 0; m < cf.length; m++) csv += `${cf.at(m).period_date};`;
    csv += `\n`;

    csv += `Revenue Inflows;`;
    for (let m = 0; m < cf.length; m++) csv += `${cf.at(m).revenue};`;
    csv += `\n`;

    csv += `CAPEX Outflows;`;
    for (let m = 0; m < cf.length; m++) csv += `${cf.at(m).capex};`;
    csv += `\n`;

    csv += `OPEX Outflows;`;
    for (let m = 0; m < cf.length; m++) csv += `${cf.at(m).opex};`;
    csv += `\n`;

    csv += `Net Cashflow;`;
    for (let m = 0; m < cf.length; m++) csv += `${cf.at(m).net_cashflow};`;
    csv += `\n`;

    csv += `Cumulative Cashflow;`;
    for (let m = 0; m < cf.length; m++) csv += `${cf.at(m).cumulative_cashflow};`;
    csv += `\n`;

    csv += `Active Flag;`;
    for (let m = 0; m < cf.length; m++) csv += `${cf.at(m).active_flag};`;
    csv += `\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${NAVPRO.brand}_Cashflow_${proj.project_code}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.addAuditLog('EXPORT_CSV', null, proj.project_code);
  }

  exportAuditLogsCSV() {
    const logs = this._getAuditLogs();
    let csv = `Waktu;User;Aksi;Nilai Lama;Nilai Baru\n`;
    for (let log of logs) {
      csv += `${log.timestamp};${log.user};${log.action};${log.old_val || '-'};${log.new_val || '-'}\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${NAVPRO.brand}_AuditLogs_${new Date().toISOString().substring(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    this.addAuditLog('EXPORT_AUDIT', null, 'Bulk CSV');
  }

  // App initialization scripts on window load
  async init() {
    this.showLoadingScreen('Memuat NAVPRO…');
    this.bindLoginForm();

    window.addEventListener('click', (ev) => {
      document.getElementById('notifications-dropdown')?.classList.remove('active');
      if (!ev.target.closest('.user-profile-menu')) this.closeUserMenu();
    });

    this._setLoadingStatus('Memeriksa koneksi server…');
    const apiUp = await this.probeApi();

    this._setLoadingStatus('Memeriksa sesi Anda…');
    const restored = await this.tryRestoreSession();

    await this.hideLoadingScreen();

    if (restored) {
      console.log(`${NAVPRO.brand} — sesi dipulihkan (${this.currentUser?.email}).`);
    } else {
      this._setLoginStatus(
        apiUp
          ? 'Server API aktif — masuk dengan akun terdaftar.'
          : 'Server API tidak terjangkau — mode offline (data lokal browser).',
        apiUp ? 'info' : 'offline'
      );
      this.showLoginScreen();
    }
  }
}

const app = new KKFApplication();
window.addEventListener('DOMContentLoaded', async () => {
  await app.init();
  if (app.isAuthenticated) app.navigateTo('dashboard');
});
