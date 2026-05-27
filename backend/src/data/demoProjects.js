/** 20 demo projects — all workflow statuses represented */

const CREATED_BY = '11111111-1111-1111-1111-111111111103';

function chainFor(status) {
  const submit = {
    level: 'SUBMIT',
    user: 'Rian Hidayat',
    decided_at: '2026-05-26T08:00:00Z',
    status: 'SUBMITTED',
    comment: 'Pengajuan kelayakan finansial.',
  };
  const mgrApprove = {
    level: 'MANAGER',
    user: 'Dewi Sartika',
    decided_at: '2026-05-26T10:00:00Z',
    status: 'APPROVED_L1',
    comment: 'Disetujui level Manager.',
  };
  const gmApprove = {
    level: 'GM_SRM',
    user: 'Irwan Setiawan',
    decided_at: '2026-05-26T14:00:00Z',
    status: 'APPROVED_FINAL',
    comment: 'Disetujui final.',
  };
  const mgrReject = {
    level: 'MANAGER',
    user: 'Dewi Sartika',
    decided_at: '2026-05-26T10:00:00Z',
    status: 'REJECTED',
    comment: 'Perlu revisi CAPEX dan proyeksi revenue.',
  };

  switch (status) {
    case 'SUBMITTED':
      return [submit];
    case 'UNDER_REVIEW':
      return [submit];
    case 'APPROVED_L1':
      return [submit, mgrApprove];
    case 'APPROVED_FINAL':
      return [submit, mgrApprove, gmApprove];
    case 'REJECTED':
      return [submit, mgrReject];
    default:
      return [];
  }
}

function financials(scale = 1) {
  const s = scale;
  return {
    capex: [
      { name: 'Infrastruktur Utama', category: 'NETWORK', amount: Math.round(200000000 * s), period: 0 },
      { name: 'Instalasi & Integrasi', category: 'INTEGRATION', amount: Math.round(45000000 * s), period: 0 },
    ],
    opex: [
      {
        name: 'Operasional & Maintenance',
        category: 'MAINTENANCE',
        baseline_amount: Math.round(4000000 * s),
        inflation_rate: 0.003,
        start_period: 1,
        end_period: 36,
      },
    ],
    revenue: [
      {
        name: 'Pendapatan Layanan Bulanan',
        monthly_amount: Math.round(28000000 * s),
        escalation_rate: 0.002,
        start_period: 1,
        end_period: 36,
      },
    ],
    otc_amount: Math.round(10000000 * s),
  };
}

const DEFINITIONS = [
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

export function getDemoProjectDefinitions() {
  return DEFINITIONS.map((d) => {
    const fin = financials(d.scale);
    const months = d.months;
    fin.opex[0].end_period = months;
    fin.revenue[0].end_period = months;

    return {
      id: `22222222-2222-2222-2222-2222222222${String(d.seq).padStart(2, '0')}`,
      project_code: `NAVPRO-2026-${String(d.seq).padStart(4, '0')}`,
      project_name: d.name,
      customer_name: d.customer,
      contract_number: d.contract,
      pic_sales: d.pic,
      status: d.status,
      project_duration_months: months,
      duration_category: d.category,
      contract_start_date: d.start,
      created_by: CREATED_BY,
      wacc_override: null,
      inflation_rate_override: null,
      bcr_threshold_override: null,
      ...fin,
      approval_chain: chainFor(d.status),
      versions: [{ version_number: 1, duration_months: months, created_at: '2026-05-27T05:00:00Z' }],
    };
  });
}
