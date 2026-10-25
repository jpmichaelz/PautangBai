# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Individuals who lend money informally (personal loans, neighborhood lending, "pautang") in the Philippines who need a clean, dependable record on their phone of who owes them, payments received, and exact remaining balances.

## Product Purpose

Make debt tracking clear, simple, and transparent ("Imong utang, klaro pirmi"). Replaces lost paper notebooks, messy chat threads, and mental calculations with a reliable offline-first mobile app.

## Positioning

An offline-first, culturally familiar personal lending tracker built specifically for Philippine informal credit norms (zero interest, custom direct fee/tubo, flat/monthly rate), calculating in exact centavos and functioning with zero internet.

## Operating Context

- Used in everyday informal lending situations (market stalls, sari-sari stores, neighborhood, friends/family).
- Often operated in poor or zero connectivity environments (must be 100% functional offline).
- Fast data entry on a phone screen: adding a borrower, logging a loan, or recording a cash payment in seconds.

## Capabilities and Constraints

- **Offline-first:** Local SQLite database is the primary source of truth.
- **Single-user MVP:** Works immediately on device without forced sign-up or login.
- **Financial precision:** All money stored in integer minor units (PHP centavos). Floating-point math is strictly forbidden.
- **Interest/fee rules:**
  - Zero interest (0%) default.
  - Fixed fee (manual peso input, e.g. lend ₱1,000 + ₱200 fee).
  - One-time flat percentage on principal.
  - Monthly percentage on principal.
- **Payment allocation:** Fees and interest paid first, remainder reduces principal. Overpayments rejected (cannot exceed balance).
- **Borrower prerequisite:** A loan strictly requires an existing debtor/borrower. If 0 borrowers exist, creating a loan guides the user directly to add a borrower first.
- **Data portability:** Manual export (JSON/CSV) available from Settings.

## Brand Commitments

- **Name:** PautangBai ("Pautang" = lending; "Bai" = familiar Bisaya term for friend/pal).
- **Tagline:** "Imong utang, klaro pirmi."
- **Tone:** Friendly, trustworthy, respectful, local, practical.
- **Palette:** Forest Green (`#173D35`), Bai Green (`#287A63`), Lively Celadon (`#BCE9CA`), Amber Gold (`#F0B85A`), Ink (`#252B29`).
- **Mascot:** "Bai the Frog" — cheerful, trustworthy companion representing prosperity and good financial housekeeping.

## Evidence on Hand

- Documented design system: `docs/DESIGN_SYSTEM.md` and `docs/PAUTANGBAI_COLOR_PALETTE.md`.
- Mascot vector assets: `docs/MASCOT_ASSETS.md` and `assets/mascot/`.
- Confirmed business rules: `docs/INTEREST_AND_PAYMENT_RULES.md`.
- Schema and API contract: `docs/DATABASE_SCHEMA.md` and `docs/API_CONTRACT.md`.

## Product Principles

1. **Clarity over cleverness:** Amounts, dates, fees, and balances are always plainly visible and unambiguous.
2. **Never lose data offline:** Every entry commits directly to SQLite transactions; app restarts or airplane mode never drop records.
3. **Frictionless logging:** Recording a borrower, loan, or payment must take fewer than 3 taps whenever possible.
4. **Honest financial math:** Centavo precision, no hidden math, fees paid first.
