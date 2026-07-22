const express = require('express');
const router = express.Router();
const db = require('../db');

// GET vendors. Optional ?q= filter (name/category), ?all=1 to include inactive.
router.get('/', async (req, res) => {
  try {
    const { q, all } = req.query;
    const conds = [];
    const params = [];
    if (!all) conds.push('active = true');
    if (q) {
      params.push('%' + q + '%');
      conds.push('(name ILIKE $' + params.length + ' OR category ILIKE $' + params.length + ')');
    }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await db.query(
      `SELECT id, name, category, contact, phone, active FROM vendors ${where} ORDER BY name`,
      params
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST create vendor
router.post('/', async (req, res) => {
  const { name, category = null, contact = null, phone = null, active = true } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await db.query(
      `INSERT INTO vendors (name, category, contact, phone, active)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (lower(name)) DO UPDATE SET category=EXCLUDED.category, active=true
       RETURNING *`,
      [name.trim(), category, contact, phone, active]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update vendor
router.put('/:id', async (req, res) => {
  const { name, category, contact, phone, active } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE vendors SET
         name=COALESCE($1,name), category=COALESCE($2,category), contact=COALESCE($3,contact),
         phone=COALESCE($4,phone), active=COALESCE($5,active)
       WHERE id=$6 RETURNING *`,
      [name, category, contact, phone, active, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE vendor
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM vendors WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
