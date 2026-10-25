# PautangBai — Project Context

## Product identity
- **Name:** PautangBai
- **Category:** Offline-first personal debt and payment tracker
- **Tagline:** “Imong utang, klaro pirmi.”
- **Primary audience:** Individuals who lend money and need a simple record of who owes them, what was paid, and what remains.
- **Brand note:** “Pautang” refers to lending/loans; “Bai” is a familiar Bisaya form of address. The name is intentionally friendly and locally recognizable.

## Problem
Debt records kept in notebooks, chat messages, or memory can become inconsistent. Users need a clear history of loans, agreed interest, partial payments, due dates, and remaining balances. Connectivity may be unreliable, so core recordkeeping must work offline.

## Core outcomes
1. Add and manage debtors.
2. Create a loan with principal, dates, and an explicitly selected interest rule.
3. Record full or partial payments and preserve a complete transaction history.
4. Show principal, interest, paid amount, and remaining balance separately.
5. Continue creating and viewing records offline.
6. Sync pending changes to a Laravel API when connectivity returns without duplicate payments.

## Technical direction
- Mobile client: React Native + Expo + TypeScript.
- Local database: SQLite.
- Backend: Laravel REST API.
- Server database: MySQL.
- API communication: HTTPS JSON endpoints.
- Offline synchronization: local outbox queue, UUID identifiers, idempotency keys, retry-safe operations.

## Architecture rules
- Local SQLite is the immediate source for the current device UI.
- Write local changes and their outbox entry in the same SQLite transaction.
- The server validates requests and resolves authoritative financial state.
- Sync must be safe to retry; a network timeout must not create a second payment.
- Do not delete unsynced local records on sign-out or sync failure without an explicit recovery/export policy.
- Track conflicts and failed sync operations so the user can resolve them.
- Avoid storing authentication secrets in ordinary SQLite tables or logs; use secure device storage for tokens.

## MVP boundaries
Include debtor management, loan creation, interest configuration, payment recording, balance/history views, offline persistence, sync status, and basic settings. Defer complex multi-user lending businesses, automated SMS, bank integrations, analytics dashboards, and advanced collection workflows until the core data model is stable.

## Decisions that must be confirmed
- Whether the app is single-user or supports accounts/multiple devices in the first release.
- Allowed interest types and whether interest is simple, flat, or time-based.
- Daily/monthly accrual boundary, grace period, rounding precision, and date/time zone.
- How payments are allocated (interest first, principal first, or user-selected).
- Whether interest is applied to original principal or outstanding principal.
- Backup/export and account deletion behavior.
- Applicable Philippine legal requirements for interest and lending disclosures.

## Coding-agent instructions
Before changing code, read this file and the relevant document for the task. Audit the existing project first, summarize findings and proposed changes, and wait for approval before broad refactors or changes to financial rules.
