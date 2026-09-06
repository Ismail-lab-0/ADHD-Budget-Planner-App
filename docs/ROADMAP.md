# Roadmap

This roadmap sequences the work. Phases are meant to be done in order —
later phases assume earlier ones exist. Per `CLAUDE.md`, do not start a
module ahead of its phase without the user explicitly asking for it.

> **Product pivot (see `docs/PRODUCT.md`):** the product direction changed
> from a broad "ADHD Life Planner" (tasks, calendar, routines, money,
> goals, weekly review) to a focused "ADHD Budget Planner" centered on one
> derived answer: Safe-to-Spend. Phases 0–1 below were built under the
> original direction; Phase 0 and Phase 1's *application shell* are
> general-purpose and remain valid. Phase 1's *Tasks/Next Action* work is
> now out of scope and retained-but-frozen pending removal — see the note
> at the end of Phase 1. Phase 2 onward is the roadmap for the new
> direction and supersedes everything this document previously said about
> Calendar, Routines, Money/Safe-to-Spend-as-one-of-several, Goals, Weekly
> Review, and Onboarding-for-that-product.

**Current phase: Phase 9 — Data Backup / Import / Export, not started.**
Phases 0–8 are complete: the application shell, the budgeting engine's
data model and CRUD, the Safe-to-Spend calculation engine
(`docs/SAFE-TO-SPEND.md`), the Safe-to-Spend dashboard, real Expense
tracking with a formally decided Current Balance model
(`docs/DATA-MODEL.md` §3a), optional Category Budgets that never affect
Safe-to-Spend (`docs/SAFE-TO-SPEND.md` §3b), and a short optional
onboarding flow with a low-friction UX/language/mobile polish pass. Phase
1's Tasks/Next Action feature work has been removed. A dedicated Full
Testing & Validation pass (not a numbered phase — no new functionality)
ran after Phase 8 and before Phase 9 begins; see the section below and
`docs/QA-REPORT.md`.

> **Out-of-phase-order features shipped at the user's explicit request**
> (each asked for directly and in detail, so the "don't start a module
> ahead of its phase" rule above is satisfied): **"Brain dump"
> quick-capture** (`schemaVersion` 8, `docs/DATA-MODEL.md`
> "ExpenseDraft"), **Debt Tracking** (`schemaVersion` 9,
> `docs/DATA-MODEL.md` "Debt"/"DebtPayment", `docs/PRODUCT.md` §4 item
> 16), and **Savings Goals** — the Budget tab reworked into a Goals tab
> (`schemaVersion` 10, `docs/DATA-MODEL.md` "Goal", `docs/PRODUCT.md` §4
> item 17). Brain dump and Debt Tracking are additive and never touch the
> Safe-to-Spend formula directly; Savings Goals *does* — a goal's
> savedCents is a committed term, protected like Savings
> (`docs/SAFE-TO-SPEND.md` §3d), a deliberate user decision. All three
> left every prior phase intact. Phase 9 itself is still not started.
>
> The **UI shell** was also restructured at the user's explicit request
> (not a numbered phase, no data/calculation change): a persistent left
> **sidebar**, then a conversion from a single scrolling screen into a
> real **multi-view app** with hash routing (`#dashboard`, `#expenses`,
> …) — see `CLAUDE.md` "Current status". The store, schema, and every
> `src/modules/**` calculation are untouched by it.

## Phase 0 — Foundation (scaffolding, no features) ✅ complete, reusable

Goal: a minimal, boring, well-tested core that every future module builds
on. Nothing here is product-specific.

- Project scaffolding: `/src` directory layout, dev `index.html` +
  `main.js` entry point. ✅ done.
- Core services: state store (`get`/`dispatch`/`subscribe`), event bus,
  date utilities, id generator. ✅ done (`src/core/`).
- Storage adapter: load/save against `localStorage`, schema version field,
  migration runner, corrupted-data recovery path. ✅ done
  (`src/core/storage.js`, `src/core/schema.js`).
- Unit test setup using `node:test`. ✅ done (`npm test`).

Exit criteria: an empty app that opens, persists an empty state, survives
a reload, and builds to a working single HTML file. **Met.**

## Phase 1 — Application shell ✅ complete, reusable

- App shell: header, hash-routed nav, main content region
  (`src/ui/shell.js`).
- Design system: color/typography/spacing/radius tokens, light+dark,
  `prefers-reduced-motion`, buttons, cards, inputs, nav, modal structure,
  empty states, status indicators (`src/styles/`).
- Responsive layout: mobile bottom tab bar with ≥44px touch targets, top
  nav + centered content from 640px up (`src/styles/responsive.css`).
- App-level state wiring: `rootReducer` + `initAppState`
  (`src/main.js`), debounced persistence, flush on page hide/unload.
- Error handling: calm fallback on startup failure; in-memory-only
  degradation if `localStorage` is unavailable.
- Build script: inlines `/src` into one `dist/index.html`
  (`build/build.js`), plus a zero-dependency local dev server
  (`build/serve.js`).

Exit criteria: an empty-state shell that navigates, persists, and builds
to one file. **Met.** None of this is product-specific — it's the
foundation the budget product builds on directly.

### ⚠️ Removed: Tasks + Next Action (built under the retired direction)

Previously built in this phase, under the original "ADHD Life Planner"
direction: a Tasks module (capture/edit/complete/delete, grouped by
priority), a Next Action recommendation engine, and Today-screen
integration for both. **Removed in Phase 2** (`src/modules/tasks/`,
`src/modules/next-action/`, `src/modules/today/`, `src/ui/screens/
tasks.js`, and their tests are gone) as a deliberate first step, alongside
introducing the new budget schema — per `docs/PRODUCT.md` §5/§9, general
task management and a task recommendation engine are out of scope for
this product.

## Phase 2 — Budgeting Engine ✅ complete (except Safe-to-Spend — see below)

Data model + basic CRUD + a basic Money view. Deliberately **not**
Safe-to-Spend or the final dashboard — those are Phase 3/4.

- Retired the superseded Tasks/Next Action/Today-for-tasks code (see
  above). ✅ done.
- New schema (`schemaVersion: 3`): `budget` (Current Balance, Savings
  allocation, Safety buffer — single-value figures), `incomes`, `bills`,
  `plannedExpenses`, with a migration from v2 that (deliberately, per
  `docs/DATA-MODEL.md` §7) discards the old task-oriented collections. ✅
  done (`src/core/schema.js`).
- Money stored as **integer cents**, never floats, via `src/core/money.js`
  (`parseAmountToCents`/`formatCents`/`isValidAmountCents`) — avoids
  floating-point precision problems. ✅ done.
- Current Balance: enter/update, persists. ✅ done
  (`src/modules/budget/`).
- Income: create/edit/delete/activate-deactivate, frequencies
  one-time/weekly/biweekly/monthly. ✅ done (`src/modules/incomes/`).
- Upcoming Bills: create/edit/delete/mark paid, recurrence
  one-time/weekly/monthly. ✅ done (`src/modules/bills/`).
- Planned Expenses: create/edit/delete, separate from logged spending
  (expense *tracking* is Phase 5, not this phase). ✅ done
  (`src/modules/planned-expenses/`).
- Savings allocation, Safety buffer: enter/update, persist, excluded from
  Safe-to-Spend once that exists. ✅ done (`src/modules/budget/`).
- Basic Money/Budget view managing all of the above — functional, not the
  final dashboard. ✅ done (`src/ui/screens/money.js`).

Exit criteria: every area above persists correctly through a refresh, with
unit test coverage per `docs/TEST-PLAN.md`. **Met.**

**Explicitly not done, on purpose:** the Safe-to-Spend calculation and the
final dashboard — see Phase 3/4.

## Phase 3 — Safe-to-Spend formula ✅ complete

The engine phase: no UI, but the foundation Phase 4 depends on. Per
`docs/PRODUCT.md` §6, the calculation was formally defined and documented
*before* being coded — see `docs/SAFE-TO-SPEND.md` for the full formula
and every deliberate decision behind it (what counts as "upcoming," why
income is never added to the balance, recurring vs. one-off handling,
negative-result handling, etc.).

- `getSafeToSpend(state, { now })` — the full calculation, returning a
  structured result (current balance, upcoming bills/planned expenses
  within the horizon, savings/safety buffer, the resulting Safe-to-Spend
  figure, next payday date, days until payday, daily allowance, a
  negative-result flag). ✅ done (`src/modules/safe-to-spend/`).
- `getSpendingAllowance(state, options)` — thin accessor over the same
  calculation's daily-allowance figure, matching the interface name
  already documented in `docs/ARCHITECTURE.md` §7. ✅ done.
- Product wording centralized (`SAFE_TO_SPEND_LABEL`,
  `PLANNING_DISCLAIMER`, `getSafeToSpendMessage`) so the "estimate, not a
  verified balance" framing and the negative-result messaging are defined
  once, not improvised per-screen later. ✅ done.
- Verified against `docs/PRODUCT.md` §6's illustrative example exactly
  (reproduces $600 from the same inputs) and against 18+ hand-built test
  scenarios (see `docs/TEST-PLAN.md`). ✅ done
  (`tests/unit/safe-to-spend.test.js`,
  `tests/unit/safe-to-spend-recurrence.test.js`).

Exit criteria: `getSafeToSpend`/`getSpendingAllowance` are fully
unit-tested against agreed fixtures, with no UI depending on them yet.
**Met** — no file under `src/ui/` imports `src/modules/safe-to-spend/`.

## Phase 4 — Safe-to-Spend dashboard ✅ complete

- The Simple Dashboard (product feature #12): a hero card with the
  Safe-to-Spend figure, "until payday," and "approx. daily" front and
  center — replaced the `today.js` placeholder as the app's home view
  (renamed to `src/ui/screens/dashboard.js`; nav item renamed
  Today→Dashboard). ✅ done.
- Current Balance shown and easy to update (reuses the existing
  single-value editor from Phase 2). ✅ done.
- Money breakdown: current balance, upcoming income (display-only — see
  `docs/SAFE-TO-SPEND.md` §11a), upcoming bills, planned expenses,
  savings, safety buffer, then the Safe-to-Spend total. ✅ done
  (`src/ui/components/money-breakdown.js`).
- Quick Actions: Add Expense (a quick current-balance decrement — there's
  no separate expense entity until Phase 5), Add Bill, Add Income (the
  latter two reuse the exact same forms as the Money screen). ✅ done
  (`src/ui/components/quick-actions.js`).
- Upcoming Commitments: a short, sorted, limited list of active/unpaid
  bills + planned expenses, not a transaction table
  (`src/modules/dashboard/`'s `getUpcomingCommitments`, composition logic
  only — no money arithmetic). ✅ done.
- The dashboard never recomputes Safe-to-Spend itself — every dollar
  figure comes from `getSafeToSpend(state)` — verified by
  `tests/unit/dashboard-integration.test.js` dispatching real changes
  through the real store across all six areas (balance, income, bills,
  planned expenses, savings, safety buffer) and checking the engine's
  result updates each time.

Exit criteria: opening the app answers "how much can I safely spend right
now" without the user doing anything else first. **Met.**

## Phase 5 — Expense tracking ✅ complete

- Fast expense entry (amount required — only field — description/date/
  category/notes optional) — feature #5. ✅ done
  (`src/modules/expenses/`, `src/ui/components/expenses-section.js`).
- Default expense categories (Groceries, Eating Out, Transport, Shopping,
  Entertainment, Health, Subscriptions, Other), freely customizable via a
  `<datalist>`-backed free-text field, not a locked enum. ✅ done.
- **Current Balance model formally decided and documented**
  (`docs/DATA-MODEL.md` §3a): a user-set checkpoint, automatically
  adjusted by logged Expenses (create/edit/delete) in the same state
  transition — not a separate manual step, and not silently clamped when
  it goes negative. ✅ done (`src/modules/expenses/balance-effect.js`,
  applied by `src/main.js`'s `rootReducer`).
- Safe-to-Spend and the dashboard update immediately after logging an
  expense — no separate step, verified by
  `tests/unit/expenses-persistence.test.js`. ✅ done. (Fixed a latent bug
  this surfaced: `getSafeToSpend` was validating `currentBalanceCents`
  with the non-negative-only guard, which would have silently zeroed a
  real negative balance — now uses `isValidBalanceCents`.)
- Compact recent-expenses list with edit/delete, on both the Money screen
  (full, with its own add form) and the Dashboard (compact, no add
  form — Quick Actions already covers that) — not a transaction ledger.
  ✅ done (`src/ui/components/expenses-section.js`).
- Quick Actions' "+ Add Expense" (Phase 4's balance-only bridge) now
  creates a real, persisted `Expense` instead. ✅ done.

Exit criteria: logging a real purchase visibly and correctly moves the
Safe-to-Spend number. **Met.**

## Phase 6 — Daily/Weekly spending allowance (UI) ✅ complete (shipped early, as part of Phase 4)

- Surface `getSpendingAllowance` (built in Phase 3) on the dashboard —
  feature #10. ✅ done — the dashboard hero already shows "Approx. daily:
  $X/day" alongside "Until payday" (`src/ui/components/safe-to-spend-hero.js`).

Exit criteria: the dashboard shows both "safe to spend" and "safe to
spend per day/week until payday." **Met** (since Phase 4).

## Phase 7 — Budget Categories, then Budget Planning ✅ complete

Originally scoped as just "a light, optional category field on
Expenses/Bills/Planned Expenses" (feature #11) — already satisfied by
Expense's `category` field (Phase 5) and PlannedExpense's (Phase 2), no
new work needed for that part. This phase's actual scope grew to cover
lightweight category *budgeting* on top of that:

- Optional monthly spending limits per category (`CategoryBudget`,
  `docs/DATA-MODEL.md`), with simple progress indicators (a plain CSS
  bar, not a chart) clearly showing remaining / approaching-limit /
  exceeded — never phrased as a personal failing. ✅ done
  (`src/modules/category-budgets/`, `src/ui/components/{budget-progress,
  category-budgets-section}.js`).
- A Monthly View (total planned/spent/remaining + each category's
  progress) on both the Money screen (full add/edit/delete) and a
  compact, read-only summary on the Dashboard. ✅ done.
- **Formally decided and documented: Category Budgets do not affect
  Safe-to-Spend, in either direction** (`docs/SAFE-TO-SPEND.md` §3b) —
  they're a planning/visibility layer over Expenses that already reduced
  Current Balance once (Phase 5); adding a second subtraction would
  double-count the same spending. Verified by
  `tests/unit/category-budgets-safe-to-spend.test.js`. ✅ done.
- "Spent this month" has no explicit reset step — it's derived fresh
  from `Expense.date` falling in the current calendar month, so the
  month changes what counts automatically. ✅ done.

Exit criteria: categorizing is optional, fast, and never blocks capture;
category budgets never distort the Safe-to-Spend number. **Met.**

## Phase 8 — Onboarding & Product Polish ✅ complete

- A brief, entirely optional first-run flow (`src/ui/screens/onboarding.js`):
  Current Balance + Safety Buffer + Savings target (one combined form),
  Next Payday (amount + date only — no unnecessary decisions), and
  Upcoming Bills (reuses the real Bill form, add as many or as few as you
  want). "Skip for now" (top) and "Finish setup" (bottom) both just mark
  onboarding done — every section is independently optional. ✅ done
  (`src/modules/settings/`, `schemaVersion` unchanged — `onboardingCompletedAt`
  already existed in Settings since Phase 0).
- **Returning users with pre-existing budget data are never shown
  onboarding** — a one-time backfill in `initAppState` marks it complete
  automatically if any real data exists, so nobody who set things up in
  Phases 2-6 is asked to "start" again. ✅ done, tested
  (`tests/unit/onboarding-integration.test.js`).
- Low-friction pass on Add Expense / Add Bill / Add Income: progressive
  disclosure ("+ More options") now hides secondary fields behind the
  essentials — Amount + Category for Expense, Name + Amount for Bill,
  Name + Amount + Next date for Income (kept visible — it drives the
  Safe-to-Spend horizon, unlike Frequency) — matching this phase's exact
  "Amount → Category → Save" fast-path. ✅ done
  (`src/ui/components/more-options.js`, reused across all three forms).
- Empty states reviewed for helpfulness, not just "no data" — e.g. Income's
  now nudges toward improving the Safe-to-Spend estimate rather than
  stating a bare fact. ✅ done.
- Language/tone audit across all UI copy — no medical/diagnostic/shame
  language found; the one existing exceeded-budget label ("Over budget")
  confirmed neutral, not judgmental. ✅ done.
- Mobile pass: verified touch targets, `inputmode="decimal"` numeric
  keyboards, and card layouts already held up from earlier phases; added
  keyboard focus into newly-revealed "+ More options" fields and
  defensive `flex-wrap` on the money breakdown rows. ✅ done.
- Success feedback: single-value editors (Current Balance/Savings/Safety
  Buffer) and the onboarding forms now show a brief "Saved." confirmation
  — list-based additions (a new Bill/Income/Expense row appearing) were
  already self-evident and didn't need one. ✅ done.
- Loading states: not applicable — all reads are synchronous
  `localStorage` access (Phase 0), so there's no asynchronous gap to show
  a loading indicator for; adding one would be decoration, not function.

Exit criteria: a new user reaches a useful Safe-to-Spend number in well
under a few minutes. **Met.**

## Full Testing & Validation pass ✅ complete (between Phase 8 and Phase 9)

Not a numbered roadmap phase — no new product functionality was added. A
dedicated hardening/QA pass across everything built so far, run before
starting Phase 9. Full narrative record: `docs/QA-REPORT.md`; test
coverage record: `docs/TEST-PLAN.md` §2.

- Consolidated the full set of named user flows (open app → balance →
  payday → bills → Safe-to-Spend; add/edit/delete expense and bill, each
  checked against Safe-to-Spend; a full refresh round-trip) and fixed-date
  scenarios (today, tomorrow, payday today/tomorrow/next month, start/end
  of month, recurring-bill rollforward, overdue bills) into
  `tests/unit/qa-user-flows.test.js` and `tests/unit/qa-date-scenarios.test.js`,
  run end-to-end through the real store.
- Data-safety testing (`tests/unit/qa-data-safety.test.js`) at the full
  `initAppState`/`getSafeToSpend`/`getCategoryBudgetProgress` level —
  corrupted localStorage, missing/invalid values, empty data, and an
  unexpected old data format — found and fixed two real defects: (1)
  `category-budgets/selectors.js` and `expenses/balance-effect.js` summed
  `amountCents` without validating it first, unlike the established
  pattern in `safe-to-spend/calculation.js` — a corrupted stored expense
  could NaN-poison a category budget's "spent" figure or a balance
  adjustment; (2) `x ?? []` only guards a *missing* collection, not one
  that's present but the wrong type — fixed with `Array.isArray` checks at
  every read site plus a centralized array-normalization step in
  `schema.js`'s `migrate()`, the one place all persisted state passes
  through. Full detail and regression tests: `docs/QA-REPORT.md` §4.
- Manual UX review (wording/tone audit, CSS/mobile-layout code review, and
  a throwaway DOM-shim render smoke test across Dashboard/Money/Onboarding
  with edge-case data) substituted for a live-browser pass, which remains
  unavailable in this environment — see `docs/QA-REPORT.md` §6/§7 for what
  was and wasn't covered.

277 → 316 automated tests, all passing; `npm run build` and the bundled
script's direct execution both verified clean.

## Phase 9 — Data Backup / Import / Export

- Export current state as downloadable JSON; import with validation,
  migration, and explicit confirmation before overwrite (feature #15,
  mechanism already specified in `docs/DATA-MODEL.md` §5).

Exit criteria: a user can move their data to a new browser/device
confidently.

## Phase 10 — Single-file packaging & release polish

- `build/build.js` already exists and works (Phase 1) — verify it against
  the full budget module set, harden as needed (feature #16).

Exit criteria: `dist/index.html` is the real, shippable product artifact.

## Phase 11 — Accessibility & hardening pass

- Full keyboard-operability audit, `prefers-reduced-motion`/
  `prefers-color-scheme` verification, screen-reader spot checks,
  migration/import-export fuzz testing.

Exit criteria: see `docs/TEST-PLAN.md` for the concrete checklist.

## Explicitly out of scope

Per `docs/PRODUCT.md` §5 — general task management, a calendar, routines,
general life planning, goals, weekly productivity review, a task
recommendation engine, a focus timer, and general ADHD life management.
These were part of the retired product direction; do not resurrect them
without an explicit user decision to expand scope again.
