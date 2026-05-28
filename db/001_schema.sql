-- =============================================================================
-- NAVPRO Enterprise — Full Database Schema Dump
-- =============================================================================
-- Generated : 2026-05-28
-- Database  : PostgreSQL 15+
-- Encoding  : UTF-8
--
-- Usage:
--   psql -U navpro -d navpro_db -f 001_schema.sql
--
-- Notes:
--   - Jalankan file ini terlebih dahulu sebelum 002_rls.sql
--   - Schema ini idempotent (CREATE IF NOT EXISTS, ALTER ADD COLUMN IF NOT EXISTS)
--   - Setelah menjalankan schema, jalankan 003_seed.sql untuk data awal
-- =============================================================================

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;

-- =============================================================================
-- EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TABLE: organization_units
-- Hierarki unit organisasi (Pusat / SBU per segmen bisnis)
-- =============================================================================

CREATE TABLE IF NOT EXISTS organization_units (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  code       VARCHAR(30)  NOT NULL UNIQUE,
  name       VARCHAR(200) NOT NULL,
  type       VARCHAR(20)  NOT NULL CHECK (type IN ('PUSAT', 'SBU')),
  segment    VARCHAR(20)  CHECK (segment IN ('ENT1', 'ENT2', 'PLN1', 'PLN2')),
  parent_id  UUID         REFERENCES organization_units(id),
  is_active  BOOLEAN      NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  organization_units                IS 'Unit organisasi (Pusat/SBU) dalam hierarki segmen bisnis';
COMMENT ON COLUMN organization_units.code           IS 'Kode unik unit, contoh: ENT1-001';
COMMENT ON COLUMN organization_units.type           IS 'PUSAT = holding, SBU = strategic business unit';
COMMENT ON COLUMN organization_units.segment        IS 'Segmen bisnis: ENT1, ENT2, PLN1, PLN2';
COMMENT ON COLUMN organization_units.parent_id      IS 'Parent unit (null = top-level)';

-- =============================================================================
-- TABLE: users
-- Data pengguna sistem NAVPRO
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  employee_id   VARCHAR(50),
  role          VARCHAR(50)  NOT NULL,
  org_unit_id   UUID         REFERENCES organization_units(id),
  org_level     VARCHAR(5),
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  users               IS 'Pengguna sistem NAVPRO';
COMMENT ON COLUMN users.role          IS 'SUPER_ADMIN | FINANCE_ADMIN | MANAGER | GM_SRM | ASMAN | SA | STAFF';
COMMENT ON COLUMN users.org_level     IS 'Level jabatan di org unit (opsional, max 5 chars)';
COMMENT ON COLUMN users.employee_id   IS 'NIP/NIK karyawan (opsional)';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hash, cost 12 minimum untuk production';

-- =============================================================================
-- TABLE: assumptions_master
-- Asumsi ekonomi aktif (hanya 1 baris aktif)
-- =============================================================================

CREATE TABLE IF NOT EXISTS assumptions_master (
  id         SERIAL      PRIMARY KEY,
  data       JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID        REFERENCES users(id)
);

COMMENT ON TABLE assumptions_master IS 'Asumsi ekonomi aktif (WACC, inflasi, MARR, dll) — hanya 1 baris aktif';

-- =============================================================================
-- TABLE: assumptions_history
-- Riwayat perubahan asumsi ekonomi
-- =============================================================================

CREATE TABLE IF NOT EXISTS assumptions_history (
  id              SERIAL       PRIMARY KEY,
  data            JSONB        NOT NULL,
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by_name VARCHAR(255)
);

COMMENT ON TABLE assumptions_history IS 'Log perubahan asumsi ekonomi (audit trail)';

-- =============================================================================
-- TABLE: duration_presets
-- Template durasi proyek dengan threshold BCR
-- =============================================================================

CREATE TABLE IF NOT EXISTS duration_presets (
  id              VARCHAR(50)    PRIMARY KEY,
  preset_name     VARCHAR(255)   NOT NULL,
  duration_months INTEGER        NOT NULL,
  category        VARCHAR(50)    NOT NULL,
  bcr_mandatory   NUMERIC(10,4)  NOT NULL DEFAULT 1.23,
  bcr_minimum     NUMERIC(10,4)  NOT NULL DEFAULT 1.08,
  is_active       BOOLEAN        NOT NULL DEFAULT true
);

COMMENT ON TABLE  duration_presets              IS 'Preset durasi proyek dengan threshold BCR per kategori';
COMMENT ON COLUMN duration_presets.bcr_mandatory IS 'Threshold BCR wajib (mandatory threshold)';
COMMENT ON COLUMN duration_presets.bcr_minimum   IS 'Threshold BCR minimum (minimum threshold)';

-- =============================================================================
-- TABLE: sla_config
-- Konfigurasi SLA per role approver
-- =============================================================================

CREATE TABLE IF NOT EXISTS sla_config (
  role_key          VARCHAR(50)  PRIMARY KEY,
  role_name         VARCHAR(100) NOT NULL,
  sla_working_days  INTEGER      NOT NULL DEFAULT 2,
  reminder_hours    INTEGER      NOT NULL DEFAULT 24,
  escalation_hours  INTEGER      NOT NULL DEFAULT 48,
  escalate_to_role  VARCHAR(50)
);

COMMENT ON TABLE  sla_config                   IS 'Konfigurasi SLA untuk setiap role approver';
COMMENT ON COLUMN sla_config.sla_working_days  IS 'Jumlah hari kerja SLA untuk approval';
COMMENT ON COLUMN sla_config.escalation_hours  IS 'Jam setelah SLA melebihi batas sebelum eskalasi';
COMMENT ON COLUMN sla_config.escalate_to_role  IS 'Role yang menerima eskalasi jika SLA terlampaui';

-- =============================================================================
-- TABLE: categories
-- Kategori CAPEX dan OPEX
-- =============================================================================

CREATE TABLE IF NOT EXISTS categories (
  id   SERIAL      PRIMARY KEY,
  type VARCHAR(10) NOT NULL CHECK (type IN ('capex', 'opex')),
  code VARCHAR(50) NOT NULL,
  UNIQUE (type, code)
);

COMMENT ON TABLE  categories      IS 'Kategori biaya CAPEX dan OPEX';
COMMENT ON COLUMN categories.type IS 'capex = Capital Expenditure, opex = Operational Expenditure';
COMMENT ON COLUMN categories.code IS 'Kode kategori, contoh: HARDWARE, SOFTWARE, MAINTENANCE';

-- =============================================================================
-- TABLE: system_config
-- Konfigurasi sistem yang bisa diubah via admin panel
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_config (
  config_key  VARCHAR(100) PRIMARY KEY,
  config_val  TEXT         NOT NULL,
  category    VARCHAR(50)  NOT NULL,
  data_type   VARCHAR(20)  NOT NULL DEFAULT 'string',
  description TEXT
);

COMMENT ON TABLE  system_config            IS 'Konfigurasi sistem runtime (dikelola via admin panel)';
COMMENT ON COLUMN system_config.data_type  IS 'Tipe data nilai: string | number | boolean | json';
COMMENT ON COLUMN system_config.category   IS 'Grup konfigurasi: system | email | approval | calculation';

-- =============================================================================
-- TABLE: projects
-- Proyek investasi/KKF yang diajukan
-- =============================================================================

CREATE TABLE IF NOT EXISTS projects (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by              UUID         REFERENCES users(id) ON DELETE SET NULL,
  org_unit_id             UUID         REFERENCES organization_units(id),
  segment                 VARCHAR(20)  CHECK (segment IN ('ENT1', 'ENT2', 'PLN1', 'PLN2')),
  project_code            VARCHAR(50)  NOT NULL UNIQUE,
  project_name            VARCHAR(255) NOT NULL,
  status                  VARCHAR(50)  NOT NULL DEFAULT 'DRAFT',
  project_duration_months INTEGER      NOT NULL DEFAULT 12
                            CHECK (project_duration_months BETWEEN 1 AND 120),
  duration_category       VARCHAR(50)  NOT NULL DEFAULT 'SHORT_TERM',
  contract_start_date     DATE         NOT NULL,
  wacc_override           NUMERIC(8,4),
  inflation_rate_override NUMERIC(8,6),
  bcr_threshold_override  JSONB,
  detail                  JSONB        NOT NULL DEFAULT '{}',
  current_version         INTEGER      NOT NULL DEFAULT 0,
  rejection_reason        TEXT,
  rejected_by             UUID         REFERENCES users(id),
  rejected_at             TIMESTAMPTZ,
  submitted_at            TIMESTAMPTZ,
  approved_by             UUID         REFERENCES users(id),
  approved_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  projects                        IS 'Proyek KKF (Kelayakan Komersial & Finansial)';
COMMENT ON COLUMN projects.status                 IS 'DRAFT | SUBMITTED | APPROVED | REJECTED | ARCHIVED';
COMMENT ON COLUMN projects.duration_category      IS 'SHORT_TERM (≤12) | MID_TERM (≤36) | LONG_TERM (≤60) | EXTENDED (≤120)';
COMMENT ON COLUMN projects.wacc_override          IS 'Override WACC per proyek (null = gunakan asumsi master)';
COMMENT ON COLUMN projects.inflation_rate_override IS 'Override tingkat inflasi per proyek';
COMMENT ON COLUMN projects.bcr_threshold_override IS 'Override threshold BCR per proyek (JSON: {mandatory, minimum})';
COMMENT ON COLUMN projects.detail                 IS 'Detail proyek (CAPEX, OPEX, Revenue, KPI, cashflow) — lihat projectToDetail()';
COMMENT ON COLUMN projects.current_version        IS 'Nomor versi kalkulasi terkini';

-- =============================================================================
-- TABLE: approval_steps
-- Langkah-langkah persetujuan proyek
-- =============================================================================

CREATE TABLE IF NOT EXISTS approval_steps (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  step_order     INTEGER      NOT NULL,
  approver_level VARCHAR(20)  NOT NULL CHECK (approver_level IN ('ASMAN', 'MANAGER')),
  approver_role  VARCHAR(30)  NOT NULL,
  assigned_to    UUID         REFERENCES users(id) ON DELETE SET NULL,
  org_unit_id    UUID         REFERENCES organization_units(id),
  status         VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'ESCALATED', 'DELEGATED', 'SKIPPED')),
  comments       TEXT,
  due_at         TIMESTAMPTZ,
  acted_at       TIMESTAMPTZ,
  delegated_to   UUID         REFERENCES users(id),
  is_escalated   BOOLEAN      NOT NULL DEFAULT false,
  escalated_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (project_id, step_order)
);

COMMENT ON TABLE  approval_steps                 IS 'Langkah persetujuan proyek (approval workflow)';
COMMENT ON COLUMN approval_steps.approver_level  IS 'Level approver: ASMAN atau MANAGER';
COMMENT ON COLUMN approval_steps.approver_role   IS 'Role spesifik yang dibutuhkan (ASMAN, MANAGER, dll)';
COMMENT ON COLUMN approval_steps.assigned_to     IS 'User yang saat ini bertanggung jawab untuk langkah ini';
COMMENT ON COLUMN approval_steps.delegated_to    IS 'User asal sebelum didelegasikan';
COMMENT ON COLUMN approval_steps.due_at          IS 'Batas waktu SLA untuk langkah ini';

-- =============================================================================
-- TABLE: calculation_versions
-- Snapshot kalkulasi finansial per versi proyek
-- =============================================================================

CREATE TABLE IF NOT EXISTS calculation_versions (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number  INTEGER      NOT NULL,
  duration_months INTEGER      NOT NULL CHECK (duration_months BETWEEN 1 AND 120),
  input_snapshot  JSONB        NOT NULL,
  result_snapshot JSONB        NOT NULL,
  created_by      UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_by_name VARCHAR(255),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, version_number)
);

COMMENT ON TABLE  calculation_versions              IS 'Snapshot kalkulasi finansial KKF per versi proyek';
COMMENT ON COLUMN calculation_versions.input_snapshot  IS 'Input kalkulasi saat versi ini dibuat (JSONB)';
COMMENT ON COLUMN calculation_versions.result_snapshot IS 'Hasil kalkulasi: KPI, cashflow_monthly (JSONB)';

-- =============================================================================
-- TABLE: audit_logs
-- Log audit semua aksi pengguna
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID         REFERENCES users(id) ON DELETE SET NULL,
  user_name  VARCHAR(255),
  project_id UUID         REFERENCES projects(id) ON DELETE SET NULL,
  action     VARCHAR(100) NOT NULL,
  old_val    TEXT,
  new_val    TEXT,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  audit_logs         IS 'Log audit semua aksi pengguna (immutable, append-only)';
COMMENT ON COLUMN audit_logs.action  IS 'LOGIN | LOGOUT | PROJECT_CREATE | PROJECT_UPDATE | APPROVE | REJECT | USER_ROLE_CHANGE | ...';
COMMENT ON COLUMN audit_logs.old_val IS 'Nilai sebelum perubahan (tidak mengandung data sensitif/password)';
COMMENT ON COLUMN audit_logs.new_val IS 'Nilai sesudah perubahan';

-- =============================================================================
-- TABLE: notifications
-- Notifikasi in-app untuk pengguna
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID         REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(255) NOT NULL,
  body       TEXT,
  project_id UUID         REFERENCES projects(id) ON DELETE SET NULL,
  is_read    BOOLEAN      NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE notifications IS 'Notifikasi in-app (approval request, SLA warning, dll)';

-- =============================================================================
-- TABLE: sla_events
-- Event SLA (reminder, eskalasi) yang dijadwalkan
-- =============================================================================

CREATE TABLE IF NOT EXISTS sla_events (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  approval_step_id UUID         REFERENCES approval_steps(id) ON DELETE CASCADE,
  role_key         VARCHAR(50)  NOT NULL,
  event_type       VARCHAR(50)  NOT NULL,
  due_at           TIMESTAMPTZ,
  is_sent          BOOLEAN      NOT NULL DEFAULT false,
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, approval_step_id, role_key, event_type)
);

COMMENT ON TABLE  sla_events            IS 'Event SLA yang terjadwal (reminder, warning, escalation)';
COMMENT ON COLUMN sla_events.event_type IS 'REMINDER | WARNING | ESCALATION';
COMMENT ON COLUMN sla_events.is_sent    IS 'true jika notifikasi sudah dikirim';

-- =============================================================================
-- TABLE: app_meta
-- Metadata aplikasi (versi schema, dll)
-- =============================================================================

CREATE TABLE IF NOT EXISTS app_meta (
  key   VARCHAR(50) PRIMARY KEY,
  value TEXT        NOT NULL
);

COMMENT ON TABLE app_meta IS 'Metadata aplikasi dan schema versi';

-- =============================================================================
-- SCHEMA EVOLUTION (idempotent ALTER TABLE — aman dijalankan ulang)
-- Untuk migrasi database existing yang belum memiliki kolom baru
-- =============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS employee_id  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS org_unit_id  UUID REFERENCES organization_units(id),
  ADD COLUMN IF NOT EXISTS org_level    VARCHAR(5);

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS org_unit_id             UUID REFERENCES organization_units(id),
  ADD COLUMN IF NOT EXISTS segment                 VARCHAR(20),
  ADD COLUMN IF NOT EXISTS current_version         INTEGER,
  ADD COLUMN IF NOT EXISTS rejection_reason        TEXT,
  ADD COLUMN IF NOT EXISTS rejected_by             UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS rejected_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by             UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at             TIMESTAMPTZ;

ALTER TABLE sla_events
  ADD COLUMN IF NOT EXISTS approval_step_id UUID REFERENCES approval_steps(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_sent          BOOLEAN,
  ADD COLUMN IF NOT EXISTS sent_at          TIMESTAMPTZ;

-- =============================================================================
-- INDEXES (untuk performa query utama)
-- =============================================================================

-- projects — filtering by status, created_by, org_unit, segment
CREATE INDEX IF NOT EXISTS idx_projects_status       ON projects (status);
CREATE INDEX IF NOT EXISTS idx_projects_created_by   ON projects (created_by);
CREATE INDEX IF NOT EXISTS idx_projects_org_unit_id  ON projects (org_unit_id);
CREATE INDEX IF NOT EXISTS idx_projects_segment      ON projects (segment);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at   ON projects (updated_at DESC);

-- approval_steps — workflow queue queries
CREATE INDEX IF NOT EXISTS idx_approval_steps_project_id  ON approval_steps (project_id);
CREATE INDEX IF NOT EXISTS idx_approval_steps_assigned_to ON approval_steps (assigned_to);
CREATE INDEX IF NOT EXISTS idx_approval_steps_status      ON approval_steps (status);

-- audit_logs — filtering dan reporting
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_project_id ON audit_logs (project_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);

-- notifications — per-user unread query
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications (is_read) WHERE is_read = false;

-- calculation_versions
CREATE INDEX IF NOT EXISTS idx_calc_versions_project_id ON calculation_versions (project_id);

-- sla_events
CREATE INDEX IF NOT EXISTS idx_sla_events_due_at   ON sla_events (due_at) WHERE is_sent = false;
CREATE INDEX IF NOT EXISTS idx_sla_events_proj     ON sla_events (project_id);

-- =============================================================================
-- META
-- =============================================================================

INSERT INTO app_meta (key, value)
VALUES ('schema_version', '2.0.0')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- =============================================================================
-- END OF 001_schema.sql
-- =============================================================================
