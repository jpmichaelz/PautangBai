# PautangBai — Project Documentation

**PautangBai** is an offline-first mobile app for tracking debtors, loans/utang, interest, partial payments, and outstanding balances.

> **Tagline:** “Imong utang, klaro pirmi.”  
> *Your debts, always clear.*

## Documents
1. `PROJECT_CONTEXT.md` — project overview and guiding decisions
2. `PRODUCT_REQUIREMENTS.md` — MVP scope and user flows
3. `DATABASE_SCHEMA.md` — local and server data model
4. `MOBILE_ARCHITECTURE.md` — React Native/Expo structure and offline design
5. `API_CONTRACT.md` — proposed Laravel API contract
6. `INTEREST_AND_PAYMENT_RULES.md` — calculation and payment rules that must be confirmed
7. `IMPLEMENTATION_PLAN.md` — phased development checklist
8. `DESIGN_SYSTEM.md` — colors, typography, components, and mascot direction
9. `PAUTANGBAI_COLOR_PALETTE.md` / `.svg` — color tokens and visual swatches
10. `MASCOT_ASSETS.md` — frog mascot usage and integration notes
13. `mascot/` — individual transparent frog SVG states for app screens

## Recommended stack
- **Mobile:** React Native + Expo + TypeScript
- **Local storage:** SQLite for offline-first operation
- **Backend:** Laravel REST API
- **Server database:** MySQL
- **Sync:** durable local outbox, UUIDs, idempotent API operations

## Important implementation principles
- The app must remain useful without internet access.
- Store user-created data locally first; never discard unsynced changes after a failed request.
- Use stable UUIDs for local entities and idempotency keys for sync/payment operations.
- Treat the server as the authority for cross-device reconciliation and final financial calculations.
- Define interest, rounding, due-date, and payment-allocation rules before implementing calculations.
- Do not present the app as a legal or financial adviser. Review applicable Philippine laws and rules before using real lending/interest terms.

## Suggested setup
Extract these documents into the project root under `docs/`. Read `PROJECT_CONTEXT.md` first, then follow `IMPLEMENTATION_PLAN.md` in small, testable phases.
