const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all tiers
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT t.*, COUNT(c.id) AS customer_count
       FROM pricing_tiers t
       LEFT JOIN customers c ON c.pricing_tier_id = t.id
       GROUP BY t.id ORDER BY t.name`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET single tier
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM pricing_tiers WHERE id=$1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST create tier
router.post('/', async (req, res) => {
  const { name, margin_override = null, discount_pct = 0, notes = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await db.query(
      `INSERT INTO pricing_tiers (name, margin_override, discount_pct, notes)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, margin_override, discount_pct, notes]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update tier
router.put('/:id', async (req, res) => {
  const { name, margin_override, discount_pct, notes } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE pricing_tiers SET name=$1, margin_override=$2, discount_pct=$3, notes=$4
       WHERE id=$5 RETURNING *`,
      [name, margin_override, discount_pct, notes, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE tier
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM pricing_tiers WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
