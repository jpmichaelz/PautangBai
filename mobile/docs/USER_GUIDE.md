# PautangBai — User Guide
**Tagline:** “Imong utang, klaro pirmi.”

PautangBai is a fast, offline-first personal debt and repayment tracking app built for everyday Filipino lenders.

---

## 1. Getting Started
- **Offline First**: PautangBai works 100% offline. All borrower names, loans, and payments save immediately to your phone's local SQLite database.
- **Optional Cloud Sync**: Create an account with a simple username to safely sync and back up records across devices.

---

## 2. Managing Borrowers
1. Navigate to **Borrowers** tab or tap **+ New Borrower** from Home.
2. Enter the borrower's name, phone number (optional), and category/tags (e.g. *Friend*, *Family*, *Business*).
3. Tap **Save Borrower**.

---

## 3. Creating a Loan
1. Tap **+ Create Loan** from Home or inside a borrower's card.
2. **Principal**: Enter loan amount in Pesos (₱).
3. **Interest Rule**:
   - **None (0%)**: Friendly zero-interest loan.
   - **Fixed Amount (₱)**: Flat pesos fee (e.g. ₱500 flat fee).
   - **Flat Percentage (%)**: One-time percentage over the whole term (e.g. 5% flat).
   - **Monthly Percentage (%)**: Calculated per month.
   - **Daily Percentage (%)**: Calculated per day.
4. **Due Date**: Select quick preset (+1 Week, +15 Days, +1 Month, End of Month) or custom date.
5. Tap **Create Loan**. Live preview calculates exact total repayment and interest.

---

## 4. Recording Payments
1. Open active loan and tap **Record Payment**.
2. Enter amount paid in Pesos (₱). Partial payments are allowed; payment amount cannot exceed remaining balance.
3. Choose payment method: **Cash**, **GCash**, or **Bank Transfer**.
4. Tap **Confirm Payment**.
   - **Allocation Rule**: Payments automatically allocate against unpaid interest first, then principal.
   - When remaining balance reaches ₱0.00, loan status automatically marks **Paid**.

---

## 5. Correcting Mistaken Payments
1. Go to **Activity** tab.
2. Tap the mistaken payment to view transaction details.
3. Tap **Reverse Payment**. The payment is voided, and loan balance and status automatically recalculate.

---

## 6. Cloud Backup & Sync
1. Open **Settings** tab.
2. If not logged in, tap **Log In / Register** to connect.
3. Status shows:
   - **Up to date**: All local operations are backed up to the server.
   - **X pending updates**: Changes made while offline waiting to be uploaded.
4. Tap **Sync Now** to push offline updates and pull any remote changes instantly.

---

## 7. Exporting Data
- **Export to Excel / CSV**: Share a clean spreadsheet of all borrowers and loans via Messenger, Gmail, or save to files.
- **Export JSON Backup**: Creates a complete backup file of your entire database. Save to Google Drive or local storage for safe keeping.
