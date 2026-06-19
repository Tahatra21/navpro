-- HJT Connectivity module (PRDHJT §6)
-- Applied idempotently via backend/src/hjt/schema.js

CREATE TABLE IF NOT EXISTS hjt_tariff_version (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kepdir_ref TEXT NOT NULL,
  effective_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hjt_region (
  id SERIAL PRIMARY KEY,
  region_code TEXT UNIQUE NOT NULL,
  region_name TEXT NOT NULL,
  has_uplink BOOLEAN NOT NULL DEFAULT false,
  is_route BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS hjt_product (
  id SERIAL PRIMARY KEY,
  product_name TEXT UNIQUE NOT NULL,
  product_family TEXT NOT NULL,
  default_unit TEXT NOT NULL DEFAULT 'Mbps'
);

CREATE TABLE IF NOT EXISTS hjt_tariff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES hjt_tariff_version(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES hjt_product(id) ON DELETE CASCADE,
  region_id INT NOT NULL REFERENCES hjt_region(id) ON DELETE CASCADE,
  backbone INT NOT NULL DEFAULT 0,
  uplink INT NOT NULL DEFAULT 0,
  vas INT NOT NULL DEFAULT 0,
  access INT NOT NULL DEFAULT 0,
  tarif INT NOT NULL DEFAULT 0,
  UNIQUE(version_id, product_id, region_id)
);

CREATE INDEX IF NOT EXISTS idx_hjt_tariff_lookup ON hjt_tariff (version_id, product_id, region_id);

CREATE TABLE IF NOT EXISTS hjt_ibbc_tariff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES hjt_tariff_version(id) ON DELETE CASCADE,
  cir_bw_type TEXT NOT NULL,
  type TEXT NOT NULL,
  cir INT NOT NULL,
  up_to_bw INT NOT NULL,
  price_jawa_bali INT NOT NULL,
  per_mb NUMERIC(14, 4) NOT NULL,
  lastmile INT NOT NULL DEFAULT 0,
  UNIQUE(version_id, cir_bw_type)
);

CREATE TABLE IF NOT EXISTS hjt_overhead_param (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES hjt_tariff_version(id) ON DELETE CASCADE,
  fiscal_year INT NOT NULL,
  revenue_base BIGINT NOT NULL,
  pemeliharaan NUMERIC(8, 4) NOT NULL,
  kepegawaian NUMERIC(8, 4) NOT NULL,
  pemasaran NUMERIC(8, 4) NOT NULL,
  adm_umum NUMERIC(8, 4) NOT NULL,
  markup NUMERIC(8, 4) NOT NULL DEFAULT 0.20,
  overhead_pct NUMERIC(8, 4) NOT NULL,
  overhead_plus_har_pct NUMERIC(8, 4) NOT NULL,
  UNIQUE(version_id, fiscal_year)
);

CREATE TABLE IF NOT EXISTS hjt_discount_level (
  id SERIAL PRIMARY KEY,
  version_id UUID NOT NULL REFERENCES hjt_tariff_version(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  disc_rate NUMERIC(8, 6) NOT NULL,
  UNIQUE(version_id, code)
);

CREATE TABLE IF NOT EXISTS hjt_business_param (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES hjt_tariff_version(id) ON DELETE CASCADE,
  margin_floor NUMERIC(8, 4) NOT NULL DEFAULT 0.10,
  margin_recommended NUMERIC(8, 4) NOT NULL DEFAULT 0.20,
  otc_on_net BIGINT NOT NULL DEFAULT 1000000,
  otc_off_net BIGINT NOT NULL DEFAULT 2500000,
  share_icon NUMERIC(8, 4) NOT NULL DEFAULT 0.70,
  share_kawasan NUMERIC(8, 4) NOT NULL DEFAULT 0.30,
  UNIQUE(version_id)
);

CREATE TABLE IF NOT EXISTS hjt_quotation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT,
  npwp TEXT,
  contract_no TEXT,
  contract_year INT DEFAULT 1,
  region_id INT REFERENCES hjt_region(id),
  origin_region TEXT,
  term_region TEXT,
  scheme TEXT NOT NULL DEFAULT 'Subscription' CHECK (scheme IN ('Subscription','OTC')),
  calc_mode TEXT NOT NULL DEFAULT 'standard' CHECK (calc_mode IN ('standard','revenue_sharing')),
  product_type TEXT DEFAULT 'Connectivity',
  duration_years INT NOT NULL DEFAULT 1,
  discount_level TEXT,
  sph_mitra BIGINT,
  target_irr NUMERIC(8, 6),
  disc_backbone NUMERIC(8, 6),
  disc_port NUMERIC(8, 6),
  margin_custom NUMERIC(8, 6),
  share_icon NUMERIC(8, 4) DEFAULT 0.70,
  share_kawasan NUMERIC(8, 4) DEFAULT 0.30,
  tariff_version_id UUID REFERENCES hjt_tariff_version(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected')),
  total_per_month BIGINT,
  grand_total_hjt BIGINT,
  other_expense_total BIGINT,
  grand_total_all BIGINT,
  offer_floor BIGINT,
  offer_recommended BIGINT,
  margin_nominal BIGINT,
  margin_percent NUMERIC(8, 2),
  calc_snapshot JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hjt_lastmile_kkf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capex BIGINT NOT NULL,
  depreciation_years INT NOT NULL DEFAULT 8,
  rev_share NUMERIC(8, 6) NOT NULL DEFAULT 0.20,
  overhead NUMERIC(8, 6) NOT NULL,
  koef_backbone NUMERIC(8, 6) NOT NULL DEFAULT 0.30,
  koef_port NUMERIC(8, 6) NOT NULL DEFAULT 1.0,
  wacc_annual NUMERIC(8, 6) NOT NULL,
  horizon_years INT NOT NULL DEFAULT 2,
  monthly_revenue BIGINT NOT NULL DEFAULT 0,
  backbone_unit INT NOT NULL DEFAULT 0,
  uplink_unit INT NOT NULL DEFAULT 0,
  capacity NUMERIC(12, 4) NOT NULL DEFAULT 1,
  cashflows JSONB NOT NULL DEFAULT '[]',
  irr NUMERIC(12, 8),
  npv BIGINT,
  bcr NUMERIC(12, 6),
  is_feasible BOOLEAN NOT NULL DEFAULT false,
  recommended_lastmile BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hjt_quotation_line (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES hjt_quotation(id) ON DELETE CASCADE,
  product_id INT REFERENCES hjt_product(id),
  capacity NUMERIC(12, 4) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'Mbps',
  qty INT NOT NULL DEFAULT 1,
  backbone INT NOT NULL DEFAULT 0,
  uplink INT NOT NULL DEFAULT 0,
  vas INT NOT NULL DEFAULT 0,
  lastmile INT NOT NULL DEFAULT 0,
  access INT NOT NULL DEFAULT 0,
  tarif INT NOT NULL DEFAULT 0,
  harga_dasar BIGINT NOT NULL DEFAULT 0,
  harga_final BIGINT,
  akses_existing BOOLEAN NOT NULL DEFAULT false,
  lastmile_kkf_id UUID REFERENCES hjt_lastmile_kkf(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE hjt_lastmile_kkf
  ADD COLUMN IF NOT EXISTS quotation_line_id UUID REFERENCES hjt_quotation_line(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS hjt_other_expense (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES hjt_quotation(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  harsat BIGINT NOT NULL DEFAULT 0,
  jumlah INT NOT NULL DEFAULT 1,
  total BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS hjt_approval (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES hjt_quotation(id) ON DELETE CASCADE,
  role_level TEXT NOT NULL,
  approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  decision TEXT CHECK (decision IN ('pending','approved','rejected')),
  note TEXT,
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS hjt_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hjt_tariff_import (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES hjt_tariff_version(id) ON DELETE CASCADE,
  source_filename TEXT,
  source_hash TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded','validating','validated','rejected','committed')),
  total_rows INT NOT NULL DEFAULT 0,
  valid_rows INT NOT NULL DEFAULT 0,
  error_rows INT NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  committed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS hjt_tariff_import_row (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES hjt_tariff_import(id) ON DELETE CASCADE,
  row_no INT NOT NULL,
  product_name TEXT,
  region_code TEXT,
  backbone INT,
  uplink INT,
  vas INT,
  resolved_product_id INT,
  resolved_region_id INT,
  row_status TEXT NOT NULL DEFAULT 'ok',
  error_detail JSONB
);

CREATE INDEX IF NOT EXISTS idx_hjt_quotation_created_by ON hjt_quotation (created_by);
CREATE INDEX IF NOT EXISTS idx_hjt_audit_entity ON hjt_audit_log (entity, entity_id);
