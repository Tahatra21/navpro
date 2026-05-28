-- =============================================================================
-- NAVPRO Enterprise — Row Level Security (RLS) Policies
-- =============================================================================
-- Generated : 2026-05-28
-- Database  : PostgreSQL 15+
--
-- Prasyarat: 001_schema.sql harus sudah dijalankan terlebih dahulu.
--
-- Usage:
--   psql -U navpro -d navpro_db -f 002_rls.sql
--
-- RLS hanya aktif jika NAVPRO_RLS_ENABLED=true di environment backend.
-- Backend mengatur GUC variables berikut per-request (dalam transaction):
--
--   SELECT set_config('navpro.user_id',    '<uuid>',              true);
--   SELECT set_config('navpro.role',       '<ROLE>',              true);
--   SELECT set_config('navpro.org_unit_id','<uuid-or-empty>',     true);
--   SELECT set_config('navpro.segment',    '<ENT1|ENT2|...>',     true);
--
-- Matrix visibilitas data (§5.3 BRD):
-- ┌─────────────────────────────────────────────────────┐
-- │ Role          │ Scope Visibilitas                    │
-- ├─────────────────────────────────────────────────────┤
-- │ SUPER_ADMIN   │ Semua proyek                         │
-- │ FINANCE_ADMIN │ Semua proyek                         │
-- │ VP_SA         │ Semua proyek                         │
-- │ MANAGER       │ Proyek dalam segment yang sama       │
-- │ GM_SRM        │ Proyek dalam segment yang sama       │
-- │ ASMAN         │ Proyek dalam org_unit yang sama      │
-- │ SA / STAFF    │ Hanya proyek milik sendiri (owner)   │
-- └─────────────────────────────────────────────────────┘
-- =============================================================================

BEGIN;

-- =============================================================================
-- HELPER VIEW: RLS Context (untuk debugging)
-- =============================================================================

CREATE OR REPLACE VIEW navpro_rls_context AS
SELECT
  nullif(current_setting('navpro.user_id',    true), '')::uuid AS user_id,
  nullif(current_setting('navpro.role',        true), '')       AS role,
  nullif(current_setting('navpro.org_unit_id', true), '')::uuid AS org_unit_id,
  nullif(current_setting('navpro.segment',     true), '')       AS segment;

COMMENT ON VIEW navpro_rls_context IS
  'View helper untuk melihat context RLS aktif per koneksi — gunakan untuk debugging';

-- =============================================================================
-- PROJECTS — RLS Policies
-- =============================================================================

-- Reset: disable dulu sebelum drop policy (agar aman dijalankan ulang)
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_select_policy ON projects;
DROP POLICY IF EXISTS projects_write_policy  ON projects;

-- -----------------------------------------------------------------------------
-- SELECT Policy:
-- Role SUPER_ADMIN / FINANCE_ADMIN / VP_SA → semua proyek
-- ASMAN → proyek dalam org_unit yang sama
-- MANAGER / GM_SRM → proyek dalam segment yang sama
-- STAFF / SA → hanya proyek yang mereka buat (created_by = user_id)
-- Default: DENY (RLS default deny)
-- -----------------------------------------------------------------------------
CREATE POLICY projects_select_policy ON projects
FOR SELECT
USING (
  -- Admin level: akses penuh
  (current_setting('navpro.role', true) IN ('SUPER_ADMIN', 'FINANCE_ADMIN', 'VP_SA'))

  -- Staff/SA: hanya proyek sendiri
  OR (
    current_setting('navpro.role', true) IN ('STAFF', 'SA')
    AND created_by = nullif(current_setting('navpro.user_id', true), '')::uuid
  )

  -- ASMAN: proyek dalam unit organisasi yang sama
  OR (
    current_setting('navpro.role', true) = 'ASMAN'
    AND org_unit_id IS NOT NULL
    AND org_unit_id = nullif(current_setting('navpro.org_unit_id', true), '')::uuid
  )

  -- MANAGER / GM_SRM: proyek dalam segmen bisnis yang sama
  OR (
    current_setting('navpro.role', true) IN ('MANAGER', 'GM_SRM')
    AND segment IS NOT NULL
    AND segment = nullif(current_setting('navpro.segment', true), '')
  )
);

-- -----------------------------------------------------------------------------
-- WRITE Policy (INSERT, UPDATE, DELETE):
-- Admin: SUPER_ADMIN dan FINANCE_ADMIN dapat menulis semua
-- STAFF/SA: hanya dapat memodifikasi proyek yang mereka buat
-- Role lain (ASMAN, MANAGER, dll): TIDAK dapat INSERT/UPDATE/DELETE langsung
--   (mereka berinteraksi via approval workflow, bukan direct write)
-- -----------------------------------------------------------------------------
CREATE POLICY projects_write_policy ON projects
FOR ALL  -- Covers INSERT, UPDATE, DELETE
USING (
  (current_setting('navpro.role', true) IN ('SUPER_ADMIN', 'FINANCE_ADMIN'))
  OR (
    current_setting('navpro.role', true) IN ('STAFF', 'SA')
    AND created_by = nullif(current_setting('navpro.user_id', true), '')::uuid
  )
)
WITH CHECK (
  (current_setting('navpro.role', true) IN ('SUPER_ADMIN', 'FINANCE_ADMIN'))
  OR (
    current_setting('navpro.role', true) IN ('STAFF', 'SA')
    AND created_by = nullif(current_setting('navpro.user_id', true), '')::uuid
  )
);

-- =============================================================================
-- ENABLE RLS
-- =============================================================================
-- PENTING: RLS aktif hanya ketika NAVPRO_RLS_ENABLED=true di backend.
-- Script ini mengaktifkan RLS di level database.
-- Uncomment FORCE jika ingin memastikan table owner pun terkena RLS.
-- =============================================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE projects FORCE ROW LEVEL SECURITY; -- Uncomment untuk enforce juga ke superuser

COMMENT ON TABLE projects IS
  'RLS AKTIF: Visibilitas dikontrol berdasarkan navpro.role, navpro.user_id, navpro.org_unit_id, navpro.segment';

-- =============================================================================
-- VERIFIKASI (opsional — jalankan secara manual setelah setup)
-- =============================================================================
-- Untuk verifikasi RLS berfungsi:
--
--   BEGIN;
--   SELECT set_config('navpro.user_id',    'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', true);
--   SELECT set_config('navpro.role',        'SA', true);
--   SELECT set_config('navpro.org_unit_id', '', true);
--   SELECT set_config('navpro.segment',     '', true);
--   SELECT count(*) FROM projects;  -- Harus hanya mengembalikan proyek milik user tersebut
--   ROLLBACK;

COMMIT;

-- =============================================================================
-- END OF 002_rls.sql
-- =============================================================================
