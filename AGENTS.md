# PautangBai

Monorepo: `backend/` (Laravel API) + `mobile/` (React Native Expo app). Offline-first debt tracker.

## Read first

Before any task, read `mobile/docs/PROJECT_CONTEXT.md` and the doc relevant to the task:

| Task | Doc |
|---|---|
| Features / scope | `mobile/docs/PRODUCT_REQUIREMENTS.md` |
| App structure, sync | `mobile/docs/MOBILE_ARCHITECTURE.md` |
| Tables, models | `mobile/docs/DATABASE_SCHEMA.md` |
| Endpoints | `mobile/docs/API_CONTRACT.md` |
| Interest, payments | `mobile/docs/INTEREST_AND_PAYMENT_RULES.md` |
| UI, colors, mascot | `mobile/docs/DESIGN_SYSTEM.md`, `PAUTANGBAI_COLOR_PALETTE.md`, `MASCOT_ASSETS.md` |
| Roadmap | `mobile/docs/IMPLEMENTATION_PLAN.md` |

## Skills (`.agents/skills/`)

Read the matching `SKILL.md` before starting, not after.

- **`laravel-best-practices`** — any work in `backend/`: controllers, models, migrations, form requests, policies, jobs, Eloquent queries, API resources, auth, validation, caching.
- **`impeccable`** — any UI work in `mobile/`: screens, components, layout, typography, color, motion, UX copy, accessibility, polish/critique/audit. Read `PRODUCT.md` (and `DESIGN.md` if present) first; run `/impeccable init` if `PRODUCT.md` is missing. Follow `mobile/docs/DESIGN_SYSTEM.md` over generic choices.

Backend-only task: skip `impeccable`. UI-only task: skip `laravel-best-practices`. Full-stack feature: use both.

## Rules

- Per-app rules live in `backend/AGENTS.md` and `mobile/AGENTS.md`; follow them for files in that app.
- Financial rules (interest, payment allocation) change only after user approval.
