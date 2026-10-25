# Database Schema — PautangBai

This is a proposed logical schema. Confirm product rules before finalizing migrations. Use UUIDs for entity IDs so records can be created offline and later synchronized.

## Local SQLite tables

### `borrowers`

- `id` TEXT PRIMARY KEY (UUID)
- `name` TEXT NOT NULL
- `phone` TEXT NULL
- `email` TEXT NULL
- `address` TEXT NULL
- `notes` TEXT NULL
- `status` TEXT NOT NULL DEFAULT `active`
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL
- `deleted_at` TEXT NULL (soft delete/tombstone for sync)

### `loans`

- `id` TEXT PRIMARY KEY (UUID)
- `borrower_id` TEXT NOT NULL REFERENCES `borrowers(id)`
- `principal_minor` INTEGER NOT NULL
- `currency` TEXT NOT NULL DEFAULT `PHP`
- `interest_type` TEXT NOT NULL DEFAULT 'none' (values: `none`, `fixed_amount`, `percentage_flat`, `percentage_daily`, `percentage_weekly`, `percentage_monthly`)
- `fixed_charge_minor` INTEGER NOT NULL DEFAULT 0 (centavos for manual fixed charge or upfront agreed fee)
- `interest_rate` TEXT NULL (e.g. "5.0" for 5% when using percentage)
- `interest_period` TEXT NULL (e.g. `one_time`, `daily`, `weekly`, `monthly`)
- `interest_start_date` TEXT NULL
- `loan_date` TEXT NOT NULL
- `due_date` TEXT NULL
- `notes` TEXT NULL
- `status` TEXT NOT NULL DEFAULT `active`
- `server_version` INTEGER NULL
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL
- `deleted_at` TEXT NULL

### `payments`

- `id` TEXT PRIMARY KEY (UUID)
- `loan_id` TEXT NOT NULL REFERENCES `loans(id)`
- `amount_minor` INTEGER NOT NULL
- `payment_date` TEXT NOT NULL
- `payment_method` TEXT NULL
- `reference` TEXT NULL
- `notes` TEXT NULL
- `allocation_json` TEXT NULL (persist the applied split if allocation is calculated)
- `sync_status` TEXT NOT NULL DEFAULT `pending`
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL
- `deleted_at` TEXT NULL

### `interest_charges`

- `id` TEXT PRIMARY KEY (UUID)
- `loan_id` TEXT NOT NULL REFERENCES `loans(id)`
- `period_start` TEXT NOT NULL
- `period_end` TEXT NOT NULL
- `amount_minor` INTEGER NOT NULL
- `calculation_version` INTEGER NOT NULL
- `created_at` TEXT NOT NULL
- UNIQUE (`loan_id`, `period_start`, `period_end`, `calculation_version`)

Only use this table if interest is accrued and persisted by period. For purely computed interest, define how historic calculations are reproduced when rules change.

### `loan_history`

- `id` TEXT PRIMARY KEY (UUID)
- `loan_id` TEXT NOT NULL REFERENCES `loans(id)`
- `event_type` TEXT NOT NULL
- `description` TEXT NULL
- `metadata_json` TEXT NULL
- `event_date` TEXT NOT NULL
- `created_at` TEXT NOT NULL

### `sync_queue`

- `id` TEXT PRIMARY KEY (UUID)
- `entity_type` TEXT NOT NULL
- `entity_id` TEXT NOT NULL
- `operation` TEXT NOT NULL
- `payload_json` TEXT NOT NULL
- `idempotency_key` TEXT NOT NULL UNIQUE
- `status` TEXT NOT NULL DEFAULT `pending`
- `attempt_count` INTEGER NOT NULL DEFAULT 0
- `last_error` TEXT NULL
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL
- `synced_at` TEXT NULL

### `sync_state`

- `key` TEXT PRIMARY KEY
- `value` TEXT NULL
- `updated_at` TEXT NOT NULL

## Server MySQL tables

Mirror core entities with UUID primary keys and add ownership/audit columns as needed:

- `users` — account/authentication data if accounts are in scope
- `borrowers` — include `user_id` ownership FK
- `loans` — include `user_id`, `version` or `updated_at` for conflict detection
- `payments` — include unique `idempotency_key` and creator/owner context
- `interest_charges` — if persisted accruals/charges are used
- `loan_history` — audit trail / event log
- `sync_operations` — record received client operations and their outcomes

## Data integrity rules

- Store money as integer minor units (PHP centavos) or use a consistently defined fixed-precision decimal strategy. Never rely on JavaScript floating-point sums for financial truth.
- Add foreign keys and indexes for borrower, loan, payment, due date, and sync lookups.
- A payment must reference a valid loan owned by the authenticated user.
- Payment and sync operation identifiers must be unique to prevent duplicate processing.
- Use soft deletion/tombstones for synced entities so deletion can propagate to other devices.
- Server authorization must enforce ownership; never trust a client-supplied `user_id`.
- Never store plaintext passwords or API tokens in these tables.
