# Print Estimator — Full Stack App

A print shop estimating tool with a Neon Postgres backend for customers,
sales reps, pricing tiers, and estimates.

---

## Stack

- **Frontend** — plain HTML/CSS/JS (no framework)
- **Backend** — Node.js + Express
- **Database** — Neon (serverless Postgres)

---

## Setup — Step by step

### 1. Create your Neon database

1. Go to [neon.tech](https://neon.tech) and sign up (free)
2. Create a new project (any name, e.g. "print-estimator")
3. In your project dashboard, click **Connection Details**
4. Copy the **Connection string** — it looks like:
   ```
   postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

### 2. Run the schema

1. In your Neon dashboard, click **SQL Editor**
2. Open the file `schema.sql` from this project
3. Paste the entire contents into the SQL Editor and click **Run**
4. This creates all tables and adds sample seed data (reps + tiers)

### 3. Configure environment

```bash
cp .env.example .env
```

Open `.env` and paste your Neon connection string:

```
DATABASE_URL=postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
PORT=3000
```

### 4. Install dependencies

```bash
npm install
```

### 5. Start the server

```bash
npm start
```

Or for auto-reload during development:

```bash
npm run dev
```

Open your browser to **http://localhost:3000**

---

## How it works

### Customers tab
- Add customers with full contact info, billing address, payment terms, and credit limit
- Assign a **sales rep** and **pricing tier** to each customer
- Click **Estimate** on any customer to jump to the estimator with their info pre-loaded

### Sales Reps tab
- Add reps with their default commission %
- See per-rep totals: customer count, estimate count, revenue, commission earned

### Pricing Tiers tab
- Create tiers like Retail, Wholesale, VIP, Non-profit
- Set a **discount %** (applied to the sell price) and optional **margin floor**
- Assign tiers to customers — the estimator auto-applies the discount when you select that customer

### Estimator tab
- Select a customer → their rep and pricing tier auto-load
- All estimates are saved to the database linked to the customer and rep
- Commission calculates automatically from the rep's rate

---

## Project structure

```
print-estimator/
├── server/
│   ├── index.js          # Express entry point
│   ├── db.js             # Neon connection pool
│   └── routes/
│       ├── customers.js  # CRUD + search
│       ├── reps.js       # CRUD + stats
│       ├── tiers.js      # CRUD
│       └── estimates.js  # CRUD + status updates
├── public/
│   └── index.html        # Full frontend SPA
├── schema.sql            # Database schema + seed data
├── .env.example          # Environment template
└── package.json
```

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | DB connection check |
| GET/POST | /api/customers | List (with search/filter) or create |
| GET/PUT/DELETE | /api/customers/:id | Get, update, delete customer |
| GET/POST | /api/reps | List or create reps |
| GET/PUT/DELETE | /api/reps/:id | Get (with stats), update, delete rep |
| GET/POST | /api/tiers | List or create tiers |
| GET/PUT/DELETE | /api/tiers/:id | Get, update, delete tier |
| GET/POST | /api/estimates | List (filterable) or create |
| GET/PUT/DELETE | /api/estimates/:id | Get, update, delete estimate |
| PATCH | /api/estimates/:id/status | Update estimate status only |

---

## Deploying (optional)

To run on a shop computer accessible on your local network:

```bash
# Find your machine's local IP
ipconfig   # Windows
ifconfig   # Mac/Linux

# Start the server (it binds to 0.0.0.0 by default via Express)
npm start

# Access from any device on the same WiFi:
# http://192.168.x.x:3000
```

For cloud hosting, this runs on Railway, Render, or Fly.io with no changes —
just set the `DATABASE_URL` environment variable in their dashboard.
