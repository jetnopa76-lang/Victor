const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');

function hashPin(pin) {
  return crypto.createHash('sha256').update(String(pin)).digest('hex');
}

// Verify PIN and return user
router.post('/login', async (req, res) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'PIN required' });
  try {
    const { rows } = await db.query(
      'SELECT id, name, role FROM users WHERE pin_hash=$1 AND active=true LIMIT 1',
      [hashPin(pin)]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid PIN' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get all users (admin only)
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, name, role, active, created_at FROM users ORDER BY id');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create user
router.post('/', async (req, res) => {
  const { name, role, pin } = req.body;
  if (!name || !role || !pin) return res.status(400).json({ error: 'name, role, pin required' });
  try {
    const { rows } = await db.query(
      'INSERT INTO users (name, role, pin_hash) VALUES ($1,$2,$3) RETURNING id, name, role, active',
      [name, role, hashPin(pin)]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Update user
router.put('/:id', async (req, res) => {
  const { name, role, pin, active } = req.body;
  try {
    let query, params;
    if (pin) {
      query = 'UPDATE users SET name=COALESCE($1,name), role=COALESCE($2,role), pin_hash=$3, active=COALESCE($4,active) WHERE id=$5 RETURNING id, name, role, active';
      params = [name, role, hashPin(pin), active, req.params.id];
    } else {
      query = 'UPDATE users SET name=COALESCE($1,name), role=COALESCE($2,role), active=COALESCE($3,active) WHERE id=$4 RETURNING id, name, role, active';
      params = [name, role, active, req.params.id];
    }
    const { rows } = await db.query(query, params);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete user
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
