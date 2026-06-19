/** Idempotent column adds for HJT phase 4+. */
export async function migrateHjtColumns(query) {
  await query(`
    ALTER TABLE hjt_quotation
      ADD COLUMN IF NOT EXISTS harga_final BIGINT,
      ADD COLUMN IF NOT EXISTS floor_override_justification TEXT,
      ADD COLUMN IF NOT EXISTS current_approval_role VARCHAR(50),
      ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS rejected_note TEXT,
      ADD COLUMN IF NOT EXISTS org_unit_id UUID REFERENCES organization_units(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS segment VARCHAR(20),
      ADD COLUMN IF NOT EXISTS linked_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_hjt_tariff_lookup
      ON hjt_tariff (version_id, product_id, region_id);
  `);
}
