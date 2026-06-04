-- Unit organisasi admin global (idempotent)
ALTER TABLE organization_units DROP CONSTRAINT IF EXISTS organization_units_type_check;
ALTER TABLE organization_units ADD CONSTRAINT organization_units_type_check
  CHECK (type IN ('PUSAT', 'SBU', 'GLOBAL'));

INSERT INTO organization_units (code, name, type, segment, is_active)
VALUES (
  'GLOBAL-ADMIN',
  'Admin Global NAVPRO (lintas unit)',
  'GLOBAL',
  NULL,
  true
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  is_active = true;

-- Assign admin ke unit global (sesuaikan email jika perlu)
UPDATE users u
SET org_unit_id = ou.id,
    org_level = COALESCE(u.org_level, 'L0')
FROM organization_units ou
WHERE ou.code = 'GLOBAL-ADMIN'
  AND u.role IN ('SUPER_ADMIN', 'FINANCE_ADMIN')
  AND (u.org_unit_id IS NULL OR u.org_unit_id <> ou.id);
