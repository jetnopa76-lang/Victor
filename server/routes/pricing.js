const express = require('express');
const router = express.Router();
const db = require('../db');

// ── CATEGORIES ────────────────────────────────────────────────────

router.get('/categories', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM pricing_categories ORDER BY sort_order, id');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/categories', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const { rows: max } = await db.query('SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM pricing_categories');
    const { rows } = await db.query(
      'INSERT INTO pricing_categories (name, sort_order) VALUES ($1,$2) RETURNING *',
      [name, max[0].n]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/categories/:id', async (req, res) => {
  const { name, sort_order } = req.body;
  try {
    const { rows } = await db.query(
      'UPDATE pricing_categories SET name=COALESCE($1,name), sort_order=COALESCE($2,sort_order) WHERE id=$3 RETURNING *',
      [name, sort_order, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM pricing_categories WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ITEMS ─────────────────────────────────────────────────────────

router.get('/items', async (req, res) => {
  try {
    const { category_id } = req.query;
    let where = '', params = [];
    if (category_id) { where = 'WHERE i.category_id=$1'; params = [category_id]; }
    const { rows } = await db.query(
      `SELECT i.*, c.name AS category_name
       FROM pricing_items i
       JOIN pricing_categories c ON c.id = i.category_id
       ${where}
       ORDER BY i.category_id, i.sort_order, i.id`,
      params
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/items', async (req, res) => {
  const { category_id, name, description, method='flat', rate=0, min_charge=0, unit_label } = req.body;
  if (!category_id || !name) return res.status(400).json({ error: 'category_id and name required' });
  try {
    const { rows: max } = await db.query('SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM pricing_items WHERE category_id=$1', [category_id]);
    const { rows } = await db.query(
      `INSERT INTO pricing_items (category_id, name, description, method, rate, min_charge, unit_label, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [category_id, name, description||'', method, rate, min_charge, unit_label||'', max[0].n]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/items/:id', async (req, res) => {
  const { name, description, method, rate, min_charge, unit_label, active } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE pricing_items SET
         name=COALESCE($1,name), description=COALESCE($2,description),
         method=COALESCE($3,method), rate=COALESCE($4,rate),
         min_charge=COALESCE($5,min_charge), unit_label=COALESCE($6,unit_label),
         active=COALESCE($7,active)
       WHERE id=$8 RETURNING *`,
      [name, description, method, rate, min_charge, unit_label, active, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/items/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM pricing_items WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
