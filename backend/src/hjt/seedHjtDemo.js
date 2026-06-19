/**
 * Demo penawaran HJT — use case untuk QA & pagination (12 baris).
 * Idempotent: hapus contract_no DEMO-HJT-* lalu insert ulang.
 */

const DEMO_SA_ID = '11111111-1111-1111-1111-111111111103';

const DEMO_QUOTATIONS = [
  // ── 3 Draft ──
  {
    id: '33333333-3333-3333-3333-333333333001',
    contract_no: 'DEMO-HJT-001',
    customer_name: 'PT Cipta Semesta Indah',
    status: 'draft',
    calc_mode: 'standard',
    region_code: 'Jabodetabek',
    grand_total_all: null,
    note: 'Draft — belum dihitung',
  },
  {
    id: '33333333-3333-3333-3333-333333333002',
    contract_no: 'DEMO-HJT-002',
    customer_name: 'Bank Nusantara Digital',
    status: 'draft',
    calc_mode: 'standard',
    region_code: 'Jawa - Bali',
    total_per_month: 8_500_000,
    grand_total_all: 102_000_000,
    offer_floor: 112_200_000,
    offer_recommended: 122_400_000,
    note: 'Draft — sudah kalkulasi',
  },
  {
    id: '33333333-3333-3333-3333-333333333003',
    contract_no: 'DEMO-HJT-003',
    customer_name: 'RS Mitra Sehat',
    status: 'draft',
    calc_mode: 'revenue_sharing',
    region_code: 'INTIM',
    total_per_month: 12_000_000,
    grand_total_all: 144_000_000,
    offer_floor: 158_400_000,
    offer_recommended: 172_800_000,
    note: 'Draft Mode B',
  },
  // ── 3 Submitted (menunggu approval) ──
  {
    id: '33333333-3333-3333-3333-333333333004',
    contract_no: 'DEMO-HJT-004',
    customer_name: 'PT Global Fiber Net',
    status: 'submitted',
    calc_mode: 'standard',
    region_code: 'Jabodetabek',
    total_per_month: 10_086_400,
    grand_total_all: 122_036_800,
    offer_floor: 134_240_480,
    offer_recommended: 146_444_160,
    current_approval_role: 'ASMAN',
    submitted_at: '2026-05-10T08:00:00Z',
  },
  {
    id: '33333333-3333-3333-3333-333333333005',
    contract_no: 'DEMO-HJT-005',
    customer_name: 'Universitas Pelita Harapan',
    status: 'submitted',
    calc_mode: 'standard',
    region_code: 'Sumatera',
    total_per_month: 6_200_000,
    grand_total_all: 74_400_000,
    offer_floor: 81_840_000,
    offer_recommended: 89_280_000,
    current_approval_role: 'MANAGER',
    submitted_at: '2026-05-12T10:30:00Z',
  },
  {
    id: '33333333-3333-3333-3333-333333333006',
    contract_no: 'DEMO-HJT-006',
    customer_name: 'Koperasi Karyawan Sejahtera',
    status: 'submitted',
    calc_mode: 'revenue_sharing',
    region_code: 'Jawa - Bali',
    total_per_month: 15_500_000,
    grand_total_all: 186_000_000,
    offer_floor: 204_600_000,
    offer_recommended: 223_200_000,
    current_approval_role: 'GM_SRM',
    submitted_at: '2026-05-15T14:00:00Z',
  },
  // ── 3 Approved ──
  {
    id: '33333333-3333-3333-3333-333333333007',
    contract_no: 'DEMO-HJT-007',
    customer_name: 'PT Indodata Solusi',
    status: 'approved',
    calc_mode: 'standard',
    region_code: 'Jabodetabek',
    total_per_month: 9_800_000,
    grand_total_all: 117_600_000,
    offer_floor: 129_360_000,
    offer_recommended: 141_120_000,
    harga_final: 141_120_000,
    approved_at: '2026-05-01T09:00:00Z',
    submitted_at: '2026-04-28T11:00:00Z',
  },
  {
    id: '33333333-3333-3333-3333-333333333008',
    contract_no: 'DEMO-HJT-008',
    customer_name: 'Manufacturing Nusantara Tbk',
    status: 'approved',
    calc_mode: 'standard',
    region_code: 'INTIM',
    total_per_month: 22_400_000,
    grand_total_all: 268_800_000,
    offer_floor: 295_680_000,
    offer_recommended: 322_560_000,
    harga_final: 320_000_000,
    approved_at: '2026-05-05T16:00:00Z',
    submitted_at: '2026-05-02T08:00:00Z',
  },
  {
    id: '33333333-3333-3333-3333-333333333009',
    contract_no: 'DEMO-HJT-009',
    customer_name: 'Pemerintah Kab. Bandung Barat',
    status: 'approved',
    calc_mode: 'revenue_sharing',
    region_code: 'Jawa - Bali',
    total_per_month: 18_000_000,
    grand_total_all: 216_000_000,
    offer_floor: 237_600_000,
    offer_recommended: 259_200_000,
    harga_final: 259_200_000,
    approved_at: '2026-05-08T12:00:00Z',
    submitted_at: '2026-05-06T09:00:00Z',
  },
  // ── 3 Tidak layak (rejected) ──
  {
    id: '33333333-3333-3333-3333-333333333010',
    contract_no: 'DEMO-HJT-010',
    customer_name: 'PT Retail Maju Bersama',
    status: 'rejected',
    calc_mode: 'standard',
    region_code: 'Jabodetabek',
    total_per_month: 3_200_000,
    grand_total_all: 38_400_000,
    offer_floor: 42_240_000,
    offer_recommended: 46_080_000,
    rejected_note: 'Tidak layak — margin di bawah floor, BCR < 1,4',
    rejected_at: '2026-05-03T10:00:00Z',
    submitted_at: '2026-05-01T08:00:00Z',
  },
  {
    id: '33333333-3333-3333-3333-333333333011',
    contract_no: 'DEMO-HJT-011',
    customer_name: 'CV Solusi Tekno Kecil',
    status: 'rejected',
    calc_mode: 'standard',
    region_code: 'Sumatera',
    total_per_month: 1_800_000,
    grand_total_all: 21_600_000,
    offer_floor: 23_760_000,
    offer_recommended: 25_920_000,
    rejected_note: 'Tidak layak — lastmile KKF BCR negatif, IRR tidak feasible',
    rejected_at: '2026-05-07T14:30:00Z',
    submitted_at: '2026-05-05T11:00:00Z',
  },
  {
    id: '33333333-3333-3333-3333-333333333012',
    contract_no: 'DEMO-HJT-012',
    customer_name: 'Startup Connect Hub',
    status: 'rejected',
    calc_mode: 'revenue_sharing',
    region_code: 'INTIM',
    total_per_month: 2_500_000,
    grand_total_all: 30_000_000,
    offer_floor: 33_000_000,
    offer_recommended: 36_000_000,
    rejected_note: 'Tidak layak — harga negosiasi di bawah HPP + overhead',
    rejected_at: '2026-05-11T09:15:00Z',
    submitted_at: '2026-05-09T13:00:00Z',
  },
];

export async function seedHjtDemoQuotations(query, { versionId, createdBy = DEMO_SA_ID } = {}) {
  if (!versionId) return { inserted: 0 };

  await query(`DELETE FROM hjt_quotation WHERE contract_no LIKE 'DEMO-HJT-%'`);

  const { rows: regions } = await query(`SELECT id, region_code FROM hjt_region`);
  const regionByCode = Object.fromEntries(regions.map((r) => [r.region_code, r.id]));

  const { rows: products } = await query(
    `SELECT id, product_name FROM hjt_product WHERE product_name LIKE 'Dedicated Internet%' OR product_name LIKE 'Metro Ethernet%' LIMIT 2`
  );
  const productId = products[0]?.id;
  const productId2 = products[1]?.id || productId;

  let inserted = 0;

  for (const demo of DEMO_QUOTATIONS) {
    const regionId = regionByCode[demo.region_code];
    if (!regionId) continue;

    const creator = createdBy;

    await query(
      `INSERT INTO hjt_quotation
         (id, customer_name, contract_no, contract_year, region_id, scheme, calc_mode, duration_years,
          tariff_version_id, status, total_per_month, grand_total_hjt, grand_total_all,
          offer_floor, offer_recommended, harga_final, margin_percent,
          current_approval_role, submitted_at, approved_at, rejected_at, rejected_note,
          created_by, updated_at, created_at)
       VALUES ($1,$2,$3,1,$4,'Subscription',$5,1,$6,$7,$8,$9,$10,$11,$12,$13,20,
               $14,$15,$16,$17,$18,$19,NOW() - ($20::int * INTERVAL '1 day'), NOW() - ($20::int * INTERVAL '1 day'))`,
      [
        demo.id,
        demo.customer_name,
        demo.contract_no,
        regionId,
        demo.calc_mode,
        versionId,
        demo.status,
        demo.total_per_month ?? null,
        demo.grand_total_all ?? null,
        demo.grand_total_all ?? null,
        demo.offer_floor ?? null,
        demo.offer_recommended ?? null,
        demo.harga_final ?? null,
        demo.current_approval_role ?? null,
        demo.submitted_at ?? null,
        demo.approved_at ?? null,
        demo.rejected_at ?? null,
        demo.rejected_note ?? null,
        creator,
        inserted,
      ]
    );

    if (productId) {
      const bb = demo.region_code === 'Jabodetabek' ? 88000 : 52000;
      const ul = demo.region_code === 'Jabodetabek' ? 7500 : 5800;
      const harga = demo.total_per_month ?? 0;
      const lineProduct =
        demo.calc_mode === 'revenue_sharing' && productId2 ? productId2 : productId;
      await query(
        `INSERT INTO hjt_quotation_line
           (quotation_id, product_id, capacity, unit, qty, backbone, uplink, harga_dasar, sort_order)
         VALUES ($1,$2,1,'Mbps',1,$3,$4,$5,0)`,
        [demo.id, lineProduct, bb, ul, harga]
      );
    }

    if (['submitted', 'approved', 'rejected'].includes(demo.status)) {
      const chain =
        demo.calc_mode === 'revenue_sharing'
          ? ['ASMAN', 'MANAGER', 'GM_SRM']
          : ['ASMAN', 'MANAGER'];
      for (const role of chain) {
        if (demo.status === 'rejected' && role !== chain[0]) continue;

        let decision = 'pending';
        let decidedAt = null;
        let note = null;

        if (demo.status === 'approved') {
          decision = 'approved';
          decidedAt = demo.approved_at;
        } else if (demo.status === 'rejected') {
          decision = 'rejected';
          decidedAt = demo.rejected_at;
          note = demo.rejected_note;
        } else if (demo.current_approval_role) {
          const pendingIdx = chain.indexOf(demo.current_approval_role);
          const roleIdx = chain.indexOf(role);
          if (roleIdx < pendingIdx) {
            decision = 'approved';
            decidedAt = demo.submitted_at;
          } else if (roleIdx === pendingIdx) {
            decision = 'pending';
          }
        }

        await query(
          `INSERT INTO hjt_approval (quotation_id, role_level, decision, note, decided_at)
           VALUES ($1,$2,$3,$4,$5)`,
          [demo.id, role, decision, note, decidedAt]
        );
      }
    }

    inserted += 1;
  }

  return { inserted };
}
