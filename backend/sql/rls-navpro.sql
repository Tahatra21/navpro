-- NAVPRO KKF — Row Level Security (RLS) draft
-- BRD reference: BUSINESS_KKF_NAVPRO_v2.md §5.3 (Data Visibility Scope), §15 (R-05)
--
-- IMPORTANT:
-- - This script is SAFE to apply, but RLS is NOT enabled automatically unless you run the ENABLE block.
-- - To make RLS work from the application, backend must set these per-request settings (GUC variables):
--     SELECT set_config('navpro.user_id', '<uuid>', true);
--     SELECT set_config('navpro.role', '<ROLE>', true);
--     SELECT set_config('navpro.org_unit_id', '<uuid-or-empty>', true);
--     SELECT set_config('navpro.segment', '<ENT1|ENT2|PLN1|PLN2-or-empty>', true);
--
-- Suggested: set them with SET LOCAL inside a transaction (BEGIN ... COMMIT)
--
-- Roles expected (legacy + BRD):
-- SUPER_ADMIN, FINANCE_ADMIN, VP_SA, MANAGER, ASMAN, STAFF, SA, GM_SRM

BEGIN;

-- ---------------------------------------------------------------------------
-- Helper view: current request context (debug friendly)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW navpro_rls_context AS
SELECT
  nullif(current_setting('navpro.user_id', true), '')::uuid AS user_id,
  nullif(current_setting('navpro.role', true), '') AS role,
  nullif(current_setting('navpro.org_unit_id', true), '')::uuid AS org_unit_id,
  nullif(current_setting('navpro.segment', true), '') AS segment;

-- ---------------------------------------------------------------------------
-- Projects RLS policies
-- ---------------------------------------------------------------------------
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_select_policy ON projects;
DROP POLICY IF EXISTS projects_write_policy ON projects;

-- SELECT policy:
-- - SUPER_ADMIN / FINANCE_ADMIN / VP_SA: all
-- - STAFF / SA: own projects (created_by)
-- - ASMAN: projects in same org_unit_id
-- - MANAGER / GM_SRM: projects in same segment
-- Default: deny
CREATE POLICY projects_select_policy ON projects
FOR SELECT
USING (
  (current_setting('navpro.role', true) IN ('SUPER_ADMIN','FINANCE_ADMIN','VP_SA'))
  OR (
    current_setting('navpro.role', true) IN ('STAFF','SA')
    AND created_by = nullif(current_setting('navpro.user_id', true), '')::uuid
  )
  OR (
    current_setting('navpro.role', true) = 'ASMAN'
    AND org_unit_id IS NOT NULL
    AND org_unit_id = nullif(current_setting('navpro.org_unit_id', true), '')::uuid
  )
  OR (
    current_setting('navpro.role', true) IN ('MANAGER','GM_SRM')
    AND segment IS NOT NULL
    AND segment = nullif(current_setting('navpro.segment', true), '')
  )
);

-- WRITE policy (conservative):
-- - SUPER_ADMIN / FINANCE_ADMIN: allow
-- - STAFF / SA: allow ONLY own rows
-- We keep this strict; approval workflow will refine later (DRAFT-only, locking, etc.).
CREATE POLICY projects_write_policy ON projects
FOR INSERT, UPDATE, DELETE
USING (
  (current_setting('navpro.role', true) IN ('SUPER_ADMIN','FINANCE_ADMIN'))
  OR (
    current_setting('navpro.role', true) IN ('STAFF','SA')
    AND created_by = nullif(current_setting('navpro.user_id', true), '')::uuid
  )
)
WITH CHECK (
  (current_setting('navpro.role', true) IN ('SUPER_ADMIN','FINANCE_ADMIN'))
  OR (
    current_setting('navpro.role', true) IN ('STAFF','SA')
    AND created_by = nullif(current_setting('navpro.user_id', true), '')::uuid
  )
);

-- ---------------------------------------------------------------------------
-- Enable block (RUN MANUALLY when backend is ready)
-- ---------------------------------------------------------------------------
-- To enable:
--   ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
-- Optionally force:
--   ALTER TABLE projects FORCE ROW LEVEL SECURITY;
--
-- Note: Once FORCE is enabled, even table owner is restricted unless BYPASSRLS.

COMMIT;

