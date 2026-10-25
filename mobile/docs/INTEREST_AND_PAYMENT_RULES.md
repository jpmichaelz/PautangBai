# Interest and Payment Rules — PautangBai

**Do not implement final financial calculations until these rules are agreed and covered by tests.** This document proposes the decisions that must be explicit, not legal or financial advice.

## Confirmed MVP decisions

1. **Who uses the app:** One person per phone. Works right away without needing to log in. Cloud backup/sync comes later.
2. **Ways to add interest or fee ("tubo"):**
   - **No interest (₱0):** Default. The borrower only pays back the exact money borrowed.
   - **Fixed fee (₱):** You type the fee yourself (for example: lend ₱1,000 + ₱200 fee = ₱1,200 total to pay).
   - **One-time percentage (%):** A single percentage fee (for example: 5% of ₱5,000 = ₱250 fee).
   - **Daily percentage (%):** A percentage fee charged per day for agreed loan days (e.g. 1%/day for 15 days = 15% tubo).
   - **Weekly percentage (%):** A percentage fee charged per week for agreed loan weeks (e.g. 5%/week for 4 weeks = 20% tubo).
   - **Monthly percentage (%):** A percentage fee added each month based on the borrowed amount (e.g. 5%/month for agreed months).
3. **Where percentage is calculated from:** Always from the original amount borrowed.
4. **How payments are applied:** Payments pay off the **fee or interest first**, and whatever is left pays down the borrowed money.
5. **Paying more than what is owed:** Not allowed. The app won't let you enter a payment higher than the remaining balance.
6. **Centavo precision:** Kept in exact centavos (e.g. ₱50.25) so rounding never loses money.
7. **Late payment penalties:** None for now. Kept simple for the first version.
8. **Saving a copy of your records (Backup):** You can download all your data anytime as an Excel-friendly file (CSV or JSON) from Settings.
9. **Borrower prerequisite:** A loan cannot be created without a borrower. When 0 borrowers exist, the action menu only displays the option to add a borrower.

## Example for testing only

Assume principal ₱5,000, no interest, and payments of ₱1,500 then ₱500:

- Starting balance: ₱5,000
- After payment 1: ₱3,500
- After payment 2: ₱3,000

This example illustrates partial payments only. For loans with interest, the balance depends on the selected calculation and allocation rules.

## Calculation principles

- Use integer minor units or fixed-precision decimal arithmetic.
- Never compute financial totals using imprecise floating-point arithmetic.
- Keep original principal, interest charged, payments received, and remaining amount separately visible.
- Preserve an immutable payment ledger; corrections should use a reversal/adjustment event rather than silently editing historical financial events.
- Define how historical calculations are reproduced if interest settings change.
- Use a consistent local date/time zone policy and test month boundaries, leap years, late payments, zero-interest loans, partial payments, and overpayments.

## Legal and user transparency

Before real-world lending use, review applicable Philippine laws, regulations, and disclosure requirements with a qualified source. Show the rate, period, calculation method, and estimated charges clearly before a loan is saved. Do not imply that every configured interest rate or fee is automatically lawful.
