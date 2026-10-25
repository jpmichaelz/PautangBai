export const V1_MIGRATION_SQL = `
PRAGMA journal_mode = 'wal';
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS borrowers (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_borrowers_status ON borrowers(status);
CREATE INDEX IF NOT EXISTS idx_borrowers_name ON borrowers(name);

CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY NOT NULL,
  borrower_id TEXT NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
  principal_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PHP',
  interest_type TEXT NOT NULL DEFAULT 'none', -- 'none', 'fixed_amount', 'percentage_flat', 'percentage_daily', 'percentage_weekly', 'percentage_monthly'
  fixed_charge_minor INTEGER NOT NULL DEFAULT 0, -- centavos for manual fixed charge or upfront agreed fee
  interest_rate TEXT, -- percentage rate e.g. '5.0'
  interest_period TEXT, -- 'one_time', 'daily', 'weekly', 'monthly'
  interest_start_date TEXT,
  loan_date TEXT NOT NULL,
  due_date TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  server_version INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_loans_borrower ON loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_due_date ON loans(due_date);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY NOT NULL,
  loan_id TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  amount_minor INTEGER NOT NULL,
  payment_date TEXT NOT NULL,
  payment_method TEXT,
  reference TEXT,
  notes TEXT,
  allocation_json TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_payments_loan ON payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

CREATE TABLE IF NOT EXISTS loan_history (
  id TEXT PRIMARY KEY NOT NULL,
  loan_id TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT,
  metadata_json TEXT,
  event_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_loan_history_loan ON loan_history(loan_id);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT,
  updated_at TEXT NOT NULL
);
`;
