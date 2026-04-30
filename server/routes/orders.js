const express = require('express');
const router = express.Router();
const db = require('../db');

async function generateJobNumber(client) {
  const { rows } = await client.query(`SELECT LPAD(nextval('order_number_seq')::text, 4, '0') AS num`);
  const year = new Date().getFullYear();
  return `JOB-${year}-${rows[0].num}`;
}

router.get('/stages', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM production_stages ORDER BY position, id');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/stages', async (req, res) => {
  const { name, color = '#888780' } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows: max } = await db.query('SELECT COALESCE(MAX(position),0)+1 AS pos FROM production_stages');
    const { rows } = await db.query(
      'INSERT INTO production_stages (name, color, position) VALUES ($1,$2,$3) RETURNING *',
      [name, color, max[0].pos]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/stages/:id', async (req, res) => {
  const { name, color, position } = req.body;
  try {
    const { rows } = await db.query(
      'UPDATE production_stages SET name=COALESCE($1,name), color=COALESCE($2,color), position=COALESCE($3,position) WHERE id=$4 RETURNING *',
      [name, color, position, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/stages/:id', async (req, res) => {
  try {
    await db.query('UPDATE orders SET stage_id=NULL WHERE stage_id=$1', [req.params.id]);
    await db.query('DELETE FROM production_stages WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', async (req, res) => {
  try {
    const { stage_id, payment_status, search } = req.query;
    let where = [], params = [], i = 1;
    if (stage_id) { where.push(`o.stage_id=$${i++}`); params.push(stage_id); }
    if (payment_status) { where.push(`o.payment_status=$${i++}`); params.push(payment_status); }
    if (search) {
      where.push(`(o.job_number ILIKE $${i} OR o.job_name ILIKE $${i} OR CONCAT(c.first_name,' ',c.last_name) ILIKE $${i} OR c.company ILIKE $${i})`);
      params.push(`%${search}%`); i++;
    }
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const { rows } = await db.query(
      `SELECT o.*, CONCAT(c.first_name,' ',c.last_name) AS customer_name, c.company,
         r.name AS rep_name, s.name AS stage_name, s.color AS stage_color, s.position AS stage_position
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN sales_reps r ON r.id = o.sales_rep_id
       LEFT JOIN production_stages s ON s.id = o.stage_id
       ${whereClause} ORDER BY s.position, o.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT o.*, CONCAT(c.first_name,' ',c.last_name) AS customer_name, c.company,
         c.email AS customer_email, c.phone AS customer_phone, r.name AS rep_name,
         s.name AS stage_name, s.color AS stage_color
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN sales_reps r ON r.id = o.sales_rep_id
       LEFT JOIN production_stages s ON s.id = o.stage_id
       WHERE o.id=$1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/convert/:estimateId', async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: est } = await client.query(
      `SELECT e.*, CONCAT(c.first_name,' ',c.last_name) AS customer_name
       FROM estimates e LEFT JOIN customers c ON c.id = e.customer_id WHERE e.id=$1`,
      [req.params.estimateId]
    );
    if (!est.length) return res.status(404).json({ error: 'Estimate not found' });
    const e = est[0];
    const jobNumber = await generateJobNumber(client);
    const { due_date, operator, notes, deposit_amt = 0, payment_status = 'unpaid', stage_id } = req.body;
    let stageId = stage_id;
    if (!stageId) {
      const { rows: fs } = await client.query('SELECT id FROM production_stages ORDER BY position LIMIT 1');
      stageId = fs.length ? fs[0].id : null;
    }
    const { rows } = await client.query(
      `INSERT INTO orders (job_number, estimate_id, customer_id, sales_rep_id, job_name, job_type, due_date, operator, stage_id, production_status, payment_status, deposit_amt, total, sell_price, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'received',$10,$11,$12,$13,$14) RETURNING *`,
      [jobNumber, e.id, e.customer_id, e.sales_rep_id, e.job_name, e.job_type, due_date||null, operator||null, stageId, payment_status, deposit_amt, e.total, e.sell_price, notes||e.notes]
    );
    await client.query(`UPDATE estimates SET status='approved' WHERE id=$1`, [e.id]);
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

router.post('/', async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const jobNumber = await generateJobNumber(client);
    const { customer_id, sales_rep_id, job_name, job_type, due_date, operator, payment_status='unpaid', deposit_amt=0, total=0, sell_price=0, notes, stage_id } = req.body;
    let stageId = stage_id;
    if (!stageId) {
      const { rows: fs } = await client.query('SELECT id FROM production_stages ORDER BY position LIMIT 1');
      stageId = fs.length ? fs[0].id : null;
    }
    const { rows } = await client.query(
      `INSERT INTO orders (job_number, customer_id, sales_rep_id, job_name, job_type, due_date, operator, stage_id, production_status, payment_status, deposit_amt, total, sell_price, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'received',$9,$10,$11,$12,$13) RETURNING *`,
      [jobNumber, customer_id||null, sales_rep_id||null, job_name, job_type, due_date||null, operator||null, stageId, payment_status, deposit_amt, total, sell_price, notes]
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { stage_id, payment_status, due_date, operator, deposit_amt, notes, production_status } = req.body;
    const { rows } = await db.query(
      `UPDATE orders SET
         stage_id=COALESCE($1,stage_id), payment_status=COALESCE($2,payment_status),
         due_date=COALESCE($3,due_date), operator=COALESCE($4,operator),
         deposit_amt=COALESCE($5,deposit_amt), notes=COALESCE($6,notes),
         production_status=COALESCE($7,production_status)
       WHERE id=$8 RETURNING *`,
      [stage_id, payment_status, due_date, operator, deposit_amt, notes, production_status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM orders WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
