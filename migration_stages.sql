-- Production stages (customizable kanban columns)
CREATE TABLE IF NOT EXISTS production_stages (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  color      VARCHAR(20) NOT NULL DEFAULT '#378ADD',
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default stages
INSERT INTO production_stages (name, color, position) VALUES
  ('Received',             '#378ADD', 0),
  ('Printing',             '#EF9F27', 1),
  ('Finishing / post-press','#7F77DD', 2),
  ('Ready for pickup',     '#1D9E75', 3)
ON CONFLICT DO NOTHING;

-- Add stage_id to orders (replaces production_status text field)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stage_id INTEGER REFERENCES production_stages(id) ON DELETE SET NULL;

-- Set existing orders to first stage
UPDATE orders SET stage_id = (SELECT id FROM production_stages WHERE position = 0 LIMIT 1) WHERE stage_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_stage ON orders(stage_id);
