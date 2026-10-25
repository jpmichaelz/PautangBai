# Mobile Architecture — PautangBai

## Stack

- React Native + Expo
- TypeScript
- SQLite for durable offline data
- Laravel REST API for sync and optional multi-device access
- Secure device storage for authentication tokens, if login is implemented

Check current Expo SDK and SQLite APIs when creating the project; do not copy deprecated setup commands blindly.

## Folder structure

```text
mobile/
├── src/
│   ├── app/                     # Expo Router screen routes (index, borrowers, activity, settings)
│   ├── components/              # shared UI components
│   │   ├── forms/               # isolated, reusable form modals (BorrowerFormModal, LoanFormModal, PaymentFormModal)
│   │   ├── app-tabs.tsx         # scooped floating bottom navigation bar
│   │   └── frog.tsx             # Bai the Frog mascot visual states
│   ├── database/
│   │   ├── migrations/          # versioned SQLite schema migrations
│   │   └── migrate.ts
│   ├── db-helpers/              # SQLite CRUD operations (borrowers, loans, payments)
│   ├── services/
│   │   ├── interest/            # interest calculations, payment allocation, PHP format
│   │   ├── balance/             # derived loan balances, overdue states
│   │   └── sync/                # offline queue and Laravel sync
│   ├── types/                   # TypeScript interfaces (database, forms, navigation)
│   ├── constants/               # theme, colors, typography tokens
│   └── hooks/
├── assets/
├── docs/
└── package.json
```

## Form Component Architecture

Forms are kept in dedicated modal components (`src/components/forms/`) rather than inline within screen files:
- **`BorrowerFormModal`**: Owns borrower fields (name, phone, address, notes), validation, and SQLite creation.
- **`LoanFormModal`**: Owns principal input, interest configuration (none, fixed, flat %, monthly %), due date presets, live calculation preview, and loan persistence.
- **`PaymentFormModal`**: Owns payment amount, payment method (Cash, GCash, Bank), notes, balance check, and transaction recording.

Screens (`index.tsx`, `borrowers.tsx`) remain lean (~200–450 lines) focused strictly on list layout, data querying, and navigation. Forms can be triggered contextually across any screen without page switching.

## Data flow

1. Screen submits a validated command.
2. Repository starts a SQLite transaction.
3. Repository writes the entity and a `sync_outbox` item in the same transaction.
4. UI reads the updated record from SQLite and reflects it immediately.
5. Sync service sends queued operations when connectivity and API are available.
6. API validates ownership, payload, idempotency, and business rules.
7. Client marks the outbox item synced and updates server version/metadata.
8. On conflict or failure, preserve local data and show a recoverable status.

## Offline-first rules

- Do not gate normal create/read/edit screens on successful HTTP requests.
- `navigator.onLine` or connectivity APIs are hints, not proof that the API is reachable. Use a short API health check when appropriate.
- Retry transient failures with bounded exponential backoff; avoid infinite rapid retries.
- Make sync operations idempotent and order dependent operations (debtor before loan, loan before payment).
- Use tombstones for deletion and stable client UUIDs.
- Record sync errors without including secrets or unnecessary personal information.
- Decide a conflict policy before enabling simultaneous edits on multiple devices.

## UI principles

- Use a compact, clear finance UI with visible currency and dates.
- Separate principal, interest, total paid, and remaining balance.
- Avoid showing interest as if it were automatically legally applicable; display the configured terms and calculation period.
- Display sync state in a calm, understandable way: Saved on this device, Sync pending, Synced, or Needs attention.
- Provide empty, loading, validation, and error states.
- Do not use a full-screen spinner for local SQLite reads.

## Suggested navigation

Bottom tabs: Home, Debtors, Activity, Settings.
Supporting routes: debtor detail, create/edit debtor, create loan, loan detail, record payment, sync issues, export/backup.
