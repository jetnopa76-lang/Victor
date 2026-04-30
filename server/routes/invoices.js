const express = require('express');
const router = express.Router();
const db = require('../db');

async function generateInvoiceNumber(client) {
  const { rows } = await client.query(
    `SELECT 'INV-' || extract(year from now())::text || '-' || LPAD(nextval('invoice_number_seq')::text, 4, '0') AS num`
  );
  return rows[0].num;
}

async function generateMemoNumber(client) {
  const { rows } = await client.query(
    `SELECT 'CM-' || extract(year from now())::text || '-' || LPAD(nextval('credit_memo_seq')::text, 4, '0') AS num`
  );
  return rows[0].num;
}

// ── INVOICES ──────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { status, customer_id, overdue } = req.query;
    let where = [], params = [], i = 1;
    if (status)      { where.push(`inv.status=$${i++}`); params.push(status); }
    if (customer_id) { where.push(`inv.customer_id=$${i++}`); params.push(customer_id); }
    if (overdue === 'true') { where.push(`inv.due_date < CURRENT_DATE AND inv.status NOT IN ('paid','void')`); }
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const { rows } = await db.query(
      `SELECT inv.*,
         CONCAT(c.first_name,' ',c.last_name) AS customer_name, c.company,
         r.name AS rep_name,
         o.job_number
       FROM invoices inv
       LEFT JOIN customers c ON c.id = inv.customer_id
       LEFT JOIN sales_reps r ON r.id = inv.sales_rep_id
       LEFT JOIN orders o ON o.id = inv.order_id
       ${whereClause}
       ORDER BY inv.issue_date DESC`,
      params
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/aging', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        SUM(CASE WHEN due_date >= CURRENT_DATE THEN balance_due ELSE 0 END) AS current_amt,
        SUM(CASE WHEN due_date < CURRENT_DATE AND due_date >= CURRENT_DATE - 30 THEN balance_due ELSE 0 END) AS days_30,
        SUM(CASE WHEN due_date < CURRENT_DATE - 30 AND due_date >= CURRENT_DATE - 60 THEN balance_due ELSE 0 END) AS days_60,
        SUM(CASE WHEN due_date < CURRENT_DATE - 60 AND due_date >= CURRENT_DATE - 90 THEN balance_due ELSE 0 END) AS days_90,
        SUM(CASE WHEN due_date < CURRENT_DATE - 90 THEN balance_due ELSE 0 END) AS days_90_plus,
        SUM(balance_due) AS total_outstanding,
        COUNT(*) FILTER (WHERE status NOT IN ('paid','void')) AS open_count
      FROM invoices
      WHERE status NOT IN ('paid','void')
    `);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT inv.*,
         CONCAT(c.first_name,' ',c.last_name) AS customer_name, c.company,
         c.email AS customer_email, c.phone AS customer_phone,
         c.address_line1, c.city, c.state, c.zip,
         r.name AS rep_name, o.job_number
       FROM invoices inv
       LEFT JOIN customers c ON c.id = inv.customer_id
       LEFT JOIN sales_reps r ON r.id = inv.sales_rep_id
       LEFT JOIN orders o ON o.id = inv.order_id
       WHERE inv.id=$1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const { rows: payments } = await db.query(
      'SELECT * FROM invoice_payments WHERE invoice_id=$1 ORDER BY payment_date',
      [req.params.id]
    );
    const { rows: credits } = await db.query(
      'SELECT * FROM credit_memos WHERE invoice_id=$1',
      [req.params.id]
    );
    res.json({ ...rows[0], payments, credits });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create invoice from order
router.post('/from-order/:orderId', async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: orders } = await client.query(
      `SELECT o.*, CONCAT(c.first_name,' ',c.last_name) AS customer_name
       FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.id=$1`,
      [req.params.orderId]
    );
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    const o = orders[0];
    const invoiceNum = await generateInvoiceNumber(client);
    const { due_date, notes, tax_pct = 0 } = req.body;
    const subtotal = parseFloat(o.sell_price) || 0;
    const taxAmt = subtotal * (tax_pct / 100);
    const total = subtotal + taxAmt;
    const lineItems = [{ description: o.job_name, quantity: 1, unit_price: subtotal, amount: subtotal }];
    const { rows } = await client.query(
      `INSERT INTO invoices (invoice_number, order_id, customer_id, sales_rep_id, status, issue_date, due_date, subtotal, tax_pct, tax_amt, total, amount_paid, balance_due, line_items, notes)
       VALUES ($1,$2,$3,$4,'draft',CURRENT_DATE,$5,$6,$7,$8,$9,0,$9,$10,$11) RETURNING *`,
      [invoiceNum, o.id, o.customer_id, o.sales_rep_id, due_date||null, subtotal, tax_pct, taxAmt, total, JSON.stringify(lineItems), notes||'']
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// Create manual invoice
router.post('/', async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const invoiceNum = await generateInvoiceNumber(client);
    const { customer_id, sales_rep_id, order_id, due_date, subtotal=0, tax_pct=0, notes, line_items } = req.body;
    const taxAmt = subtotal * (tax_pct/100);
    const total = parseFloat(subtotal) + taxAmt;
    const { rows } = await client.query(
      `INSERT INTO invoices (invoice_number, order_id, customer_id, sales_rep_id, status, issue_date, due_date, subtotal, tax_pct, tax_amt, total, amount_paid, balance_due, line_items, notes)
       VALUES ($1,$2,$3,$4,'draft',CURRENT_DATE,$5,$6,$7,$8,$9,0,$9,$10,$11) RETURNING *`,
      [invoiceNum, order_id||null, customer_id||null, sales_rep_id||null, due_date||null, subtotal, tax_pct, taxAmt, total, line_items?JSON.stringify(line_items):null, notes||'']
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
    const { status, due_date, notes } = req.body;
    const { rows } = await db.query(
      `UPDATE invoices SET status=COALESCE($1,status), due_date=COALESCE($2,due_date), notes=COALESCE($3,notes) WHERE id=$4 RETURNING *`,
      [status, due_date, notes, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Mark reminder sent
router.post('/:id/reminder', async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE invoices SET reminder_sent_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query(`UPDATE invoices SET status='void' WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PAYMENTS ─────────────────────────────────────────────────────

router.post('/:id/payments', async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { amount, method='other', reference='', notes='', payment_date } = req.body;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'Invalid amount' });
    const { rows: inv } = await client.query('SELECT * FROM invoices WHERE id=$1', [req.params.id]);
    if (!inv.length) return res.status(404).json({ error: 'Invoice not found' });
    const invoice = inv[0];
    const { rows: payment } = await client.query(
      `INSERT INTO invoice_payments (invoice_id, customer_id, payment_date, amount, method, reference, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id, invoice.customer_id, payment_date||new Date().toISOString().split('T')[0], amt, method, reference, notes]
    );
    const newPaid = parseFloat(invoice.amount_paid) + amt;
    const newBalance = parseFloat(invoice.total) - newPaid;
    const newStatus = newBalance <= 0 ? 'paid' : newPaid > 0 ? 'partial' : invoice.status;
    await client.query(
      `UPDATE invoices SET amount_paid=$1, balance_due=$2, status=$3 WHERE id=$4`,
      [newPaid, Math.max(newBalance, 0), newStatus, req.params.id]
    );
    await client.query('COMMIT');
    res.status(201).json(payment[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

router.delete('/:invoiceId/payments/:paymentId', async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: p } = await client.query('SELECT * FROM invoice_payments WHERE id=$1', [req.params.paymentId]);
    if (!p.length) return res.status(404).json({ error: 'Not found' });
    await client.query('DELETE FROM invoice_payments WHERE id=$1', [req.params.paymentId]);
    const { rows: inv } = await client.query('SELECT * FROM invoices WHERE id=$1', [req.params.invoiceId]);
    if (inv.length) {
      const newPaid = Math.max(parseFloat(inv[0].amount_paid) - parseFloat(p[0].amount), 0);
      const newBalance = parseFloat(inv[0].total) - newPaid;
      const newStatus = newPaid <= 0 ? 'sent' : 'partial';
      await client.query(`UPDATE invoices SET amount_paid=$1, balance_due=$2, status=$3 WHERE id=$4`,
        [newPaid, newBalance, newStatus, req.params.invoiceId]);
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// ── CREDIT MEMOS ─────────────────────────────────────────────────

router.post('/:id/credits', async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const memoNum = await generateMemoNumber(client);
    const { amount, reason='', memo_date } = req.body;
    const { rows: inv } = await client.query('SELECT * FROM invoices WHERE id=$1', [req.params.id]);
    if (!inv.length) return res.status(404).json({ error: 'Invoice not found' });
    const { rows: memo } = await client.query(
      `INSERT INTO credit_memos (memo_number, invoice_id, customer_id, memo_date, amount, reason)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [memoNum, req.params.id, inv[0].customer_id, memo_date||new Date().toISOString().split('T')[0], parseFloat(amount), reason]
    );
    await client.query('COMMIT');
    res.status(201).json(memo[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// ── QUICKBOOKS EXPORT ────────────────────────────────────────────

router.get('/export/quickbooks', async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    let where = "inv.status NOT IN ('void','draft')";
    const params = [];
    if (from_date) { where += ` AND inv.issue_date >= $${params.length+1}`; params.push(from_date); }
    if (to_date)   { where += ` AND inv.issue_date <= $${params.length+1}`; params.push(to_date); }

    const { rows: invoices } = await db.query(
      `SELECT inv.*, c.company, CONCAT(c.first_name,' ',c.last_name) AS contact_name,
         c.address_line1, c.city, c.state, c.zip, c.email, c.phone
       FROM invoices inv
       LEFT JOIN customers c ON c.id = inv.customer_id
       WHERE ${where} ORDER BY inv.issue_date`,
      params
    );

    const { rows: payments } = await db.query(
      `SELECT p.*, inv.invoice_number, c.company
       FROM invoice_payments p
       JOIN invoices inv ON inv.id = p.invoice_id
       LEFT JOIN customers c ON c.id = p.customer_id
       WHERE inv.status NOT IN ('void','draft')
       ORDER BY p.payment_date`
    );

    // Build IIF file
    let iif = '';

    // Customer list header
    iif += '!CUST\tNAME\tCOMPANY\tADDR1\tCITY\tSTATE\tZIP\tPHONE\n';
    const custSeen = {};
    invoices.forEach(inv => {
      const name = inv.company || inv.contact_name || 'Unknown';
      if (!custSeen[name]) {
        custSeen[name] = true;
        iif += `CUST\t${name}\t${inv.company||''}\t${inv.address_line1||''}\t${inv.city||''}\t${inv.state||''}\t${inv.zip||''}\t${inv.phone||''}\n`;
      }
    });

    iif += '\n';

    // Invoice transactions
    iif += '!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tMEMO\n';
    iif += '!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\n';
    iif += '!ENDTRNS\n';

    invoices.forEach(inv => {
      const custName = inv.company || inv.contact_name || 'Unknown';
      const date = new Date(inv.issue_date).toLocaleDateString('en-US');
      const total = parseFloat(inv.total).toFixed(2);
      const subtotal = parseFloat(inv.subtotal).toFixed(2);
      const taxAmt = parseFloat(inv.tax_amt).toFixed(2);

      iif += `TRNS\tINVOICE\t${date}\tAccounts Receivable\t${custName}\t${total}\t${inv.invoice_number}\t${inv.notes||''}\n`;
      iif += `SPL\tINVOICE\t${date}\tPrint Services Income\t${custName}\t-${subtotal}\t${inv.invoice_number}\n`;
      if (parseFloat(taxAmt) > 0) {
        iif += `SPL\tINVOICE\t${date}\tSales Tax Payable\t${custName}\t-${taxAmt}\tSales Tax\n`;
      }
      iif += 'ENDTRNS\n';
    });

    iif += '\n';

    // Payment transactions
    payments.forEach(p => {
      const custName = p.company || 'Unknown';
      const date = new Date(p.payment_date).toLocaleDateString('en-US');
      const amt = parseFloat(p.amount).toFixed(2);
      const methodAcct = p.method === 'check' ? 'Checking' : p.method === 'cash' ? 'Petty Cash' : 'Undeposited Funds';
      iif += `TRNS\tPAYMENT\t${date}\t${methodAcct}\t${custName}\t${amt}\t${p.reference||''}\t${p.notes||''}\n`;
      iif += `SPL\tPAYMENT\t${date}\tAccounts Receivable\t${custName}\t-${amt}\t${p.invoice_number}\n`;
      iif += 'ENDTRNS\n';
    });

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="victor-export-${new Date().toISOString().split('T')[0]}.iif"`);
    res.send(iif);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
