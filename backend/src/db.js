import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://navpro:navpro_dev@localhost:5432/navpro_db',
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function initDb() {
  await query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
      role_key VARCHAR(50) NOT NULL,
      event_type VARCHAR(50) NOT NULL,
      due_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (project_id, role_key, event_type)
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key VARCHAR(50) PRIMARY KEY,
      value TEXT NOT NULL
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
    approval_chain: body.approval_chain || [],
    versions: body.versions || [],
    cashflow_monthly: body.cashflow_monthly,
    kpi: body.kpi,
  };
}
