-- ============================================================
-- Print Estimator ("victor") — Complete Neon Postgres Schema
-- Run this ENTIRE file in your Neon SQL Editor to set up the database.
-- It is idempotent (safe to re-run) and now includes everything the
-- app needs: estimates, orders, invoices/AR, production stages,
-- materials, cost centers, and users. The separate migration_*.sql
-- files remain only for upgrading older databases.
-- ============================================================

-- Shared trigger function to keep updated_at fresh
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sequences for human-readable document numbers
CREATE SEQUENCE IF NOT EXISTS estimate_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS order_number_seq    START 1;
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq  START 1;
CREATE SEQUENCE IF NOT EXISTS credit_memo_seq     START 1;

-- ============================================================
-- Core CRM
-- ============================================================

-- Sales reps
CREATE TABLE IF NOT EXISTS sales_reps (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150),
  phone       VARCHAR(30),
  commission_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pricing tiers
CREATE TABLE IF NOT EXISTS pricing_tiers (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,  -- e.g. "Retail", "Wholesale", "VIP"
  margin_override NUMERIC(5,2),           -- NULL = use job default
  discount_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,  -- flat % off sell price
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id              SERIAL PRIMARY KEY,
  -- Contact
  company         VARCHAR(150),
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  email           VARCHAR(150),
  phone           VARCHAR(30),
  mobile          VARCHAR(30),
  -- Billing address
  address_line1   VARCHAR(200),
  address_line2   VARCHAR(200),
  city            VARCHAR(100),
  state           VARCHAR(50),
  zip             VARCHAR(20),
  country         VARCHAR(80) NOT NULL DEFAULT 'US',
  -- Relationships
  sales_rep_id    INTEGER REFERENCES sales_reps(id) ON DELETE SET NULL,
  pricing_tier_id INTEGER REFERENCES pricing_tiers(id) ON DELETE SET NULL,
  -- Credit / payment
  credit_limit    NUMERIC(10,2),
  payment_terms   VARCHAR(50),            -- e.g. "Net 30", "COD", "Prepay"
  tax_exempt      BOOLEAN NOT NULL DEFAULT false,
  tax_exempt_id   VARCHAR(50),
  -- Meta
  status          VARCHAR(20) NOT NULL DEFAULT 'active', -- active | inactive
  source          VARCHAR(80),            -- how they found you
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Production stages (customizable kanban columns for orders)
-- ============================================================
CREATE TABLE IF NOT EXISTS production_stages (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  color      VARCHAR(20) NOT NULL DEFAULT '#378ADD',
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Estimates (linked to customers and reps)
-- ============================================================
CREATE TABLE IF NOT EXISTS estimates (
  id              SERIAL PRIMARY KEY,
  estimate_number VARCHAR(30) UNIQUE,      -- e.g. "EST-2026-0001"
  customer_id   INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  sales_rep_id  INTEGER REFERENCES sales_reps(id) ON DELETE SET NULL,
  job_name      VARCHAR(200) NOT NULL,
  job_type      VARCHAR(20) NOT NULL,     -- digital | wide
  status        VARCHAR(20) NOT NULL DEFAULT 'draft',
  -- Pricing snapshot
  sell_price    NUMERIC(10,2) NOT NULL DEFAULT 0,
  cogs          NUMERIC(10,2) NOT NULL DEFAULT 0,
  gross_profit  NUMERIC(10,2) NOT NULL DEFAULT 0,
  margin_pct    NUMERIC(5,2),
  tax_pct       NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amt       NUMERIC(10,2) NOT NULL DEFAULT 0,
  comm_pct      NUMERIC(5,2) NOT NULL DEFAULT 0,
  comm_amt      NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_profit    NUMERIC(10,2) NOT NULL DEFAULT 0,
  total         NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Full job config stored as JSON
  job_config    JSONB,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- For databases created before estimate_number existed:
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS estimate_number VARCHAR(30);

-- ============================================================
-- Orders (a job in production, usually converted from an estimate)
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id                SERIAL PRIMARY KEY,
  job_number        VARCHAR(30) NOT NULL UNIQUE,   -- e.g. "JOB-2026-0001"
  estimate_id       INTEGER REFERENCES estimates(id) ON DELETE SET NULL,
  customer_id       INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  sales_rep_id      INTEGER REFERENCES sales_reps(id) ON DELETE SET NULL,
  job_name          VARCHAR(200) NOT NULL,
  job_type          VARCHAR(20),
  due_date          DATE,
  operator          VARCHAR(100),
  stage_id          INTEGER REFERENCES production_stages(id) ON DELETE SET NULL,
  production_status VARCHAR(30) NOT NULL DEFAULT 'received',
  payment_status    VARCHAR(20) NOT NULL DEFAULT 'unpaid', -- unpaid | partial | paid
  deposit_amt       NUMERIC(10,2) NOT NULL DEFAULT 0,
  sell_price        NUMERIC(10,2) NOT NULL DEFAULT 0,
  total             NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Accounts Receivable — invoices, payments, credit memos
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id               SERIAL PRIMARY KEY,
  invoice_number   VARCHAR(30) NOT NULL UNIQUE,
  order_id         INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  customer_id      INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  sales_rep_id     INTEGER REFERENCES sales_reps(id) ON DELETE SET NULL,
  -- Status: draft | sent | partial | paid | overdue | void
  status           VARCHAR(20) NOT NULL DEFAULT 'draft',
  issue_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date         DATE,
  -- Amounts
  subtotal         NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_pct          NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amt          NUMERIC(10,2) NOT NULL DEFAULT 0,
  total            NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid      NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance_due      NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Line items stored as JSON
  line_items       JSONB,
  notes            TEXT,
  reminder_sent_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_payments (
  id             SERIAL PRIMARY KEY,
  invoice_id     INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  customer_id    INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  payment_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  amount         NUMERIC(10,2) NOT NULL,
  method         VARCHAR(30),   -- check | cash | credit_card | ach | wire | other
  reference      VARCHAR(100),  -- check number, transaction ID, etc.
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_memos (
  id             SERIAL PRIMARY KEY,
  memo_number    VARCHAR(30) NOT NULL UNIQUE,
  invoice_id     INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  customer_id    INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  memo_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  amount         NUMERIC(10,2) NOT NULL,
  reason         TEXT,
  applied        BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Materials catalog (digital / general stock)
-- ============================================================
CREATE TABLE IF NOT EXISTS material_categories (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(120) NOT NULL,
  pricing_method VARCHAR(30) NOT NULL DEFAULT 'per_sqft', -- per_sqft | per_sheet | per_unit
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS materials (
  id           SERIAL PRIMARY KEY,
  category_id  INTEGER NOT NULL REFERENCES material_categories(id) ON DELETE CASCADE,
  name         VARCHAR(200) NOT NULL,
  description  TEXT DEFAULT '',
  sku          VARCHAR(80) DEFAULT '',
  cost         NUMERIC(10,4) NOT NULL DEFAULT 0,
  unit         VARCHAR(40) DEFAULT '',
  width_in     NUMERIC(8,2),
  length_in    NUMERIC(8,2),
  active       BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Wide-format materials (roll goods lookup)
-- ============================================================
CREATE TABLE IF NOT EXISTS wide_format_materials (
  id            SERIAL PRIMARY KEY,
  material_code VARCHAR(50) NOT NULL,
  name          VARCHAR(200),
  category      VARCHAR(100),
  roll_width_in NUMERIC(8,2),
  cost_per_sqft NUMERIC(10,4),
  vendor        VARCHAR(150),
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Cost centers (labor / equipment rate cards) and their items
-- ============================================================
-- Departments = the "kind" groupings of cost centers (user-manageable).
CREATE TABLE IF NOT EXISTS cost_center_departments (
  id         SERIAL PRIMARY KEY,
  kind       VARCHAR(40) NOT NULL UNIQUE,       -- key stored in cost_centers.kind
  label      VARCHAR(100) NOT NULL,             -- display name
  model      VARCHAR(30) NOT NULL DEFAULT 'speed', -- item field-set: prepress|press|digital|speed
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO cost_center_departments (kind, label, model, sort_order) VALUES
  ('prepress','Prepress','prepress',0),
  ('press','Wide Format Press','press',1),
  ('digital','Digital Press','digital',2),
  ('postpress','Postpress','speed',3),
  ('bindery','Bindery','speed',4),
  ('outside_services','Outside Services','speed',5)
ON CONFLICT (kind) DO NOTHING;

CREATE TABLE IF NOT EXISTS cost_centers (
  id         SERIAL PRIMARY KEY,
  kind       VARCHAR(40) NOT NULL,   -- e.g. prepress | press | postpress | digital
  code       VARCHAR(40) NOT NULL,
  name       VARCHAR(150) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cost_center_items (
  id              SERIAL PRIMARY KEY,
  cost_center_id  INTEGER NOT NULL REFERENCES cost_centers(id) ON DELETE CASCADE,
  code            VARCHAR(40),
  name            VARCHAR(150) NOT NULL,
  mins_per_unit   NUMERIC(12,4) NOT NULL DEFAULT 0,
  speed_per_h     NUMERIC(12,4) NOT NULL DEFAULT 0,
  setup_min       NUMERIC(12,4) NOT NULL DEFAULT 0,
  ai_rate         NUMERIC(12,4) NOT NULL DEFAULT 0,  -- all-inclusive hourly rate
  dm_rate         NUMERIC(12,4) NOT NULL DEFAULT 0,  -- direct material hourly rate
  unit_cost       NUMERIC(12,4) NOT NULL DEFAULT 0,
  min_charge      NUMERIC(12,4) NOT NULL DEFAULT 0,
  -- Press cost model: setup_min holds a flat setup $; the rest are $/sq ft
  sqft_rate       NUMERIC(12,4) NOT NULL DEFAULT 0,  -- press run cost per sq ft
  ink_cmyk        NUMERIC(12,4) NOT NULL DEFAULT 0,  -- CMYK ink cost per sq ft
  ink_white       NUMERIC(12,4) NOT NULL DEFAULT 0,  -- white ink cost per sq ft
  active          BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- For databases created before the press ink/sqft model existed:
ALTER TABLE cost_center_items ADD COLUMN IF NOT EXISTS sqft_rate NUMERIC(12,4) NOT NULL DEFAULT 0;
ALTER TABLE cost_center_items ADD COLUMN IF NOT EXISTS ink_cmyk  NUMERIC(12,4) NOT NULL DEFAULT 0;
ALTER TABLE cost_center_items ADD COLUMN IF NOT EXISTS ink_white NUMERIC(12,4) NOT NULL DEFAULT 0;

-- ============================================================
-- Users (PIN-based login)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  role       VARCHAR(40) NOT NULL,   -- admin | estimator | operator | ...
  pin_hash   VARCHAR(64) NOT NULL,   -- sha256 hex of the PIN
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_customers_rep      ON customers(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_customers_tier     ON customers(pricing_tier_id);
CREATE INDEX IF NOT EXISTS idx_customers_status   ON customers(status);
CREATE INDEX IF NOT EXISTS idx_estimates_customer ON estimates(customer_id);
CREATE INDEX IF NOT EXISTS idx_estimates_rep      ON estimates(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status   ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer    ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_rep         ON orders(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_orders_stage       ON orders(stage_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer  ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order     ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status    ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_invoice   ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credits_customer   ON credit_memos(customer_id);
CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category_id);
CREATE INDEX IF NOT EXISTS idx_cci_center         ON cost_center_items(cost_center_id);

-- ============================================================
-- Auto-update updated_at triggers
-- ============================================================
CREATE OR REPLACE TRIGGER trg_customers_updated
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_sales_reps_updated
  BEFORE UPDATE ON sales_reps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_pricing_tiers_updated
  BEFORE UPDATE ON pricing_tiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_estimates_updated
  BEFORE UPDATE ON estimates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_orders_updated
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_invoices_updated
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Seed data (optional — delete if you don't want sample data)
-- ============================================================
INSERT INTO sales_reps (name, email, phone, commission_pct) VALUES
  ('Alex Carter',   'alex@yourshop.com',  '561-555-0101', 8.00),
  ('Jordan Miles',  'jordan@yourshop.com','561-555-0102', 7.50),
  ('Sam Rivera',    'sam@yourshop.com',   '561-555-0103', 6.00)
ON CONFLICT DO NOTHING;

INSERT INTO pricing_tiers (name, margin_override, discount_pct, notes) VALUES
  ('Retail',     NULL,  0,    'Standard retail pricing'),
  ('Wholesale',  40.0,  10.0, '10% off sell price, 40% margin floor'),
  ('VIP',        35.0,  15.0, 'Top accounts — 15% discount'),
  ('Non-profit', 30.0,  20.0, 'Non-profit rate')
ON CONFLICT DO NOTHING;

INSERT INTO production_stages (name, color, position) VALUES
  ('Received',              '#378ADD', 0),
  ('Printing',              '#EF9F27', 1),
  ('Finishing / post-press','#7F77DD', 2),
  ('Ready for pickup',      '#1D9E75', 3)
ON CONFLICT DO NOTHING;
