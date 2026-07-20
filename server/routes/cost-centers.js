const express = require('express');
const router = express.Router();
const db = require('../db');

// ── DEPARTMENTS (the "kind" groupings of cost centers) ──────────────
router.get('/departments', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM cost_center_departments ORDER BY sort_order, id');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/departments', async (req, res) => {
  try {
    let { kind, label, model = 'speed', sort_order } = req.body;
    if (!label) return res.status(400).json({ error: 'label required' });
    kind = String(kind || label).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
    if (!kind) return res.status(400).json({ error: 'invalid name' });
    if (sort_order == null) {
      const { rows: mx } = await db.query('SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM cost_center_departments');
      sort_order = mx[0].n;
    }
    const { rows } = await db.query(
      'INSERT INTO cost_center_departments (kind, label, model, sort_order) VALUES ($1,$2,$3,$4) RETURNING *',
      [kind, label, model, sort_order]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (String(e.message).includes('unique') || e.code === '23505') return res.status(409).json({ error: 'A department with that name already exists' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/departments/:id', async (req, res) => {
  try {
    const { label, model, sort_order } = req.body;
    const { rows } = await db.query(
      'UPDATE cost_center_departments SET label=COALESCE($1,label), model=COALESCE($2,model), sort_order=COALESCE($3,sort_order) WHERE id=$4 RETURNING *',
      [label, model, sort_order, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/departments/:id', async (req, res) => {
  try {
    const { rows: d } = await db.query('SELECT kind FROM cost_center_departments WHERE id=$1', [req.params.id]);
    if (!d.length) return res.status(404).json({ error: 'Not found' });
    const { rows: cnt } = await db.query('SELECT COUNT(*)::int AS n FROM cost_centers WHERE kind=$1', [d[0].kind]);
    if (cnt[0].n > 0) return res.status(400).json({ error: 'Remove its ' + cnt[0].n + ' cost center(s) first' });
    await db.query('DELETE FROM cost_center_departments WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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
    const { cost_center_id, code, name, mins_per_unit = 0, speed_per_h = 0, setup_min = 0, ai_rate = 0, dm_rate = 0, unit_cost = 0, min_charge = 0, sqft_rate = 0, ink_cmyk = 0, ink_white = 0, sort_order = 0 } = req.body;
    if (!cost_center_id || !name) return res.status(400).json({ error: 'cost_center_id and name required' });
    const { rows } = await db.query(
      `INSERT INTO cost_center_items (cost_center_id, code, name, mins_per_unit, speed_per_h, setup_min, ai_rate, dm_rate, unit_cost, min_charge, sqft_rate, ink_cmyk, ink_white, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [cost_center_id, code, name, mins_per_unit, speed_per_h, setup_min, ai_rate, dm_rate, unit_cost, min_charge, sqft_rate, ink_cmyk, ink_white, sort_order]);
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
         sort_order=COALESCE($11, sort_order),
         sqft_rate=COALESCE($13, sqft_rate),
         ink_cmyk=COALESCE($14, ink_cmyk),
         ink_white=COALESCE($15, ink_white)
       WHERE id=$12 RETURNING *`,
      [f.code, f.name, f.mins_per_unit, f.speed_per_h, f.setup_min, f.ai_rate, f.dm_rate, f.unit_cost, f.min_charge, f.active, f.sort_order, req.params.id, f.sqft_rate, f.ink_cmyk, f.ink_white]);
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
