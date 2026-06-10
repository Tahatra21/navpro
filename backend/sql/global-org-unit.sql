-- global-org-unit.sql
-- Fix: set GLOBAL-ADMIN org unit type to GLOBAL (lintas segment)
UPDATE organization_units
SET type = 'GLOBAL', segment = NULL
WHERE code = 'GLOBAL-ADMIN'
  AND type != 'GLOBAL';
