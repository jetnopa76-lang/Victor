const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all estimates (with customer + rep names)
router.get('/', async (req, res) => {
  try {
    const { customer_id, rep_id, status } = req.query;
    let where = [];
    let params = [];
    let i = 1;
    if (customer_id) { where.push(`e.customer_id=$${i++}`); params.push(customer_id); }
    if (rep_id)      { where.push(`e.sales_rep_id=$${i++}`); params.push(rep_id); }
    if (status)      { where.push(`e.status=$${i++}`); params.push(status); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const { rows } = await db.query(
      `SELECT e.*,
         CONCAT(c.first_name,' ',c.last_name) AS customer_name, c.company,
         r.name AS rep_name
       FROM estimates e
       LEFT JOIN customers c ON c.id = e.customer_id
       LEFT JOIN sales_reps r ON r.id = e.sales_rep_id
       ${whereClause}
       ORDER BY e.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET single estimate
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT e.*,
         CONCAT(c.first_name,' ',c.last_name) AS customer_name, c.company,
         c.email AS customer_email, c.phone AS customer_phone,
         c.address_line1, c.city, c.state, c.zip,
         r.name AS rep_name, r.email AS rep_email
       FROM estimates e
       LEFT JOIN customers c ON c.id = e.customer_id
       LEFT JOIN sales_reps r ON r.id = e.sales_rep_id
       WHERE e.id=$1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST create estimate
router.post('/', async (req, res) => {
  const {
    customer_id, sales_rep_id, job_name, job_type,
    status = 'draft',
    sell_price, cogs, gross_profit, margin_pct,
    tax_pct = 0, tax_amt = 0,
    comm_pct = 0, comm_amt = 0, net_profit = 0, total,
    job_config, notes
  } = req.body;

  try {
    const { rows: numRow } = await db.query(
      `SELECT 'EST-' || extract(year from now())::text || '-' || LPAD(nextval('estimate_number_seq')::text, 4, '0') AS num`
    );
    const estimateNumber = numRow[0].num;
    const { rows } = await db.query(
      `INSERT INTO estimates (
         estimate_number, customer_id, sales_rep_id, job_name, job_type, status,
         sell_price, cogs, gross_profit, margin_pct,
         tax_pct, tax_amt, comm_pct, comm_amt, net_profit, total,
         job_config, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        estimateNumber, customer_id || null, sales_rep_id || null, job_name, job_type, status,
        sell_price, cogs, gross_profit, margin_pct,
        tax_pct, tax_amt, comm_pct, comm_amt, net_profit, total,
        job_config ? JSON.stringify(job_config) : null, notes
      ]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH update status
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  const valid = ['draft','sent','approved','declined'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    const { rows } = await db.query(
      'UPDATE estimates SET status=$1 WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update estimate
router.put('/:id', async (req, res) => {
  const {
    customer_id, sales_rep_id, job_name, job_type, status,
    sell_price, cogs, gross_profit, margin_pct,
    tax_pct, tax_amt, comm_pct, comm_amt, net_profit, total,
    job_config, notes
  } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE estimates SET
         customer_id=$1, sales_rep_id=$2, job_name=$3, job_type=$4, status=$5,
         sell_price=$6, cogs=$7, gross_profit=$8, margin_pct=$9,
         tax_pct=$10, tax_amt=$11, comm_pct=$12, comm_amt=$13, net_profit=$14, total=$15,
         job_config=$16, notes=$17
       WHERE id=$18 RETURNING *`,
      [
        customer_id || null, sales_rep_id || null, job_name, job_type, status,
        sell_price, cogs, gross_profit, margin_pct,
        tax_pct, tax_amt, comm_pct, comm_amt, net_profit, total,
        job_config ? JSON.stringify(job_config) : null, notes, req.params.id
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE estimate
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM estimates WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
