# PautangBai Mascot Assets

## Mascot direction

PautangBai uses an original, friendly frog mascot: rounded shapes, expressive eyes, forest-green outlines, light frog-green skin, a cream belly, and restrained amber accents. The tone is supportive and non-judgmental—never shaming people about debt.

## Files

- `PAUTANGBAI_COLOR_PALETTE.svg` — visual palette swatches.
- `PAUTANGBAI_COLOR_PALETTE.md` — palette tokens and usage rules.
- `mascot/frog-welcome.svg` — onboarding / welcome.
- `mascot/frog-happy.svg` — friendly feedback / dashboard.
- `mascot/frog-borrower.svg` — borrower ledger / add borrower modal.
- `mascot/frog-new-loan.svg` — lending cash / create loan modal.
- `mascot/frog-celebrate.svg` — loan 100% paid in full / all clear celebration.
- `mascot/frog-search-empty.svg` — search query with 0 matching records.
- `mascot/frog-thinking.svg` — calculations / insights.
- `mascot/frog-reminder.svg` — due date / follow-up.
- `mascot/frog-offline.svg` — saved locally while offline.
- `mascot/frog-syncing.svg` — synchronization in progress.
- `mascot/frog-payment.svg` — payment recorded.
- `mascot/frog-empty.svg` — generic empty state / no activity.

## Recommended usage

- Use the individual transparent SVGs for screens where possible; their `viewBox` is `0 0 240 240`.
- For React Native / Expo, test the renderer used by the app. Some SVG renderers do not support `<symbol>` and `<use>` consistently, so the individual SVG files are the safer starting point.
- To create a combined preview or reusable SVG symbol library later, use the coding-agent prompt provided separately; keep individual SVGs as the reliable integration format for Expo.
- Keep the mascot secondary to financial data and key actions. The user must always understand whether a payment is saved locally or synced to the server.
