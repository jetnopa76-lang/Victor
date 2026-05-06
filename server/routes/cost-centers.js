const express = require('express');
const router = express.Router();
const db = require('../db');

// List all centers (optionally filter by kind), with item counts
router.get('/', async (req, res) => {
  try {
    const { kind } = req.query;
    const where = kind ? 'WHERE c.kind=$1' : '';
    const params = kind ? [kind] : [];
    const { rows } = await db.query(
      `SELECT c.*, COUNT(i.id)::int AS item_count
       FROM cost_centers c
       LEFT JOIN cost_center_items i ON i.cost_center_id=c.id
       ${where}
       GROUP BY c.id
       ORDER BY c.kind, c.code`, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create a center
router.post('/', async (req, res) => {
  try {
    const { kind, code, name, sort_order = 0 } = req.body;
    if (!kind || !code || !name) return res.status(400).json({ error: 'kind, code, name required' });
    const { rows } = await db.query(
      'INSERT INTO cost_centers (kind, code, name, sort_order) VALUES ($1,$2,$3,$4) RETURNING *',
      [kind, code, name, sort_order]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { kind, code, name, sort_order } = req.body;
    const { rows } = await db.query(
      'UPDATE cost_centers SET kind=COALESCE($1,kind), code=COALESCE($2,code), name=COALESCE($3,name), sort_order=COALESCE($4,sort_order) WHERE id=$5 RETURNING *',
      [kind, code, name, sort_order, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM cost_centers WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// List all items, joined with center info; optional kind / center filters
router.get('/items', async (req, res) => {
  try {
    const { kind, cost_center_id } = req.query;
    const conds = [];
    const params = [];
    if (kind) { params.push(kind); conds.push('c.kind=$' + params.length); }
    if (cost_center_id) { params.push(cost_center_id); conds.push('i.cost_center_id=$' + params.length); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const { rows } = await db.query(
      `SELECT i.*, c.kind AS cc_kind, c.code AS cc_code, c.name AS cc_name
       FROM cost_center_items i
       JOIN cost_centers c ON c.id=i.cost_center_id
       ${where}
       ORDER BY c.kind, c.code, i.code, i.id`, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/items', async (req, res) => {
  try {
    const { cost_center_id, code, name, mins_per_unit = 0, speed_per_h = 0, setup_min = 0, ai_rate = 0, dm_rate = 0, unit_cost = 0, min_charge = 0, sort_order = 0 } = req.body;
    if (!cost_center_id || !name) return res.status(400).json({ error: 'cost_center_id and name required' });
    const { rows } = await db.query(
      `INSERT INTO cost_center_items (cost_center_id, code, name, mins_per_unit, speed_per_h, setup_min, ai_rate, dm_rate, unit_cost, min_charge, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [cost_center_id, code, name, mins_per_unit, speed_per_h, setup_min, ai_rate, dm_rate, unit_cost, min_charge, sort_order]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/items/:id', async (req, res) => {
  try {
    const f = req.body;
    const { rows } = await db.query(
      `UPDATE cost_center_items SET
         code=COALESCE($1, code),
         name=COALESCE($2, name),
         mins_per_unit=COALESCE($3, mins_per_unit),
         speed_per_h=COALESCE($4, speed_per_h),
         setup_min=COALESCE($5, setup_min),
         ai_rate=COALESCE($6, ai_rate),
         dm_rate=COALESCE($7, dm_rate),
         unit_cost=COALESCE($8, unit_cost),
         min_charge=COALESCE($9, min_charge),
         active=COALESCE($10, active),
         sort_order=COALESCE($11, sort_order)
       WHERE id=$12 RETURNING *`,
      [f.code, f.name, f.mins_per_unit, f.speed_per_h, f.setup_min, f.ai_rate, f.dm_rate, f.unit_cost, f.min_charge, f.active, f.sort_order, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/items/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM cost_center_items WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
