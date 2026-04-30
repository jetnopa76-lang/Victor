const express = require('express');
const router = express.Router();
const db = require('../db');

const CUSTOMER_SELECT = `
  SELECT
    c.*,
    r.name          AS rep_name,
    r.commission_pct AS rep_commission_pct,
    t.name          AS tier_name,
    t.margin_override AS tier_margin_override,
    t.discount_pct  AS tier_discount_pct,
    COUNT(DISTINCT e.id) AS estimate_count,
    COALESCE(SUM(CASE WHEN e.status='approved' THEN e.total END), 0) AS approved_revenue
  FROM customers c
  LEFT JOIN sales_reps r    ON r.id = c.sales_rep_id
  LEFT JOIN pricing_tiers t ON t.id = c.pricing_tier_id
  LEFT JOIN estimates e     ON e.customer_id = c.id
`;

// GET all customers (with optional search and filters)
router.get('/', async (req, res) => {
  try {
    const { search, rep_id, tier_id, status = 'active' } = req.query;
    let where = [];
    let params = [];
    let i = 1;

    if (status && status !== 'all') {
      where.push(`c.status = $${i++}`);
      params.push(status);
    }
    if (rep_id) {
      where.push(`c.sales_rep_id = $${i++}`);
      params.push(rep_id);
    }
    if (tier_id) {
      where.push(`c.pricing_tier_id = $${i++}`);
      params.push(tier_id);
    }
    if (search) {
      where.push(`(
        c.first_name ILIKE $${i} OR c.last_name ILIKE $${i} OR
        c.company ILIKE $${i} OR c.email ILIKE $${i}
      )`);
      params.push(`%${search}%`);
      i++;
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const { rows } = await db.query(
      `${CUSTOMER_SELECT} ${whereClause}
       GROUP BY c.id, r.name, r.commission_pct, t.name, t.margin_override, t.discount_pct
       ORDER BY c.last_name, c.first_name`,
      params
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET single customer with full details
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `${CUSTOMER_SELECT}
       WHERE c.id = $1
       GROUP BY c.id, r.name, r.commission_pct, t.name, t.margin_override, t.discount_pct`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });

    // Also fetch recent estimates
    const { rows: estimates } = await db.query(
      `SELECT id, job_name, job_type, status, sell_price, total, created_at
       FROM estimates WHERE customer_id=$1
       ORDER BY created_at DESC LIMIT 20`,
      [req.params.id]
    );
    res.json({ ...rows[0], recent_estimates: estimates });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST create customer
router.post('/', async (req, res) => {
  const {
    company, first_name, last_name, email, phone, mobile,
    address_line1, address_line2, city, state, zip, country = 'US',
    sales_rep_id, pricing_tier_id,
    credit_limit, payment_terms, tax_exempt = false, tax_exempt_id,
    status = 'active', source, notes
  } = req.body;

  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'first_name and last_name are required' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO customers (
         company, first_name, last_name, email, phone, mobile,
         address_line1, address_line2, city, state, zip, country,
         sales_rep_id, pricing_tier_id,
         credit_limit, payment_terms, tax_exempt, tax_exempt_id,
         status, source, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING *`,
      [
        company, first_name, last_name, email, phone, mobile,
        address_line1, address_line2, city, state, zip, country,
        sales_rep_id || null, pricing_tier_id || null,
        credit_limit || null, payment_terms, tax_exempt, tax_exempt_id,
        status, source, notes
      ]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update customer
router.put('/:id', async (req, res) => {
  const {
    company, first_name, last_name, email, phone, mobile,
    address_line1, address_line2, city, state, zip, country,
    sales_rep_id, pricing_tier_id,
    credit_limit, payment_terms, tax_exempt, tax_exempt_id,
    status, source, notes
  } = req.body;

  try {
    const { rows } = await db.query(
      `UPDATE customers SET
         company=$1, first_name=$2, last_name=$3, email=$4, phone=$5, mobile=$6,
         address_line1=$7, address_line2=$8, city=$9, state=$10, zip=$11, country=$12,
         sales_rep_id=$13, pricing_tier_id=$14,
         credit_limit=$15, payment_terms=$16, tax_exempt=$17, tax_exempt_id=$18,
         status=$19, source=$20, notes=$21
       WHERE id=$22 RETURNING *`,
      [
        company, first_name, last_name, email, phone, mobile,
        address_line1, address_line2, city, state, zip, country,
        sales_rep_id || null, pricing_tier_id || null,
        credit_limit || null, payment_terms, tax_exempt, tax_exempt_id,
        status, source, notes, req.params.id
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE customer
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM customers WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
