-- ============================================================
-- Print Estimator — Neon Postgres Schema
-- Run this in your Neon SQL Editor to set up the database
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

-- Estimates (linked to customers and reps)
CREATE TABLE IF NOT EXISTS estimates (
  id            SERIAL PRIMARY KEY,
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customers_rep    ON customers(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_customers_tier   ON customers(pricing_tier_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_estimates_customer ON estimates(customer_id);
CREATE INDEX IF NOT EXISTS idx_estimates_rep     ON estimates(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status  ON estimates(status);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
