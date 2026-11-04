# Offline Features Implementation Plan — PautangBai

This plan details the missing offline features and high-value UX improvements for **PautangBai**, organized into independent, sequential tasks. All tasks use **already-installed dependencies** (`expo-sqlite`, `expo-secure-store`, React Native `Share` & `Linking`) so no native rebuild is required.

---

## Task Overview & Execution Order

| Task        | Feature                                                              | Priority | Primary Files                                                                                                                 |
| ----------- | -------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Task 1**  | Payment Allocation Preview, Quick-Fill Chips & Reference No.         | High     | `src/components/forms/payment-form-modal.tsx`, `src/app/activity.tsx`, `src/components/forms/loan-detail-modal.tsx`           |
| **Task 2**  | Edit & Delete/Archive Borrower                                       | High     | `src/components/forms/borrower-form-modal.tsx`, `src/app/borrowers.tsx`, `src/components/forms/loan-detail-modal.tsx`         |
| **Task 3**  | Backdating Loans & Payments + Custom Due Date                        | High     | `src/components/forms/loan-form-modal.tsx`, `src/components/forms/payment-form-modal.tsx`, `src/services/date/dateUtils.ts`   |
| **Task 4**  | Offline JSON Backup Import / Restore                                 | High     | `src/app/settings.tsx`, `src/services/backup/backupService.ts`                                                                |
| **Task 5**  | Offline SMS / Receipt Generator ("Singil / Resibo")                  | High     | `src/services/share/receiptGenerator.ts`, `src/components/forms/loan-detail-modal.tsx`, `src/app/activity.tsx`                |
| **Task 6**  | Borrower-Grouped View & "Kwaderno" Running Ledger (SOA)              | High     | `src/app/borrowers.tsx`, `src/services/ledger/kwadernoLedger.ts`                                                              |
| **Task 7**  | Activity Ledger Search, Filter & Loan Detail Action                  | Medium   | `src/app/activity.tsx`                                                                                                        |
| **Task 8**  | Offline 4-Digit PIN App Lock (`expo-secure-store`)                   | Low      | `src/app/_layout.tsx`, `src/app/settings.tsx`                                                                                 |
| **Task 9**  | Collection Schedule / Due-Date Buckets (Due Today, Week, Overdue)    | High     | `src/app/index.tsx`, `src/services/date/dateUtils.ts`                                                                         |
| **Task 10** | Offline Profit / Capital Analytics ("Tubo vs Puhunan")               | High     | `src/app/index.tsx`, `src/services/balance/calculateBalance.ts`                                                               |
| **Task 11** | Two-Way Debt Toggle ("Gipautang" vs "Akong Utang" — Schema V2 + API) | Medium   | `src/database/migrate.ts`, `src/database/migrations/v2.ts`, `src/types/database.ts`, `src/app/index.tsx`, `backend/database/` |

---

## Task 1: Payment Allocation Preview, Quick-Fill Chips & Reference Number

### Why We Need It

1. `PRODUCT_REQUIREMENTS.md` (#6) requires an **allocation preview** when recording a payment, showing how the payment splits between interest/fees and principal.
2. Users currently have to mentally calculate or manually type the exact remaining balance or 50% partial amount.
3. `payment-form-modal.tsx` hardcodes `reference: null` even when `GCash` or `Bank` is selected, losing the transaction reference number.

### Files Involved

- `mobile/src/components/forms/payment-form-modal.tsx`
- `mobile/src/components/forms/loan-detail-modal.tsx`
- `mobile/src/app/activity.tsx`

### What We Will Do (Step-by-Step)

1. **Compute Live Balance & Allocation in `PaymentFormModal`:**
   - Filter `allPayments` for the active `loan.id` where `!p.deleted_at`.
   - Call `calculateLoanBalance(loan, loanPayments)` to get `remainingBalanceMinor`, `interestRemainingMinor`, and `principalRemainingMinor`.
   - As the user types `payAmountInput`, call `allocatePayment(payAmountMinor, balance.interestRemainingMinor)` to compute live values:
     - `appliedToInterestMinor`
     - `appliedToPrincipalMinor`
     - `newRemainingBalanceMinor = Math.max(0, balance.remainingBalanceMinor - payAmountMinor)`
2. **Add Quick-Fill Amount Chips:**
   - Below the `Payment Amount (₱)` input, render quick-select pills:
     - **Full Balance** (`formatPHP(balance.remainingBalanceMinor)`)
     - **Half (50%)** (`Math.round(balance.remainingBalanceMinor / 2)`)
     - **Interest Only** (`formatPHP(balance.interestRemainingMinor)` — shown only when `interestRemainingMinor > 0` and `< remainingBalanceMinor`)
3. **Add Reference Number Input for GCash / Bank:**
   - Add state `referenceInput`.
   - When `paymentMethod === "GCash"` or `"Bank"`, show a `Reference / Transaction No.` `TextInput` (e.g., `"e.g. GCash Ref #1029384756"`).
   - Pass `reference: referenceInput.trim() || null` into `paymentHelper.create()`.
4. **Render Live Allocation Preview Card:**
   - Before the `Confirm Payment` button, render a summary card showing:
     - Applied to Interest/Fee: `₱X.XX`
     - Applied to Principal: `₱X.XX`
     - Balance After Payment: `₱X.XX` (or `"FULLY PAID"` badge when `0`).
5. **Display Reference Number in History Views:**
   - Show `p.reference` in `LoanDetailModal` payment history rows and in `ActivityScreen` payment detail modal.

### Verification

- `1. Enter partial payment on loan with interest -> verify live preview shows interest-first split and remaining balance.`
- `2. Tap "Full Balance" chip -> verify input fills exact remaining amount in pesos.`
- `3. Select GCash + enter reference -> verify reference persists in SQLite and displays in Activity & Loan Detail.`

---

## Task 2: Edit & Delete/Archive Borrower

### Why We Need It

1. `borrowerHelper.update()` and `borrowerHelper.softDelete()` already exist in `mobile/src/db-helpers/borrowers.ts`, but have **no UI triggers**.
2. Users cannot fix a typo in a borrower's name, update their phone number/address, change their tag (`[Suki]`, `[Silingan]`), or remove a borrower added by mistake.

### Files Involved

- `mobile/src/components/forms/borrower-form-modal.tsx`
- `mobile/src/app/borrowers.tsx`
- `mobile/src/components/forms/loan-detail-modal.tsx`

### What We Will Do (Step-by-Step)

1. **Add Edit Mode to `BorrowerFormModal`:**
   - Add optional prop `editingBorrower?: Borrower | null` and `onDelete?: (borrower: Borrower) => void`.
   - In `useEffect`, when `editingBorrower` is provided:
     - Parse any leading `[Tag]` from `editingBorrower.notes` into `selectedTag` and strip it from the `notes` text field so tags don't duplicate on save.
     - Pre-fill `name`, `phone`, `address`, and `notes`.
   - In `handleSave`:
     - If `editingBorrower` exists, call `borrowerHelper.update(db, editingBorrower.id, { name, phone, address, notes: combinedNotes })` instead of `borrowerHelper.create()`.
2. **Add Delete/Archive Borrower Guard:**
   - Inside `BorrowerFormModal` (when `editingBorrower` is set), render a `Delete Borrower` button at the bottom.
   - Before deleting, check if the borrower has any active/unpaid loans:
     - If active unpaid loans exist, block deletion with an alert explaining that active loans must be paid or deleted first.
     - Otherwise, confirm with `Alert.alert` and call `borrowerHelper.softDelete(db, editingBorrower.id)`.
3. **Wire Up Edit Buttons in `BorrowersScreen` & `LoanDetailModal`:**
   - On `borrower_only` cards in `BorrowersScreen`, add an `Edit` icon button next to the borrower's name.
   - In `LoanDetailModal`'s Borrower Profile header card, add a small `Edit` pencil button so the user can update phone/address/name directly from a loan view.

### Verification

- `1. Edit existing borrower name, phone, and tag -> verify borrower card and loan cards reflect updated info.`
- `2. Try deleting borrower with active loan -> verify guard blocks deletion.`
- `3. Delete borrower with 0 active loans -> verify soft-deleted in SQLite and queued in sync_queue.`

---

## Task 3: Backdating Loans & Payments + Custom Due Date

### Why We Need It

1. Offline users migrating from a physical _kwaderno_ (notebook) need to encode loans and payments that happened days or weeks ago.
2. Currently, `LoanFormModal` and `PaymentFormModal` hardcode `loan_date` and `payment_date` to `getLocalDateString()` (today).
3. Users also need to set a specific custom due date (`YYYY-MM-DD`) when a borrower promises a specific payday (e.g., 15th or 30th of the month).

### Files Involved

- `mobile/src/services/date/dateUtils.ts`
- `mobile/src/components/forms/loan-form-modal.tsx`
- `mobile/src/components/forms/payment-form-modal.tsx`

### What We Will Do (Step-by-Step)

1. **Add Date Validation Helper in `dateUtils.ts`:**
   - Add `isValidDateString(dateStr: string): boolean` checking `/^\d{4}-\d{2}-\d{2}$/` and valid calendar date parsing.
2. **Add Date Borrowed & Custom Due Date to `LoanFormModal`:**
   - Add `loanDateMode` (`"today" | "yesterday" | "custom"`) and `customLoanDate` (`YYYY-MM-DD`).
   - Default to `"today"` (`getLocalDateString()`), with quick pills for `Today`, `Yesterday` (`addDays(today, -1)`), and `Custom Date`.
   - In Due Date options (`15 Days`, `30 Days`, `60 Days`, `No Due Date`), add a `Custom` pill that reveals a `YYYY-MM-DD` input field.
   - Calculate preset due dates relative to the selected `loanDateStr` (not hardcoded today), and validate custom dates before saving.
3. **Add Payment Date Selector to `PaymentFormModal`:**
   - Add `paymentDateMode` (`"today" | "yesterday" | "custom"`) and `customPaymentDate` (`YYYY-MM-DD`).
   - Default to `Today`, allowing 1-tap `Yesterday` or custom `YYYY-MM-DD` entry.

### Verification

- `1. Create loan backdated 45 days with 30-day term -> verify loan immediately appears as 15d overdue.`
- `2. Record payment with Yesterday's date -> verify payment_date in Activity matches yesterday.`
- `3. Enter invalid custom date (e.g. 2026-02-31) -> verify validation alert stops submission.`

---

## Task 4: Offline JSON Backup Import / Restore

### Why We Need It

1. `SettingsScreen` provides `Export JSON Database`, which shares a JSON string containing `borrowers`, `loans`, and `payments`.
2. However, there is **no way to import/restore** that JSON backup offline. If a user resets their phone or switches devices without using a cloud account, their exported JSON backup cannot be loaded back into the app.

### Architectural Safeguards

- **Zero Native Module Dependency:** Use a Paste JSON Modal in `SettingsScreen` (works immediately in Expo Go since `handleExportJSON` outputs raw JSON via `Share.share`).
- **Causal Foreign Key Order:** Restore must insert inside `db.withTransactionAsync` strictly in order: `borrowers` $\rightarrow$ `loans` $\rightarrow$ `payments` using `ON CONFLICT(id) DO UPDATE` (reusing the upsert pattern in `syncService.pull`).
- **Derived Status & Outbox:** Recompute each loan's `status` (`active` vs `paid`) via `calculateLoanBalance` after restoring payments, and enqueue restored records into `sync_queue` so they sync cleanly if the user later connects a cloud account.

### Files Involved

- `mobile/src/services/backup/backupService.ts` _(new file)_
- `mobile/src/app/settings.tsx`

### What We Will Do (Step-by-Step)

1. **Create `backupService.ts`:**
   - Write `validateAndRestoreBackup(db: SQLiteDatabase, rawJson: string): Promise<{ borrowers: number; loans: number; payments: number }>`:
     - Parse JSON and validate structure (`borrowers` array, `loans` array, `payments` array, valid UUIDs and integer `principal_minor` / `amount_minor`).
     - Run inside `await db.withTransactionAsync(async () => { ... })`:
       - Upsert (`ON CONFLICT(id) DO UPDATE`) each borrower into `borrowers`.
       - Upsert each loan into `loans`.
       - Upsert each payment into `payments`.
       - Recompute loan `status` (`paid` when `remainingBalanceMinor === 0`, otherwise `active`) and enqueue unsynced records to `sync_queue`.
2. **Add "Restore / Import JSON Backup" Modal in `SettingsScreen`:**
   - Under `DATA VAULT & EXPORT`, add a **Restore from JSON Backup** row.
   - Tapping opens a modal where the user can paste their exported JSON backup text and preview record counts before confirming restore.
   - On confirm, call `validateAndRestoreBackup(db, jsonInput)`, refresh `SettingsScreen` stats, and show a success feedback alert.

### Verification

- `1. Export JSON -> Erase Local Data in Settings -> Paste JSON in Restore modal -> verify all borrowers, loans, payments, and balances match pre-wipe state.`
- `2. Paste malformed JSON -> verify transaction aborts cleanly with clear error message and zero partial writes.`

---

## Task 5: Offline SMS / Receipt Generator ("Singil / Resibo")

### Why We Need It

1. Offline lenders communicate with borrowers via SMS or Facebook Messenger.
2. `LoanDetailModal` currently only has a `Call` button (`tel:`).
3. Adding 1-tap **SMS Reminder** and **Share Receipt / Statement** in Bisaya (default), Tagalog, or English lets the user send a clear breakdown (`Imong utang, klaro pirmi`) with 0 bytes of network data.

### Files Involved

- `mobile/src/services/share/receiptGenerator.ts` _(new file)_
- `mobile/src/components/forms/loan-detail-modal.tsx`
- `mobile/src/app/activity.tsx`

### What We Will Do (Step-by-Step)

1. **Create `receiptGenerator.ts` with Multi-Language Templates (`Bisaya` | `Tagalog` | `English`):**
   - **Payment Receipt (`generatePaymentReceipt`):**
     - Bisaya: `"Salamat {name}! Nadawat ang {amount} nga bayad karon ({date}). Nabilin nga balance: {remaining}. — PautangBai"`
     - Tagalog: `"Salamat {name}! Natanggap ang {amount} na bayad ngayong {date}. Natitirang balanse: {remaining}. — PautangBai"`
     - English: `"Thank you {name}! Received {amount} payment on {date}. Remaining balance: {remaining}. — PautangBai"`
   - **Polite Due Reminder / Statement (`generateLoanReminder`):**
     - Includes Borrower Name, Principal, Tubo/Fee, Total Paid, Remaining Balance, and Due Date with polite reminder phrasing in the selected language.
2. **Wire Up SMS & Share Triggers in `LoanDetailModal`:**
   - **SMS Button:** Next to the `Call` button (when `borrower?.phone` exists), add an `SMS` button that opens `Linking.openURL('sms:${borrower.phone}?body=' + encodeURIComponent(reminderText))`.
   - **Share Statement Button:** In `LoanDetailModal`, add a `Share Statement / Resibo` button calling `Share.share({ message: statementText })` (works with Messenger, Viber, SMS, clipboard).
3. **Add Share Payment Receipt in `ActivityScreen`:**
   - Inside the Payment Record detail modal in `ActivityScreen`, add a `Share Receipt (Resibo)` button that shares the specific payment amount, date, method, reference, and updated loan balance.

### Verification

- `1. Tap SMS on borrower with phone -> verify native SMS app opens with pre-filled phone and balance summary.`
- `2. Tap Share Statement on LoanDetailModal -> verify native share sheet opens with formatted ledger text.`

---

## Task 6: Borrower-Grouped View & "Kwaderno" Running Ledger (Statement of Account)

### Why We Need It

1. In `BorrowersScreen`, once a borrower has a loan, they only appear as individual loan cards (`loansData`), and `borrowerOnlyData` hides them.
2. In a real-world physical notebook (_kwaderno_), a lender tracks a **chronological running balance** per person across all their loans and payments:
   - `2026-10-01 — Utang: +₱5,500 (Principal ₱5,000 + Tubo ₱500) -> Bal: ₱5,500`
   - `2026-10-15 — Bayad: -₱1,000 -> Bal: ₱4,500`
   - `2026-10-30 — Bayad: -₱2,000 -> Bal: ₱2,500`

### Architectural Safeguard

- **Do not use raw SQL `UNION ALL` alone for loan totals:** Because interest (`percentage_flat`, `daily`, `weekly`, `monthly`, `fixed_amount`) is computed via `calculateTotalChargeMinor`, a pure SQL query summing only `principal_minor` would understate balances on interest-bearing loans.
- Instead, combine the borrower's non-cancelled loans (`+totalOwedMinor` on `loan_date`) and non-deleted payments (`-amount_minor` on `payment_date`) in `buildBorrowerKwaderno()`, sort by `(date ASC, created_at ASC)`, and compute cumulative `runningBalanceMinor`. This guarantees 100% centavo parity with `calculateLoanBalance`.

### Files Involved

- `mobile/src/services/ledger/kwadernoLedger.ts` _(new file)_
- `mobile/src/app/borrowers.tsx`

### What We Will Do (Step-by-Step)

1. **Create `kwadernoLedger.ts`:**
   - Export `buildBorrowerKwaderno(loans: Loan[], payments: Payment[]): KwadernoEntry[]` returning chronological ledger rows (`type: 'loan' | 'payment'`, `date`, `deltaMinor`, `runningBalanceMinor`, `description`, `reference`).
2. **Add View Mode Toggle (`By Debt` vs `By Borrower`) in `BorrowersScreen`:**
   - Next to the Filter Chips in `BorrowersScreen`, add a compact segmented toggle: `Debts` | `Borrowers`.
3. **Build `By Borrower` Aggregated Cards + Kwaderno Modal:**
   - Group `loansData` by `borrower.id`, showing `activeLoansCount`, `totalRemainingMinor`, `totalPaidMinor`, and `hasOverdue`.
   - Add a **View Kwaderno (Statement of Account)** button on each borrower card that opens their chronological running ledger + 1-tap `Share Kwaderno SOA`.

### Verification

- `1. Create 2 loans and 3 partial payments for Maria Santos -> open Maria's Kwaderno ledger -> verify running balance after every row matches total remaining balance.`
- `2. Tap "+ New Loan" on Maria's borrower card -> verify LoanFormModal opens pre-selected to Maria.`

---

## Task 7: Activity Ledger Search, Filter & Loan Detail Action

### Why We Need It

1. `ActivityScreen` lists all loans and payments chronologically, but has **no search bar** and **no type filter** (`All`, `Loans`, `Payments`).
2. Tapping a payment allows voiding it, but tapping a loan in `ActivityScreen` only shows a tiny popup with principal and date—it doesn't show the loan's full breakdown or let you jump to `LoanDetailModal`.

### Files Involved

- `mobile/src/app/activity.tsx`

### What We Will Do (Step-by-Step)

1. **Add Search Input & Filter Chips to `ActivityScreen`:**
   - Add `searchQuery` state (matches borrower name, subtitle, payment method, payment notes, or reference number).
   - Add filter chips: `All`, `Payments`, `Loans`.
2. **Connect Loan Activity Items to `LoanDetailModal`:**
   - When the user taps a `loan` item in `ActivityScreen` (or taps `"View Full Loan Details"` inside the transaction modal), open `LoanDetailModal` for that loan so they can inspect payments or record a payment right from Activity.

### Verification

- `1. Filter Activity by "Payments" and search "GCash" -> verify only matching GCash payments display.`
- `2. Tap a loan item in Activity -> verify full LoanDetailModal can be opened.`

---

## Task 8: Offline 4-Digit PIN App Lock

### Why We Need It

1. Lenders often hand their phone to family members or show the screen to borrowers.
2. Because offline mode doesn't require logging in, anyone opening the app can see all balances or tap `Erase Local Records`.
3. `expo-secure-store` is already installed in `package.json` and can store an optional 4-digit PIN locally.

### Files Involved

- `mobile/src/app/settings.tsx`
- `mobile/src/app/_layout.tsx`

### What We Will Do (Step-by-Step)

1. **Add PIN Management in `SettingsScreen`:**
   - Under `APP PREFERENCES`, add an **Offline PIN Lock** toggle (`Enable 4-Digit PIN` / `Change or Remove PIN`).
   - Store the PIN in `expo-secure-store` under key `pautangbai_offline_pin`.
2. **Add Lock Screen Gate in `_layout.tsx`:**
   - On cold start (when `pautangbai_offline_pin` is set in `SecureStore`), display a clean PautangBai PIN pad overlay before showing the tabs.
   - Also require the 4-digit PIN (if enabled) before executing `Erase Local Records` in `SettingsScreen`.

### Verification

- `1. Enable 4-digit PIN in Settings -> reload app -> verify PIN gate appears and unlocks only on correct 4-digit code.`
- `2. Disable PIN in Settings -> reload app -> verify app opens directly.`

---

## Task 9: Collection Schedule / Due-Date Buckets ("Kobra Schedule")

### Why We Need It

1. `HomeScreen` (`src/app/index.tsx`) shows total overdue count, but gives no structured schedule for daily/weekly collection rounds.
2. Lenders need to see at a glance who to visit or remind **Today**, **This Week**, and who is **Overdue**.

### Architectural Safeguard

- **Never use SQLite `date('now')` for local due-date buckets:** SQLite `date('now')` evaluates in **UTC**. In the Philippines (`UTC+8`), between 12:00 AM and 7:59 AM, `date('now')` returns *yesterday's* date.
- Always compute `today = getLocalDateString()` and `weekEnd = addDays(today, 7)` using `src/services/date/dateUtils.ts`.

### Files Involved

- `mobile/src/services/date/dateUtils.ts`
- `mobile/src/app/index.tsx`

### What We Will Do (Step-by-Step)

1. **Add Bucket Helper in `dateUtils.ts`:**
   - Add `getDueDateBucket(dueDateStr: string | null, todayStr?: string): 'overdue' | 'due_today' | 'due_this_week' | 'later' | 'no_due_date'`:
     - `dueDateStr < today` $\rightarrow$ `'overdue'`
     - `dueDateStr === today` $\rightarrow$ `'due_today'`
     - `dueDateStr > today && dueDateStr <= addDays(today, 7)` $\rightarrow$ `'due_this_week'`
2. **Add Collection Schedule Filter Pills on `HomeScreen` (`index.tsx`):**
   - Above the `Active Loans` list on Home, add filter pills with live counts:
     - `All Active`
     - `Due Today` (`due_today`)
     - `This Week` (`due_this_week`)
     - `Overdue` (`overdue`)
   - Sort bucketed loans by `due_date ASC` so the most urgent collection appears first, with quick `Pay` and `SMS / Remind` actions.

### Verification

- `1. Create 3 active loans (due yesterday, due today, due in 4 days) -> verify bucket counts (Overdue: 1, Due Today: 1, This Week: 1) and filter pills on Home.`

---

## Task 10: Offline Profit / Capital Analytics ("Tubo vs Puhunan")

### Why We Need It

1. `HomeScreen` currently shows `Total Outstanding`, `Total Lent`, and `Collected`, which mixes principal (`puhunan`) and interest (`tubo`).
2. Users need to know how much actual profit (`tubo`) they have already collected versus how much of their own capital (`puhunan`) is still out in the field.

### Architectural Safeguard

- **Zero Schema Changes Needed:** `calculateLoanBalance(loan, payments)` in `src/services/balance/calculateBalance.ts` **already computes fee-first allocation** per loan (`INTEREST_AND_PAYMENT_RULES.md` #4: payments pay off fee/interest first, remainder pays down principal):
  - `principalMinor` $\rightarrow$ **Puhunan Gipagawas** (Total Principal Lent)
  - `interestPaidMinor` $\rightarrow$ **Tubo Nadawat** (Realized Profit Collected)
  - `principalRemainingMinor` $\rightarrow$ **Puhunan sa Gawas** (Capital Still Out)
  - `interestRemainingMinor` $\rightarrow$ **Tubo Kobrahonon** (Uncollected Interest)

### Files Involved

- `mobile/src/app/index.tsx`

### What We Will Do (Step-by-Step)

1. **Aggregate Tubo vs Puhunan Metrics on `HomeScreen` (`index.tsx`):**
   - Across all non-cancelled loans (`loan.status !== 'cancelled'`), sum from `calculateLoanBalance`:
     - `totalPrincipalLentMinor` (`sum(balance.principalMinor)`)
     - `totalInterestEarnedMinor` (`sum(balance.interestPaidMinor)`)
     - `outstandingCapitalMinor` (`sum(balance.principalRemainingMinor)`)
     - `uncollectedInterestMinor` (`sum(balance.interestRemainingMinor)`)
2. **Render "Tubo vs Puhunan" Analytics Card on `HomeScreen`:**
   - Display a compact breakdown card showing:
     - **Puhunan Gipagawas (Capital Lent)** vs **Puhunan sa Gawas (Capital Still Out)**
     - **Tubo Nadawat (Profit Collected)** vs **Tubo Kobrahonon (Pending Profit)**

### Verification

- `1. Lend ₱1,000 with ₱200 fixed tubo; record ₱300 payment -> verify Tubo Nadawat = ₱200.00, Puhunan sa Gawas = ₱900.00, Tubo Kobrahonon = ₱0.00.`

---

## Task 11: Two-Way Debt Toggle ("Gipautang" vs "Akong Utang")

### Why We Need It

1. Currently the app only tracks money lent to others (**Gipautang** / Receivables).
2. Many users also track their own debts to sari-sari stores, suppliers, cooperatives, or lending apps (**Akong Utang** / Payables).

### Architectural Safeguard (Full-Stack Blast Radius)

- **Only Task Requiring Schema & Backend Migration:**
  - **Mobile SQLite:** Increment `CURRENT_DATABASE_VERSION = 2` in `src/database/migrate.ts` and run `ALTER TABLE loans ADD COLUMN loan_type TEXT NOT NULL DEFAULT 'lent'`.
  - **Dashboard Math Isolation:** `HomeScreen` (`index.tsx`) and `Tubo vs Puhunan` analytics must filter by `loan_type === 'lent'` for receivables/profit and compute a separate `To Pay (Akong Utang)` summary for `loan_type === 'borrowed'` so borrowed money never inflates money lent or profit earned.
  - **Laravel Backend Sync:** Add a migration adding `loan_type` (`default('lent')`) to MySQL `loans` table and allow `loan_type` in `LoanController` / `SyncController` validation so cloud sync preserves the field.

### Files Involved

- `mobile/src/database/migrations/v2.ts` _(new file)_
- `mobile/src/database/migrate.ts`
- `mobile/src/types/database.ts`
- `mobile/src/db-helpers/loans.ts`
- `mobile/src/components/forms/loan-form-modal.tsx`
- `mobile/src/app/index.tsx`
- `mobile/src/app/borrowers.tsx`
- `backend/database/migrations/..._add_loan_type_to_loans_table.php` _(if syncing to cloud)_

### What We Will Do (Step-by-Step)

1. **Add SQLite V2 Migration (`v2.ts` & `migrate.ts`):**
   - Add `loan_type TEXT NOT NULL DEFAULT 'lent'` to `loans` (and include `loan_type` in `v1.ts` for fresh installs).
   - Update `Loan` TypeScript interface with `loan_type?: 'lent' | 'borrowed'`.
2. **Update `LoanFormModal`:**
   - Add a top segmented toggle: **Gipautang (I Lent)** vs **Akong Utang (I Borrowed)**.
3. **Separate Receivables vs Payables on `HomeScreen` & `BorrowersScreen`:**
   - Show **Kobrahonon (To Collect)** vs **Bayronon (To Pay)** summary cards and filter tabs.

### Verification

- `1. Upgrade existing V1 SQLite DB -> verify all existing loans default to loan_type = 'lent' with zero data loss.`
- `2. Create an "Akong Utang" (borrowed) record of ₱2,000 -> verify it increments "Bayronon (To Pay)" and does NOT inflate "Gipautang" or "Tubo Nadawat".`
