-- =============================================================================
-- NAVPRO Enterprise — Seed Data (Reference Data)
-- =============================================================================
-- Generated : 2026-05-28
-- Database  : PostgreSQL 15+
--
-- Prasyarat: 001_schema.sql dan 002_rls.sql harus sudah dijalankan.
--
-- Usage:
--   psql -U navpro -d navpro_db -f 003_seed.sql
--
-- PERHATIAN:
--   - Seed ini berisi data referensi (org units, presets, SLA, categories)
--   - Semua INSERT menggunakan ON CONFLICT DO NOTHING / DO UPDATE (idempotent)
--   - Password user demo menggunakan placeholder — GANTI sebelum deploy production
--   - Untuk generate password hash: node -e "require('bcryptjs').hash('YourPassword123!', 12).then(console.log)"
-- =============================================================================

BEGIN;

-- =============================================================================
-- ORGANIZATION UNITS
-- Struktur organisasi: 4 Pusat + 9 SBU
-- =============================================================================

-- Level 1: Unit Pusat (tidak ada segment)
INSERT INTO organization_units (code, name, type, segment, parent_id, is_active)
VALUES
  ('PUSAT-ENT1', 'Direktorat Enterprise 1',     'PUSAT', 'ENT1', NULL, true),
  ('PUSAT-ENT2', 'Direktorat Enterprise 2',     'PUSAT', 'ENT2', NULL, true),
  ('PUSAT-PLN1', 'Direktorat Pelanggan 1',      'PUSAT', 'PLN1', NULL, true),
  ('PUSAT-PLN2', 'Direktorat Pelanggan 2',      'PUSAT', 'PLN2', NULL, true)
ON CONFLICT (code) DO NOTHING;

-- Level 2: SBU Enterprise 1
INSERT INTO organization_units (code, name, type, segment, parent_id, is_active)
SELECT 'SBU-ENT1-JKT', 'SBU Enterprise 1 Jakarta',   'SBU', 'ENT1', id, true FROM organization_units WHERE code = 'PUSAT-ENT1'
ON CONFLICT (code) DO NOTHING;

INSERT INTO organization_units (code, name, type, segment, parent_id, is_active)
SELECT 'SBU-ENT1-JBR', 'SBU Enterprise 1 Jawa-Bali', 'SBU', 'ENT1', id, true FROM organization_units WHERE code = 'PUSAT-ENT1'
ON CONFLICT (code) DO NOTHING;

-- Level 2: SBU Enterprise 2
INSERT INTO organization_units (code, name, type, segment, parent_id, is_active)
SELECT 'SBU-ENT2-SUM', 'SBU Enterprise 2 Sumatera',  'SBU', 'ENT2', id, true FROM organization_units WHERE code = 'PUSAT-ENT2'
ON CONFLICT (code) DO NOTHING;

INSERT INTO organization_units (code, name, type, segment, parent_id, is_active)
SELECT 'SBU-ENT2-KTI', 'SBU Enterprise 2 KTI',       'SBU', 'ENT2', id, true FROM organization_units WHERE code = 'PUSAT-ENT2'
ON CONFLICT (code) DO NOTHING;

-- Level 2: SBU Pelanggan 1
INSERT INTO organization_units (code, name, type, segment, parent_id, is_active)
SELECT 'SBU-PLN1-JKT', 'SBU Pelanggan 1 Jakarta',    'SBU', 'PLN1', id, true FROM organization_units WHERE code = 'PUSAT-PLN1'
ON CONFLICT (code) DO NOTHING;

INSERT INTO organization_units (code, name, type, segment, parent_id, is_active)
SELECT 'SBU-PLN1-JBR', 'SBU Pelanggan 1 Jawa-Bali',  'SBU', 'PLN1', id, true FROM organization_units WHERE code = 'PUSAT-PLN1'
ON CONFLICT (code) DO NOTHING;

INSERT INTO organization_units (code, name, type, segment, parent_id, is_active)
SELECT 'SBU-PLN1-SUM', 'SBU Pelanggan 1 Sumatera',   'SBU', 'PLN1', id, true FROM organization_units WHERE code = 'PUSAT-PLN1'
ON CONFLICT (code) DO NOTHING;

-- Level 2: SBU Pelanggan 2
INSERT INTO organization_units (code, name, type, segment, parent_id, is_active)
SELECT 'SBU-PLN2-KTI', 'SBU Pelanggan 2 KTI',        'SBU', 'PLN2', id, true FROM organization_units WHERE code = 'PUSAT-PLN2'
ON CONFLICT (code) DO NOTHING;

INSERT INTO organization_units (code, name, type, segment, parent_id, is_active)
SELECT 'SBU-PLN2-BAL', 'SBU Pelanggan 2 Bali-Nusra',  'SBU', 'PLN2', id, true FROM organization_units WHERE code = 'PUSAT-PLN2'
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- DURATION PRESETS
-- Template durasi proyek dengan threshold BCR per kategori
-- BCR Mandatory = 1.23 (default), BCR Minimum = 1.08 (default)
-- =============================================================================

INSERT INTO duration_presets (id, preset_name, duration_months, category, bcr_mandatory, bcr_minimum, is_active)
VALUES
  -- Short Term (≤12 bulan)
  ('SHORT-06',  '6 Bulan',    6,   'SHORT_TERM', 1.23, 1.08, true),
  ('SHORT-12',  '12 Bulan',   12,  'SHORT_TERM', 1.23, 1.08, true),
  -- Mid Term (13-36 bulan)
  ('MID-18',    '18 Bulan',   18,  'MID_TERM',   1.23, 1.08, true),
  ('MID-24',    '24 Bulan',   24,  'MID_TERM',   1.23, 1.08, true),
  ('MID-36',    '36 Bulan',   36,  'MID_TERM',   1.23, 1.08, true),
  -- Long Term (37-60 bulan)
  ('LONG-48',   '48 Bulan',   48,  'LONG_TERM',  1.23, 1.08, true),
  ('LONG-60',   '60 Bulan',   60,  'LONG_TERM',  1.23, 1.08, true),
  -- Extended (61-120 bulan)
  ('EXT-84',    '84 Bulan',   84,  'EXTENDED',   1.23, 1.08, true),
  ('EXT-120',   '120 Bulan',  120, 'EXTENDED',   1.23, 1.08, true)
ON CONFLICT (id) DO UPDATE SET
  preset_name     = EXCLUDED.preset_name,
  duration_months = EXCLUDED.duration_months,
  category        = EXCLUDED.category,
  bcr_mandatory   = EXCLUDED.bcr_mandatory,
  bcr_minimum     = EXCLUDED.bcr_minimum,
  is_active       = EXCLUDED.is_active;

-- =============================================================================
-- SLA CONFIG
-- Konfigurasi SLA per role approver
-- =============================================================================

INSERT INTO sla_config (role_key, role_name, sla_working_days, reminder_hours, escalation_hours, escalate_to_role)
VALUES
  ('ASMAN',   'Asisten Manager',      3, 24, 48, 'MANAGER'),
  ('MANAGER', 'Manager / GM',         5, 24, 72, 'SUPER_ADMIN')
ON CONFLICT (role_key) DO UPDATE SET
  role_name        = EXCLUDED.role_name,
  sla_working_days = EXCLUDED.sla_working_days,
  reminder_hours   = EXCLUDED.reminder_hours,
  escalation_hours = EXCLUDED.escalation_hours,
  escalate_to_role = EXCLUDED.escalate_to_role;

-- =============================================================================
-- CATEGORIES
-- Kategori CAPEX dan OPEX yang tersedia di form proyek
-- =============================================================================

INSERT INTO categories (type, code)
VALUES
  -- CAPEX
  ('capex', 'HARDWARE'),
  ('capex', 'SOFTWARE'),
  ('capex', 'INFRASTRUKTUR'),
  ('capex', 'LISENSI'),
  ('capex', 'INSTALASI'),
  ('capex', 'PELATIHAN'),
  ('capex', 'LAINNYA_CAPEX'),
  -- OPEX
  ('opex',  'BANDWIDTH'),
  ('opex',  'MAINTENANCE'),
  ('opex',  'SDM'),
  ('opex',  'LISTRIK'),
  ('opex',  'SEWA'),
  ('opex',  'ASURANSI'),
  ('opex',  'LAINNYA_OPEX')
ON CONFLICT (type, code) DO NOTHING;

-- =============================================================================
-- SYSTEM CONFIG
-- Konfigurasi sistem runtime (dikelola via admin panel)
-- =============================================================================

INSERT INTO system_config (config_key, config_val, category, data_type, description)
VALUES
  -- System
  ('app.name',              'NAVPRO',                  'system',      'string',  'Nama aplikasi'),
  ('app.version',           '2.0.0',                   'system',      'string',  'Versi aplikasi'),
  ('maintenance.mode',      'false',                   'system',      'boolean', 'Mode maintenance (true = semua user tidak bisa akses)'),
  -- Calculation defaults
  ('calc.wacc_default',     '0.1200',                  'calculation', 'number',  'WACC default (12%)'),
  ('calc.inflation_default','0.0400',                  'calculation', 'number',  'Tingkat inflasi default (4%)'),
  ('calc.tax_rate',         '0.2200',                  'calculation', 'number',  'Tarif pajak (22%)'),
  ('calc.kurs_usd',         '16000',                   'calculation', 'number',  'Kurs USD/IDR default'),
  -- Approval
  ('approval.max_steps',    '2',                       'approval',    'number',  'Maksimal langkah approval (ASMAN + MANAGER)'),
  -- Pagination
  ('pagination.default_limit', '50',                   'system',      'number',  'Jumlah item default per halaman')
ON CONFLICT (config_key) DO UPDATE SET
  config_val  = EXCLUDED.config_val,
  category    = EXCLUDED.category,
  data_type   = EXCLUDED.data_type,
  description = EXCLUDED.description;

-- =============================================================================
-- ASSUMPTIONS MASTER (default)
-- Asumsi ekonomi awal — update via admin panel sebelum go-live
-- =============================================================================

INSERT INTO assumptions_master (data, updated_by)
SELECT
  jsonb_build_object(
    'wacc',          0.12,
    'inflation_rate', 0.04,
    'tax_rate',       0.22,
    'kurs_usd',       16000,
    'marr',           0.12,
    'bcr_mandatory',  1.23,
    'bcr_minimum',    1.08,
    'opex_escalation',0.03,
    'notes',          'Asumsi awal — diperbarui via Admin Panel'
  ),
  NULL
WHERE NOT EXISTS (SELECT 1 FROM assumptions_master);

-- =============================================================================
-- META
-- =============================================================================

INSERT INTO app_meta (key, value)
VALUES
  ('seed_version',      '2.0.0'),
  ('seed_applied_at',   now()::text),
  ('schema_version',    '2.0.0')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

COMMIT;

-- =============================================================================
-- OPTIONAL: Demo User (HANYA untuk development/staging)
-- JANGAN jalankan di production kecuali mengganti password hash di bawah
-- =============================================================================
-- Untuk generate bcrypt hash (cost 12):
--   node -e "const b=require('bcryptjs'); b.hash('AdminPass123!', 12).then(console.log)"
--
-- Uncomment dan ganti hash untuk membuat admin pertama:
-- =============================================================================
--
-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@navpro.internal') THEN
--     INSERT INTO users (email, password_hash, full_name, role, is_active)
--     VALUES (
--       'admin@navpro.internal',
--       '$2a$12$REPLACE_WITH_BCRYPT_HASH_GENERATED_ABOVE_USING_COST_12xx',
--       'Administrator NAVPRO',
--       'SUPER_ADMIN',
--       true
--     );
--     RAISE NOTICE 'Demo admin user created: admin@navpro.internal';
--   ELSE
--     RAISE NOTICE 'Admin user already exists, skipping.';
--   END IF;
-- END $$;

-- =============================================================================
-- END OF 003_seed.sql
-- =============================================================================
