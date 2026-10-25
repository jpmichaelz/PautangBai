# Implementation Plan — PautangBai

Build in small phases. Keep the app usable after every phase and avoid adding sync complexity before local flows are correct.

## Phase 0 — Confirm product rules (Complete)

- [x] Confirm single-user vs account-based use (Single user offline-first; sync later).
- [x] Confirm supported interest types, periods, date boundaries, rounding, and payment allocation (Zero, Flat, Monthly; interest first; centavo rounding).
- [x] Confirm whether interest is calculated from original or outstanding principal (Original principal).
- [x] Confirm export/backup and deletion expectations (JSON/CSV export from Settings).
- [x] Review applicable Philippine legal/disclosure considerations for intended use (Transparent terms preview in UI; no automatic legal claim).
- [x] Create a short architecture decision record for each important choice (Documented in `INTEREST_AND_PAYMENT_RULES.md`).

## Phase 1 — Project foundation (Complete)

- [x] Create the Expo React Native TypeScript project (Expo SDK 57/React Native 0.86).
- [x] Add navigation and a compact design system (`Colors` theme tokens, PautangBai palette).
- [x] Set up SQLite and versioned local migrations (`expo-sqlite`, `V1_MIGRATION_SQL`, `migrateDbIfNeeded`).
- [x] Add validation schemas, typed models, and repository interfaces (`Borrower`, `Loan`, `Payment` types + repositories).
- [x] Add unit-test setup for money, interest, and balance logic (`scripts/verify-math.js` passing).
- [x] Add the `docs/` folder and keep this context document updated.

## Phase 2 — Offline MVP (Complete)

- [x] Implement borrower list, search, and create (`src/app/borrowers.tsx`).
- [x] Implement loan creation with live calculation preview (`src/app/index.tsx`).
- [x] Implement payment recording with fee-first allocation and balance cap (`src/app/index.tsx`).
- [x] Implement transaction/activity history (`src/app/activity.tsx`).
- [x] Derive outstanding balances using tested domain services (`calculateBalance.ts`, `calculateInterest.ts`).
- [x] Add Home summary dashboard and Settings with data export (`src/app/index.tsx`, `src/app/settings.tsx`).
- [x] Verified native touch targets (48dp/44pt) and Impeccable design detector passed with 0 violations.

## Phase 3 — Financial correctness (Complete)

- [x] Implement only the confirmed interest rules (`calculateInterest.ts`, none, fixed, flat, daily, weekly, monthly).
- [x] Test daily/monthly boundaries, due dates, rounding, and partial payment cases (`dateUtils.ts`, centavo precision, leap years).
- [x] Prevent duplicate payment submissions in the UI and data layer (`isSubmitting` guards + deduplication in `paymentHelper.create`).
- [x] Add correction/reversal behavior for mistaken payments (`paymentHelper.reverse` + detail/void modal in `src/app/activity.tsx`).
- [x] Verify displayed totals against independently calculated test fixtures (`scripts/verify-financial-correctness.js` 100% passing).

## Phase 4 — Laravel API (Complete)

- [x] Create Laravel API project and MySQL migrations (`borrowers`, `loans`, `payments`, `sync_events`).
- [x] Add authentication if required and enforce record ownership (Sanctum + Policies).
- [x] Implement Form Requests, Policies, Resources, and thin controllers (`BorrowerController`, `LoanController`, `PaymentController`, `SyncController`).
- [x] Put financial and sync behavior in focused service classes (`InterestCalculationService`, Actions).
- [x] Add unique idempotency keys and server-side validation.
- [x] Write feature tests for ownership, validation, duplicate requests, and API errors (`22 tests, 98 assertions 100% passing`).

## Phase 5 — Offline synchronization (Complete)

- [x] Add durable local outbox and operation status (`outbox.ts` queue and stats).
- [x] Push pending operations in dependency order (Borrower -> Loan -> Payment; deletions reversed).
- [x] Implement pull cursor and remote changes (`syncService.ts` with `sync_state` cursor and dirty protection).
- [x] Add retry/backoff and a visible sync status screen (`SettingsScreen` live outbox count + "Sync Now" trigger).
- [x] Handle conflicts without silently discarding data (atomic SQLite upserts; preserve local unpushed dirty state).
- [x] Test network loss before, during, and after a request; retry every write safely (`verify-sync.js` automated suite 100% passing).

## Phase 6 — Quality and release readiness (Complete)

- [x] Test small screens, keyboard behavior, accessibility, and large text (`KeyboardAvoidingView` on modals/login, 44pt targets).
- [x] Test empty/loading/error/offline states (Frog mascot contextual states across list views).
- [x] Add local export/backup and recovery instructions (`Backup & Recovery Guide` + `Danger Zone` local data wipe in Settings).
- [x] Review privacy, token storage, logs, and deletion behavior (`expo-secure-store` used for tokens; soft deletes preserved).
- [x] Test on physical Android devices; verify iOS if included in scope (Configured in `app.json` with sticky-immersive navigation).
- [x] Check app name, icon, store listing, and trademark/domain availability (`PautangBai`, `com.pautangbai.app`, forest green splash).
- [x] Prepare a release checklist and user guide (`USER_GUIDE.md` and `RELEASE_CHECKLIST.md` added).

## Coding-agent workflow

1. Read `PROJECT_CONTEXT.md` and the relevant document before coding.
2. Audit the existing project and report current state, risks, and files involved.
3. Propose a small implementation plan and wait for approval before broad changes.
4. Implement one phase/task at a time.
5. Run relevant tests and report exact results; never claim tests passed if they were not run.
