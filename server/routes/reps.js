const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all reps
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, email, phone, commission_pct, active, notes, created_at
       FROM sales_reps ORDER BY name`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET single rep with their customer count and estimate totals
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT r.*,
        COUNT(DISTINCT c.id)  AS customer_count,
        COUNT(DISTINCT e.id)  AS estimate_count,
        COALESCE(SUM(e.sell_price),0) AS total_revenue,
        COALESCE(SUM(e.comm_amt),0)   AS total_commission
       FROM sales_reps r
       LEFT JOIN customers c ON c.sales_rep_id = r.id
       LEFT JOIN estimates e ON e.sales_rep_id = r.id
       WHERE r.id = $1
       GROUP BY r.id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST create rep
router.post('/', async (req, res) => {
  const { name, email, phone, commission_pct = 0, active = true, notes = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await db.query(
      `INSERT INTO sales_reps (name, email, phone, commission_pct, active, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, email, phone, commission_pct, active, notes]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update rep
router.put('/:id', async (req, res) => {
  const { name, email, phone, commission_pct, active, notes } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE sales_reps SET
         name=$1, email=$2, phone=$3, commission_pct=$4, active=$5, notes=$6
       WHERE id=$7 RETURNING *`,
      [name, email, phone, commission_pct, active, notes, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE rep
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM sales_reps WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
