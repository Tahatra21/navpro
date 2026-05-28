import pg from 'pg';
import dotenv from 'dotenv';
import { applyRlsContext, isRlsEnabled, rlsStorage } from './utils/rls.js';

dotenv.config();

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is not set. Copy backend/.env.example to backend/.env and configure PostgreSQL.'
  );
}

export const pool = new Pool({
  connectionString: databaseUrl,
});

export async function query(text, params) {
  const ctx = rlsStorage.getStore();
  if (!isRlsEnabled() || !ctx?.userId) {
    return pool.query(text, params);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await applyRlsContext(client, ctx);
    const result = await client.query(text, params);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function initDb() {
  await query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE TABLE IF NOT EXISTS organization_units (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(30) UNIQUE NOT NULL,
      name VARCHAR(200) NOT NULL,
      type VARCHAR(20) NOT NULL CHECK (type IN ('PUSAT','SBU')),
      segment VARCHAR(20) CHECK (segment IN ('ENT1','ENT2','PLN1','PLN2')),
      parent_id UUID REFERENCES organization_units(id),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      employee_id VARCHAR(50),
      role VARCHAR(50) NOT NULL,
      org_unit_id UUID REFERENCES organization_units(id),
      org_level VARCHAR(5),
      is_active BOOLEAN NOT NULL DEFAULT true,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS assumptions_master (
      id SERIAL PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by UUID REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS assumptions_history (
      id SERIAL PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by_name VARCHAR(255)
    );

    CREATE TABLE IF NOT EXISTS duration_presets (
      id VARCHAR(50) PRIMARY KEY,
      preset_name VARCHAR(255) NOT NULL,
      duration_months INTEGER NOT NULL,
      category VARCHAR(50) NOT NULL,
      bcr_mandatory NUMERIC(10,4) NOT NULL DEFAULT 1.23,
      bcr_minimum NUMERIC(10,4) NOT NULL DEFAULT 1.08,
      is_active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS sla_config (
      role_key VARCHAR(50) PRIMARY KEY,
      role_name VARCHAR(100) NOT NULL,
      sla_working_days INTEGER NOT NULL DEFAULT 2,
      reminder_hours INTEGER NOT NULL DEFAULT 24,
      escalation_hours INTEGER NOT NULL DEFAULT 48,
      escalate_to_role VARCHAR(50)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      type VARCHAR(10) NOT NULL CHECK (type IN ('capex', 'opex')),
      code VARCHAR(50) NOT NULL,
      UNIQUE (type, code)
    );

    CREATE TABLE IF NOT EXISTS system_config (
      config_key VARCHAR(100) PRIMARY KEY,
      config_val TEXT NOT NULL,
      category VARCHAR(50) NOT NULL,
      data_type VARCHAR(20) NOT NULL DEFAULT 'string',
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      org_unit_id UUID REFERENCES organization_units(id),
      segment VARCHAR(20) CHECK (segment IN ('ENT1','ENT2','PLN1','PLN2')),
      project_code VARCHAR(50) NOT NULL UNIQUE,
      project_name VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
      project_duration_months INTEGER NOT NULL DEFAULT 12
        CHECK (project_duration_months BETWEEN 1 AND 120),
      duration_category VARCHAR(50) NOT NULL DEFAULT 'SHORT_TERM',
      contract_start_date DATE NOT NULL,
      wacc_override NUMERIC(8,4),
      inflation_rate_override NUMERIC(8,6),
      bcr_threshold_override JSONB,
      detail JSONB NOT NULL DEFAULT '{}',
      current_version INTEGER NOT NULL DEFAULT 0,
      rejection_reason TEXT,
      rejected_by UUID REFERENCES users(id),
      rejected_at TIMESTAMPTZ,
      submitted_at TIMESTAMPTZ,
      approved_by UUID REFERENCES users(id),
      approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS approval_steps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      step_order INTEGER NOT NULL,
      approver_level VARCHAR(20) NOT NULL CHECK (approver_level IN ('ASMAN','MANAGER')),
      approver_role VARCHAR(30) NOT NULL,
      assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
      org_unit_id UUID REFERENCES organization_units(id),
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','APPROVED','REJECTED','ESCALATED','DELEGATED','SKIPPED')),
      comments TEXT,
      due_at TIMESTAMPTZ,
      acted_at TIMESTAMPTZ,
      delegated_to UUID REFERENCES users(id),
      is_escalated BOOLEAN NOT NULL DEFAULT false,
      escalated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (project_id, step_order)
    );

    CREATE TABLE IF NOT EXISTS calculation_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      duration_months INTEGER NOT NULL CHECK (duration_months BETWEEN 1 AND 120),
      input_snapshot JSONB NOT NULL,
      result_snapshot JSONB NOT NULL,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_by_name VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (project_id, version_number)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      user_name VARCHAR(255),
      project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL,
      old_val TEXT,
      new_val TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      body TEXT,
      project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sla_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      approval_step_id UUID REFERENCES approval_steps(id) ON DELETE CASCADE,
      role_key VARCHAR(50) NOT NULL,
      event_type VARCHAR(50) NOT NULL,
      due_at TIMESTAMPTZ,
      is_sent BOOLEAN NOT NULL DEFAULT false,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (project_id, approval_step_id, role_key, event_type)
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key VARCHAR(50) PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Non-breaking schema evolution for existing databases.
  await query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50),
      ADD COLUMN IF NOT EXISTS org_unit_id UUID REFERENCES organization_units(id),
      ADD COLUMN IF NOT EXISTS org_level VARCHAR(5);

    ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS org_unit_id UUID REFERENCES organization_units(id),
      ADD COLUMN IF NOT EXISTS segment VARCHAR(20),
      ADD COLUMN IF NOT EXISTS current_version INTEGER,
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
      ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

    ALTER TABLE sla_events
      ADD COLUMN IF NOT EXISTS approval_step_id UUID REFERENCES approval_steps(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS is_sent BOOLEAN,
      ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
  `);

  if (isRlsEnabled()) {
    await ensureRlsPolicies();
    await query(`ALTER TABLE projects ENABLE ROW LEVEL SECURITY`);
    console.log('[navpro] RLS enabled on projects (NAVPRO_RLS_ENABLED=true)');
  }
}

/** Idempotent RLS policy setup (mirrors backend/sql/rls-navpro.sql). */
async function ensureRlsPolicies() {
  await query(`
    CREATE OR REPLACE VIEW navpro_rls_context AS
    SELECT
      nullif(current_setting('navpro.user_id', true), '')::uuid AS user_id,
      nullif(current_setting('navpro.role', true), '') AS role,
      nullif(current_setting('navpro.org_unit_id', true), '')::uuid AS org_unit_id,
      nullif(current_setting('navpro.segment', true), '') AS segment;
  `);

  await query(`ALTER TABLE projects DISABLE ROW LEVEL SECURITY`);
  await query(`DROP POLICY IF EXISTS projects_select_policy ON projects`);
  await query(`DROP POLICY IF EXISTS projects_write_policy ON projects`);

  await query(`
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
  `);

  await query(`
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
  `);
}

export function durationCategory(months) {
  if (months <= 12) return 'SHORT_TERM';
  if (months <= 36) return 'MID_TERM';
  if (months <= 60) return 'LONG_TERM';
  if (months <= 120) return 'EXTENDED';
  return 'CUSTOM';
}

export function rowToProject(row) {
  const detail = row.detail || {};
  return {
    id: row.id,
    project_code: row.project_code,
    project_name: row.project_name,
    status: row.status,
    org_unit_id: row.org_unit_id || null,
    segment: row.segment || null,
    project_duration_months: row.project_duration_months,
    duration_category: row.duration_category,
    contract_start_date:
      row.contract_start_date instanceof Date
        ? row.contract_start_date.toISOString().substring(0, 10)
        : String(row.contract_start_date).substring(0, 10),
    wacc_override: row.wacc_override != null ? parseFloat(row.wacc_override) : null,
    inflation_rate_override:
      row.inflation_rate_override != null ? parseFloat(row.inflation_rate_override) : null,
    bcr_threshold_override: row.bcr_threshold_override,
    created_by: row.created_by,
    created_at: row.created_at,
    customer_name: detail.customer_name,
    contract_number: detail.contract_number,
    pic_sales: detail.pic_sales,
    capex: detail.capex || [],
    opex: detail.opex || [],
    revenue: detail.revenue || [],
    otc_amount: detail.otc_amount,
    kurs_usd_override:
      detail.kurs_usd_override != null ? parseFloat(detail.kurs_usd_override) : null,
    approval_chain: detail.approval_chain || [],
    versions: detail.versions || [],
    cashflow_monthly: detail.cashflow_monthly,
    kpi: detail.kpi,
  };
}

export function projectToDetail(body) {
  return {
    customer_name: body.customer_name,
    contract_number: body.contract_number,
    pic_sales: body.pic_sales,
    capex: body.capex || [],
    opex: body.opex || [],
    revenue: body.revenue || [],
    otc_amount: body.otc_amount,
    kurs_usd_override: body.kurs_usd_override,
    approval_chain: body.approval_chain || [],
    versions: body.versions || [],
    cashflow_monthly: body.cashflow_monthly,
    kpi: body.kpi,
  };
}
