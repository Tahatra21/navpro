-- P3: Katalog layanan/produk OPEX Icon+ (idempotent)
CREATE TABLE IF NOT EXISTS opex_service_catalog (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  icon_key VARCHAR(50) NOT NULL DEFAULT 'box',
  unit VARCHAR(40) NOT NULL DEFAULT 'per_month',
  default_type VARCHAR(10) NOT NULL DEFAULT 'NOMINAL'
    CHECK (default_type IN ('NOMINAL', 'PERCENT')),
  default_amount NUMERIC(18,4) NOT NULL DEFAULT 0,
  default_currency VARCHAR(3) NOT NULL DEFAULT 'IDR',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0
);
