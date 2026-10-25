# Design System — PautangBai

## 1. Brand identity

- **Product name:** PautangBai
- **Tagline:** “Imong utang, klaro pirmi.”
- **Meaning and personality:** “Pautang” signals loans/lending; “Bai” adds a familiar Bisaya sense of friendliness. The brand should feel locally rooted, trustworthy, clear, and approachable.
- **Brand attributes:** modern, warm, dependable, straightforward, offline-first.
- **Design goal:** a polished personal-finance tool that feels friendly without making money records feel like a game.

## 2. Color palette

Use a restrained palette. Color should reinforce hierarchy and status rather than decorate every component.

| Token         | Hex       | Use                                                               |
| ------------- | --------- | ----------------------------------------------------------------- |
| `forest-900`  | `#173D35` | Primary brand, key headings on light backgrounds, primary buttons |
| `green-700`   | `#287A63` | Secondary brand, active navigation, links                         |
| `frog-400`    | `#75C99C` | Frog mascot body and friendly illustrations                       |
| `mint-300`    | `#A8DCC5` | Soft highlights, selected surfaces, subtle progress indicators    |
| `paper-50`    | `#BCE9CA` | Main light-mode background (Lively Celadon)                       |
| `amber-500`   | `#F0B85A` | Reminders and attention states; use sparingly                     |
| `ink-900`     | `#252B29` | Main text on light surfaces                                       |
| `slate-600`   | `#66716D` | Secondary text                                                    |
| `border-200`  | `#A6D9B6` | Dividers and card borders                                         |
| `white`       | `#FFFFFF` | Cards and input surfaces                                          |
| `danger-600`  | `#B83D3D` | Destructive actions and errors                                    |
| `success-700` | `#24724F` | Paid/synced/success status                                        |
| `warning-700` | `#94600B` | Overdue or sync attention text                                    |

### Color rules

- Use forest green for the primary action, not for every element.
- Use Lively Celadon (#BCE9CA) as the main light-mode canvas and white for cards.
- Use mint for low-emphasis highlights, not long text backgrounds.
- Amber is for reminders/attention only; do not use it as a generic accent on every screen.
- Status must not be communicated by color alone. Include text and/or an icon.
- Check text contrast in both light and dark mode. If adding dark mode, define and test a separate token mapping instead of mechanically inverting colors.
- Keep charts limited to a small, accessible palette.

## 3. Typography

### Recommended fonts

- **Headings:** Plus Jakarta Sans, weights 600–700.
- **Body, labels, and financial figures:** Inter, weights 400–600.
- Use bundled/licensed font files or a supported font-loading approach for Expo; verify font licenses and rendering on target devices.

### Type scale

| Role            |  Size |  Weight | Use                                                         |
| --------------- | ----: | ------: | ----------------------------------------------------------- |
| Display         | 30–32 |     700 | Rarely used; onboarding or large summary                    |
| Screen title    | 24–28 |     700 | Main page heading                                           |
| Section heading | 18–20 | 600–700 | Section/card title                                          |
| Body            | 14–16 | 400–500 | Main content                                                |
| Label           | 12–14 | 500–600 | Field labels, metadata                                      |
| Caption         | 11–12 | 400–500 | Supporting information; avoid for critical financial values |

### Number and money formatting

- Use a consistent Philippine peso format, e.g. `₱5,000.00`, and keep it consistent throughout the app.
- Make outstanding balance visually prominent, but always distinguish principal, interest, amount paid, and remaining balance.
- Use tabular/lining numerals when the font supports them so columns of amounts are easier to compare.
- Avoid tiny text for due dates, interest rates, and payment records.

## 4. Layout and components

- **Spacing scale:** 4, 8, 12, 16, 20, 24, 32.
- **Corner radius:** 8 for small controls, 12 for inputs, 16 for cards, 20–24 for large sheets or onboarding panels.
- **Borders:** prefer subtle 1 px borders over heavy shadows.
- **Shadows:** restrained and rare; avoid floating-card overload.
- **Buttons:** clear labels, 48 px minimum touch target where practical, strong primary action, neutral secondary action, and distinct destructive action.
- **Inputs:** visible labels, helpful examples, inline validation, and keyboard types appropriate to the data.
- **Icons:** use one consistent outline icon family; do not mix unrelated icon styles.
- **Navigation:** compact bottom tabs for Home, Debtors, Activity, and Settings.
- **Data density:** finance screens should be compact and scannable. Do not use oversized dashboard cards that push important transactions below the fold.
- **Motion:** short and subtle; never delay saving, navigating, or reading local data for an animation.
- **Accessibility:** support readable font scaling, sufficient contrast, clear focus/pressed states, and accessible labels.

## 5. Illustration and mascot direction

### Primary mascot: original frog character

PautangBai uses an original, friendly frog mascot that feels approachable and dependable. Its rounded body, expressive eyes, forest-green outline, frog-green skin, cream belly, and restrained amber accents connect it with the app's visual palette.

**Originality rule:** create and maintain PautangBai's own vector assets. Do not copy another app's mascot, character design, poses, illustrations, code, or distinctive visual assets.

### Character art direction

- Rounded silhouette and expressive but restrained face.
- Consistent forest-green outline and limited palette.
- Simple shapes that remain legible at small sizes.
- Friendly and mature enough for a personal-finance app; avoid making screens feel childish.
- Avoid excessive gradients, glossy 3D rendering, emoji-like clip art, and mixed illustration styles.
- Never make the mascot shame people about unpaid debt or pressure users through guilt.

### Included SVG assets

See `MASCOT_ASSETS.md` for usage notes. The asset pack includes a labeled preview spritesheet, a reusable SVG symbol library, and separate transparent SVG files for these states:

1. Welcome
2. Happy
3. Thinking
4. Reminder
5. Offline
6. Syncing
7. Payment saved
8. Empty state

## 6. Static illustrations vs spritesheets

### MVP recommendation: static SVG illustrations first

Use a small set of original SVG illustrations and simple icon-based states for the MVP. SVGs stay crisp at different sizes and are usually easier to recolor consistently than a large raster spritesheet. Verify SVG compatibility in the chosen React Native/Expo setup.

Suggested initial asset set:

- `mascot-main.svg`
- `empty-debtors.svg`
- `empty-activity.svg`
- `payment-success.svg`
- `offline-saved.svg`
- `sync-attention.svg`
- `all-settled.svg`

Keep each illustration lightweight, with a transparent background and a consistent viewBox. Reuse the same character proportions and palette across the set.

### When to use a spritesheet

Only add a spritesheet if a character genuinely needs frame-by-frame motion, such as a short idle animation or a subtle celebration. For Expo, choose the rendering approach based on platform support and test performance on lower-end Android devices. Keep animation optional and never make essential information depend on it.

If using a spritesheet:

- Define a fixed frame size, frame order, frame rate, and transparent background.
- Keep animation loops short and low-motion.
- Pause or reduce motion when the app is backgrounded or the user prefers reduced motion.
- Provide a static fallback for reduced motion and low-performance devices.
- Do not use animation for core balance calculations, payment confirmation logic, or error states.
- Prefer separate SVG/PNG files when only a few states are needed; a spritesheet is not automatically better.

## 7. Screens and illustration usage

| Screen/state   | Visual treatment                                                                         |
| -------------- | ---------------------------------------------------------------------------------------- |
| Home           | Compact summary cards; mascot optional and small                                         |
| Debtors list   | No large character when records exist; simple empty-state illustration when empty        |
| Loan details   | Prioritize balance breakdown and transaction history over decoration                     |
| Record payment | Minimal distractions; confirm amount and allocation clearly                              |
| Activity       | Clean list with consistent transaction icons                                             |
| Offline        | Small persistent status indicator plus optional offline mascot state                     |
| Sync failure   | Explicit status and retry action; preserve user confidence that local data remains saved |
| Settled loan   | Calm confirmation; avoid confetti-heavy animations                                       |

## 8. Brand voice and microcopy

- Friendly, clear, respectful, and concise.
- Cebuano/Bisaya flavor may appear in the tagline and optional friendly messages, but keep financial labels understandable and consistent.
- Prefer “Payment recorded,” “Saved on this device,” “Sync pending,” and “Balance remaining.”
- Avoid shaming language such as “bad debtor,” guilt-based reminders, or jokes about unpaid money.
- Do not imply a record is synced to the server when it is only saved locally.

## 9. Implementation guidance for coding agents

1. Read `PROJECT_CONTEXT.md` and this design document before implementing UI.
2. Keep palette and typography in shared theme tokens; do not scatter raw hex values throughout components.
3. Build reusable buttons, inputs, cards, status badges, empty states, and amount displays.
4. Use the same component and spacing rules across all screens.
5. Use original or properly licensed assets and include required attribution when applicable.
6. Do not install a large animation library or add a spritesheet pipeline without confirming the need first.
7. Audit screenshots on a small Android device and verify that important balances remain visible without excessive scrolling.
8. Ask before changing the established palette, fonts, mascot direction, or financial information hierarchy.

## 10. Asset references

- `PAUTANGBAI_COLOR_PALETTE.svg` — visual palette swatches.
- `PAUTANGBAI_COLOR_PALETTE.md` — tokens and usage guidance.
- `PAUTANGBAI_FROG_SPRITESHEET.svg` — labeled frog states preview.
- `PAUTANGBAI_FROG_SPRITE_SYMBOLS.svg` — reusable symbol library.
- `mascot/` — individual transparent SVG states for easier integration.
