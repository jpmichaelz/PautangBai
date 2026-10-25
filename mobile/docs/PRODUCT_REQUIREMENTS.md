# Product Requirements — PautangBai

## Product goal

Give a person a reliable, understandable record of money lent, payments received, interest (when applicable), and the current balance, even without an internet connection.

## MVP users and permissions

**Initial assumption:** one personal account/user manages their own debtor and loan records. If authentication and multi-device sync are required in the first release, implement user ownership on the API and enforce it on every endpoint.

## Core screens

1. **Home** — summary cards for total outstanding, amount received, active loans, and overdue loans; recent activity; sync status.
2. **Debtors** — searchable list, add/edit debtor, debtor profile and associated loans.
3. **Debtor details** — contact information, active/closed loans, loan balances, and transaction history.
4. **Create loan** — debtor, principal, loan date, due date, interest configuration, notes, and agreement/terms confirmation.
5. **Loan details** — principal, accrued interest, paid amount, remaining balance, status, dates, and event history.
6. **Record payment** — amount, date, payment method (optional), reference/notes, and allocation preview.
7. **Activity** — chronological loans, payments, adjustments, and sync-relevant events.
8. **Settings** — currency (default PHP), default interest preferences, data export/backup, and sync/account options.

## Functional requirements

- Create, view, update, and archive debtors.
- Create loans linked to a debtor. A loan strictly requires an existing debtor/borrower. If 0 borrowers exist, the floating action menu hides "Bag-ong Pautang" and only displays "Bag-ong Mangungutang" for a clean, guided flow.
- Validate principal and payment amounts as positive monetary values.
- Support configurable interest rules only after the rules have been explicitly defined.
- Record multiple partial payments for a single loan.
- Recalculate and display remaining balance from stored transactions and approved rules.
- Show payment history with timestamps and amounts; do not overwrite earlier payments when a new payment is entered.
- Support offline create/read/update operations for MVP entities.
- Show pending, syncing, synced, and failed sync states.
- Retry failed sync operations without creating duplicates.
- Keep local records and pending operations if sync fails.
- Clearly label overdue loans based on the configured due-date policy.
- Provide an export/backup route before destructive account/data operations.

## Non-functional requirements

- Offline core flows must not wait for network requests.
- Persist data in SQLite, not only in React state or AsyncStorage.
- Use transactions for related local writes.
- Handle app restarts without losing pending sync actions.
- Use accessible labels, readable amounts, clear empty states, and actionable error messages.
- Store money using integer minor units (for example, centavos) or a consistent decimal strategy; do not use floating-point arithmetic for financial totals.
- Protect user data and avoid exposing sensitive details in logs.
- Add tests for interest calculations, payment allocation, offline persistence, sync retries, and duplicate-operation prevention.

## Suggested status values

- Debtor: `active`, `archived`
- Loan: `active`, `paid`, `overdue`, `cancelled`
- Sync operation: `pending`, `processing`, `synced`, `failed`, `conflict`

Status rules should be derived consistently and documented; avoid allowing unrelated screens to independently invent loan status logic.

## MVP acceptance criteria

- A user can create a debtor and loan while airplane mode is enabled, close/reopen the app, and still see the records.
- A user can record two or more partial payments and see the full history and correct remaining balance.
- After internet returns, queued changes sync successfully.
- Repeating a sync request does not create duplicate loans or payments.
- If sync fails, the user sees a clear status and their local data remains available.
- Interest calculations match the documented examples and automated tests.
