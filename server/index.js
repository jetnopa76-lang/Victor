require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api/customers', require('./routes/customers'));
app.use('/api/reps',      require('./routes/reps'));
app.use('/api/tiers',     require('./routes/tiers'));
app.use('/api/estimates', require('./routes/estimates'));
app.use('/api/orders',    require('./routes/orders'));
app.use('/api/invoices',  require('./routes/invoices'));
app.use('/api/pricing',   require('./routes/pricing'));

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const db = require('./db');
    await db.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (e) {
    res.status(500).json({ status: 'error', db: e.message });
  }
});

// Catch-all: serve the frontend for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Print Estimator running at http://localhost:${PORT}`);
  console.log(`API available at  http://localhost:${PORT}/api`);
});
