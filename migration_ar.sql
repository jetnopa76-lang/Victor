-- ============================================================
-- Victor — Accounts Receivable Schema
-- Run in Neon SQL Editor
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS credit_memo_seq START 1;

-- Invoices
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

-- Payments received against invoices
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

-- Credit memos
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_customer  ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order     ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status    ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_invoice   ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credits_customer   ON credit_memos(customer_id);

-- Auto-update trigger for invoices
CREATE OR REPLACE TRIGGER trg_invoices_updated
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
