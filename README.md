# Insurance Policy & Accounting Module

A small backend module for managing insurance policies, payments, and
double-entry accounting, built with Node.js, Express.js, and MySQL.

## Tech Stack
- Node.js + Express.js
- MySQL (mysql2/promise)
- Plain JS, no ORM — raw SQL in the repository layer for full control
  over transactions and joins.

## Project Structure
```
db/
  schema.sql        -- table definitions, FKs, indexes
  seed.sql          -- chart of accounts + sample data
src/
  config/db.js      -- MySQL connection pool
  routes/           -- route definitions only
  controllers/      -- parse req/res, call services
  services/         -- business + accounting logic, transactions
  repositories/      -- raw SQL queries only
  utils/            -- GST calculation, ledger balance validation
  middlewares/       -- centralized error handler
  app.js / server.js
postman_collection.json
```

## Setup

### Prerequisites
- **Node.js** ≥ 18 — [nodejs.org](https://nodejs.org)
- **MySQL** ≥ 8 (local) **or** a cloud MySQL instance (Railway, PlanetScale, Aiven, etc.)
- `npm` (bundled with Node.js)

---

### 1. Install dependencies
```bash
npm install
```

This installs `express`, `mysql2`, `dotenv`, and `nodemon` (dev).

---

### 2. Configure environment variables

Copy the example file and edit it:
```bash
# Mac/Linux
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

Open `.env` and fill in **one** of the two options below:

#### Option A — Cloud SQL connection URL *(recommended for hosted DBs)*
```env
PORT=3000
DATABASE_URL=mysql://USER:PASSWORD@HOST:PORT/DATABASE
```
Examples by provider:
| Provider | URL format |
|---|---|
| Railway | `mysql://root:pass@containers-us-west-1.railway.app:PORT/railway` |
| PlanetScale | `mysql://user:pass@aws.connect.psdb.cloud/insurance_module?ssl={"rejectUnauthorized":true}` |
| Aiven | `mysql://avnadmin:pass@mysql-xxx.aivencloud.com:PORT/defaultdb?ssl-mode=REQUIRED` |

> `DATABASE_URL` takes priority. If it is set, the individual `DB_*` vars below are ignored.

#### Option B — Individual fields *(local MySQL)*
```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=insurance_module
```

---

### 3. Create database schema & seed data

#### Local MySQL
```bash
mysql -u root -p < db/schema.sql
mysql -u root -p < db/seed.sql
```

#### Cloud / remote MySQL (using the connection URL)
```bash
# Replace the placeholders with your actual credentials
mysql -h HOST -P PORT -u USER -pPASSWORD < db/schema.sql
mysql -h HOST -P PORT -u USER -pPASSWORD < db/seed.sql
```
Or use a GUI client (TablePlus, DBeaver, MySQL Workbench) — open a connection with your cloud URL and run `db/schema.sql` then `db/seed.sql`.

> **Note:** `seed.sql` inserts the chart of accounts (`Customer Receivable`, `Premium Income`, `GST Payable`, `Bank/Cash`) and two sample customers. These must exist before the APIs can write ledger entries.

---

### 4. Start the development server
```bash
npm run dev
```

Server starts on **`http://localhost:3000`** (or the `PORT` in your `.env`).

Verify it's running:
```
GET http://localhost:3000/health
→ { "status": "ok" }
```

## Database Design

| Table | Purpose |
|---|---|
| `customers` | Customer master data |
| `policies` | One row per issued policy (premium, GST, total, status) |
| `policy_transactions` | Append-only audit trail of policy lifecycle events |
| `payments` | Append-only payment records; corrections are new rows (`payment_type = REVERSAL`, `reference_payment_id` points to original) |
| `accounts` | Chart of accounts (Customer Receivable, Premium Income, GST Payable, Bank/Cash) |
| `ledger_entries` | Double-entry bookkeeping rows, grouped by `transaction_reference` |

All financial tables use `DECIMAL(12,2)` for money, foreign keys to
enforce referential integrity, and indexes on lookup columns
(`policy_number`, `policy_id`, `transaction_reference`).

## Accounting Logic

**Policy creation** (premium ₹10,000, GST 18%):

| Account | Debit | Credit |
|---|---|---|
| Customer Receivable | 11,800 | |
| Premium Income | | 10,000 |
| GST Payable | | 1,800 |

**Payment received** (₹5,000):

| Account | Debit | Credit |
|---|---|---|
| Bank/Cash | 5,000 | |
| Customer Receivable | | 5,000 |

**Payment reversal / correction** — instead of editing the original
payment row, a new `REVERSAL` payment row is inserted
(`reference_payment_id` = original payment id) with mirrored ledger
entries:

| Account | Debit | Credit |
|---|---|---|
| Customer Receivable | 5,000 | |
| Bank/Cash | | 5,000 |

Every entry set is validated with `assertBalanced()`
(`src/utils/accounting.js`) before being written — `sum(debit)` must
equal `sum(credit)` or the operation throws and the surrounding
transaction is rolled back.

## Transactions & Insert-Only Architecture

- Every multi-table financial write (`POST /policies`, `POST /payments`,
  `POST /payments/:id/reverse`) runs inside a single MySQL transaction:
  `beginTransaction()` → inserts → `commit()`, or `rollback()` on any
  failure. Connections are always released in a `finally` block.
- `POST /payments` takes a row lock (`SELECT ... FOR UPDATE`) on the
  policy while computing the outstanding balance, so two concurrent
  payments can't both pass the overpayment check.
- **No `UPDATE`/`DELETE`** is used anywhere on `policies`,
  `policy_transactions`, `payments`, or `ledger_entries`. Corrections
  are always new inserted rows, preserving full history.
- Outstanding balances and summaries are **derived** from
  `payments`/`ledger_entries` at query time (via `SUM`, `CASE`,
  `GROUP BY`) rather than stored as a mutable running total.

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/customers` | Create a customer |
| POST | `/policies` | Create a policy; calculates GST + total premium; writes ledger entries |
| GET | `/policies/:id` | Get policy details (joined with customer) |
| POST | `/payments` | Record a payment; rejects invalid policy or overpayment |
| POST | `/payments/:id/reverse` | Insert a reversal of an existing payment (correction) |
| GET | `/policies/:id/ledger` | Full ledger for a policy, joined with account names |
| GET | `/policies/:id/summary` | Account-wise totals + outstanding, derived via SQL aggregation |

### Sample requests

**Create Policy**
```
POST /policies
{ "policyNumber": "POL-1001", "customerId": 1, "premiumAmount": 10000 }
```

**Create Payment**
```
POST /payments
{ "policyId": 1, "amount": 5000 }
```

See `postman_collection.json` for the full request set.

## Validation Covered
- Duplicate `policy_number` → 409
- Invalid/missing customer or policy → 404
- Invalid amounts (≤ 0) → 400
- Overpayment beyond outstanding balance → 400
- Ledger imbalance (defensive, shouldn't occur given the builder
  functions) → 500, transaction rolled back
- Re-reversing an already-reversed payment → 409

## Notes / Possible Extensions
- Add JWT auth + role-based access if multiple staff users are needed.
- Add policy cancellation flow (insert `CANCELLED` policy_transaction +
  reversing ledger entries for unearned premium).
- Add pagination to ledger listing for high-volume policies.
