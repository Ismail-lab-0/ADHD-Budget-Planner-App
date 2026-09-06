# CLAUDE.md

Instructions for any Claude Code session (or other AI agent) working in this
repository. Read this file first. Then read, in this order:

1. `docs/PRODUCT.md` — what we're building and why
2. `docs/ARCHITECTURE.md` — how it's built
3. `docs/DATA-MODEL.md` — how data is shaped and stored
4. `docs/SAFE-TO-SPEND.md` — the exact formula behind the product's core feature
5. `docs/ROADMAP.md` — what phase we're in right now
6. `docs/TEST-PLAN.md` — how changes get validated

If any instruction you're given conflicts with these documents, flag the
conflict to the user instead of silently picking one side.

## Non-negotiable constraints

These apply to every session, every phase, no exceptions without an explicit
user decision:

- **No backend.** No server, no database, no hosted API of any kind.
- **No login / no accounts.** No auth flows, no user identity beyond "the
  one person using this browser."
- **No external AI API calls, no API keys, no third-party SDKs that phone
  home.** Nothing in this app should make a network request in normal use.
- **No analytics, telemetry, or tracking scripts.** Not even "privacy
  friendly" ones.
- **localStorage is the only persistence layer**, accessed exclusively
  through the storage adapter described in `docs/ARCHITECTURE.md` — never
  read/write `localStorage` directly from feature modules.
- **Offline-capable at all times.** If a feature needs the network to be
  useful, it doesn't belong in this app.
- **No medical, diagnostic, or treatment claims about ADHD**, anywhere —
  UI copy, docs, code comments, commit messages. This is an organizational
  tool, not a clinical one. Never imply diagnosis, symptom tracking, or
  medical advice.
- **Product scope is budgeting/Safe-to-Spend only** (see
  `docs/PRODUCT.md`). Do not implement general task management, a
  calendar, routines, general life planning, life-goals (aspirations/
  habits/projects), a weekly productivity review, a task recommendation
  engine, or a focus timer — these were part of an earlier, retired
  product direction ("ADHD Life Planner") and are explicitly out of scope
  now. **Note:** the "Goals" tab that exists today is *savings goals* — a
  budgeting concept (money set aside toward a target: emergency fund, new
  laptop), added at the user's explicit request (`docs/PRODUCT.md` §4
  item 17). It is not the retired life-goals module; the name collision
  is intentional and resolved in `docs/PRODUCT.md` §5. This applies even
  though working code for some retired features (Tasks, Next Action) may
  still exist in the repo — see "Current status" below.

## Product discipline

- The **Safe-to-Spend dashboard is the center of the product.** Every new
  feature must answer "how does this affect Safe-to-Spend?" before it's
  considered done. A feature that only lives on its own screen and never
  feeds that number is incomplete.
- **Answer questions, don't dump data.** Every screen should be evaluated
  against: "Could this instead tell the user what to do?" (see
  `docs/PRODUCT.md` for the canonical examples — e.g. a Safe-to-Spend
  number, not a raw transaction ledger). Raw lists are a fallback, not the
  default.
- **Reducing user effort beats adding features.** When in doubt, cut scope
  rather than add a setting, a field, or a screen. Do not add features
  beyond the list in `docs/PRODUCT.md` §4 without an explicit user
  decision.
- **Progressive disclosure.** Default views stay minimal; power/detail
  views are opt-in, never the first thing shown.

## Process discipline

- **Follow the roadmap phase order** in `docs/ROADMAP.md`. Do not start
  Bills, Expense Tracking, Savings, or any other feature module ahead of
  its phase unless the user explicitly asks for it in those words.
- **This repository intentionally starts from zero code.** Do not port,
  copy, or reference implementation from any prior ADHD planner prototype
  outside this repo. Prior work (if ever mentioned) is concept validation
  only, not a technical foundation.
- **Do not resurrect the retired Tasks/Next Action code.** `src/modules/
  tasks/`, `src/modules/next-action/`, `src/modules/today/`, and
  `src/ui/screens/tasks.js` were built under a since-retired product
  direction (see `docs/PRODUCT.md` §9) and were removed in Phase 2
  (`docs/ROADMAP.md`). Don't re-add general task management without an
  explicit user decision to expand scope again.
- **No new runtime dependencies without asking.** The default is zero
  dependencies (vanilla HTML/CSS/JS). A dev-time tool (e.g. a test runner,
  a tiny build script) is fine if it's justified in `docs/ARCHITECTURE.md`
  or `docs/TEST-PLAN.md`; anything else, ask first.
- **Keep the app buildable into one self-contained HTML file.** Don't
  introduce anything that can't eventually be inlined: no server-only
  code, no runtime dynamic imports from a network location, no build step
  that can't run locally with no network access.
- **Respect module boundaries** as defined in `docs/ARCHITECTURE.md`.
  Feature modules talk to core services (state store, storage adapter,
  event bus) through their public interfaces, never to each other's
  internals.
- **Schema changes require a version bump and a migration**, plus an
  update to `docs/DATA-MODEL.md` in the same change. Never assume a
  user's existing localStorage data can just be reshaped silently.
- **Update the docs in the same change as the code** when the change
  alters product scope, architecture, or data model — these documents are
  meant to stay true, not aspirational.

## Current status

**Product pivot in effect** (see `docs/PRODUCT.md`): the project is
ADHD Budget Planner, focused on Safe-to-Spend, not the earlier broader
"ADHD Life Planner." `docs/ROADMAP.md` Phases 0–1 (state store, event bus,
schema/migration registry, storage adapter, id/date utilities, UI shell,
design system, build script — all in `src/core/`, `src/ui/`, `src/styles/`,
`build/`) are **complete and reusable**, none of it product-specific.

The Tasks module, Next Action recommendation engine, and Today-screen
task integration built in Phase 1 under the retired direction have been
**removed** (Phase 2) — `src/modules/tasks/`, `src/modules/next-action/`,
`src/modules/today/`, and `src/ui/screens/tasks.js` no longer exist. Don't
resurrect them without an explicit user decision to expand scope again.

**Phase 2 — Budgeting Engine (data model + CRUD) is complete.**
`schemaVersion: 3` at the time (now `5` — see Phases 5/7 below): `budget`,
`incomes`, `bills`, `plannedExpenses`, with a v2→v3 migration that
discards the old task-oriented collections; money stored as integer
cents via `src/core/money.js` (never floats); full CRUD for Current
Balance, Income, Bills, Planned Expenses, Savings allocation, and Safety
Buffer (`src/modules/{budget,incomes,bills,planned-expenses}/`); a
functional Money screen (`src/ui/screens/money.js`).

**Phase 3 — Safe-to-Spend formula is complete.** The exact formula is
documented in `docs/SAFE-TO-SPEND.md` (read it before touching this
code — every decision in it is deliberate, not a default). Implemented:
`getSafeToSpend(state, { now })` and `getSpendingAllowance(state,
options)` (`src/modules/safe-to-spend/`), pure and fully unit-tested
(`tests/unit/safe-to-spend*.test.js`), reproducing `docs/PRODUCT.md` §6's
worked example exactly.

**Phase 4 — Safe-to-Spend dashboard is complete.** It's the app's home
screen (`src/ui/screens/dashboard.js`, replacing the old `today.js`
placeholder — nav renamed Today→Dashboard). It renders `getSafeToSpend`'s
result directly and **never recomputes any of the arithmetic itself** —
if you're tempted to add a `+`/`-` involving money inside `src/ui/`,
that logic belongs in `src/modules/safe-to-spend/` instead, with a
`docs/SAFE-TO-SPEND.md` update in the same change. Composition/selection
logic that isn't money math (e.g. "which bills to list") lives in
`src/modules/dashboard/`, which is fine to extend. Phase 6 (daily/weekly
allowance in the UI) shipped early as part of this — it's already on the
hero.

**Phase 5 — Expense tracking is complete.** `schemaVersion: 4` at the
time (now `5` — see Phase 7 below) (`src/modules/expenses/`). Read
**`docs/DATA-MODEL.md` §3a "Current
Balance model"** before touching anything balance-related — it's a
formally decided, deliberate design: Current Balance is a user-set
checkpoint, automatically decremented by logged Expenses (create/edit/
delete), and it **can legitimately go negative** — it is the one
monetary field in this codebase not validated by the non-negative
`isValidAmountCents` (it uses `isValidBalanceCents` instead;
`parseBalanceToCents` for user input). The Expense→Balance link is a
deliberate, documented exception to normal module boundaries (see
`docs/ARCHITECTURE.md` §7) — applied atomically in `src/main.js`'s
`rootReducer`, not the event bus.

**Phase 7 — Budget Planning (Category Budgets) is complete.**
`schemaVersion: 5` (`src/modules/category-budgets/`). Optional monthly
spending limits per category, with progress bars and a Monthly View
(Money screen: full CRUD; Dashboard: compact read-only summary).
**Formally decided and documented: Category Budgets never affect
Safe-to-Spend, in either direction** — read **`docs/SAFE-TO-SPEND.md`
§3b** before changing anything here. The reasoning, restated because it's
easy to get backwards: every dollar a budget's "spent" figure counts
already reduced `budget.currentBalanceCents` once, the moment the
`Expense` was logged (Phase 5) — subtracting it again via a category
budget would double-count the same spending. `src/modules/
category-budgets/` has no import relationship with `src/modules/
safe-to-spend/` in either direction, and
`tests/unit/category-budgets-safe-to-spend.test.js` proves it stays that
way. "Spent this month" has no stored/reset state — it's derived fresh
from `Expense.date` falling in the current calendar month, every time.

**Phase 8 — Onboarding & Product Polish is complete.** A new
`src/modules/settings/` module tracks `settings.onboardingCompletedAt`
(schema unchanged — settings is a plain object with no schema-version
bump needed, since `undefined` behaves as "not yet onboarded"). A new
`src/ui/screens/onboarding.js` renders a short, skippable first-run flow
(Current balance, Safety buffer, optional Savings target, Next payday,
Upcoming bills), gated in `src/ui/shell.js`: the nav is hidden and
onboarding shown until `hasCompletedOnboarding(state)` is true. Anyone
who already has budget data (a non-zero balance, or any income/bill/
planned-expense/expense/category-budget) is **automatically backfilled**
as already onboarded on first load after upgrading (`hasExistingBudgetData`
in `src/main.js`) — they never see the onboarding screen. The three main
capture forms (Add Expense, Add Bill, Add Income) were reworked to show
only the essential fields by default, with the rest behind a shared
"+ More options" progressive-disclosure control
(`src/ui/components/more-options.js`); empty states across the app were
rewritten in plain, non-judgmental language; a mobile-usability and
language-audit pass was applied (touch targets, wrapping, wording).

**A dedicated Full Testing & Validation pass is complete** (between Phase 8
and Phase 9 — no new product functionality; see `docs/QA-REPORT.md` for
the full narrative and `docs/TEST-PLAN.md` §2 for coverage). It added
`tests/unit/qa-user-flows.test.js`, `tests/unit/qa-date-scenarios.test.js`,
and `tests/unit/qa-data-safety.test.js` (277 → 316 automated tests), and
found + fixed two real defensive-coding gaps: `category-budgets/
selectors.js` and `expenses/balance-effect.js` now validate `amountCents`
before summing it (matching `safe-to-spend/calculation.js`'s existing
pattern) instead of risking a `NaN`-poisoned result from corrupted stored
data; and every collection read in `safe-to-spend/calculation.js` /
`category-budgets/selectors.js` now uses `Array.isArray(x) ? x : []`
instead of `x ?? []`, with `src/core/schema.js`'s `migrate()` additionally
normalizing the five list-shaped collections to real arrays as a final
step — `x ?? []` only guards a *missing* collection, not one that's
present but the wrong type (which would otherwise throw on `for...of`, or
crash a reducer built on `createListReducer` the moment a user tried to
edit anything in that corrupted slice).

**A visual/structural redesign of the UI shell is also complete**, done at
explicit user direction (not a numbered phase, no calculation logic
touched): the Dashboard/Money nav and hash-based routing are gone —
`src/ui/screens/money.js` was deleted and everything it rendered (Income,
Bills, Planned Expenses, Category Budgets full CRUD, Savings, Safety
Buffer) merged into `src/ui/screens/dashboard.js`, now the app's only
screen (`src/ui/shell.js` no longer builds a `<nav>` or listens for
`hashchange`). At desktop width the dashboard arranges into two columns
(`.dashboard-grid`, `src/styles/responsive.css`) rather than one long
stack; mobile/tablet stay a single column. The visual language was also
reworked toward a specific reference (warm cream/green palette instead of
the earlier purple, a system serif on the hero amount, per-category icon
colors, a "committed vs. available" progress bar under the hero using a
new `totalCommittedCents` field on `getSafeToSpend`'s result — see
`docs/SAFE-TO-SPEND.md` §11b, an already-computed intermediate value, not
a new calculation). This same pass also found and fixed a real,
previously-invisible bug: `build/build.js` bundled the app via
`html.replace(pattern, stringValue)`, and a string replacement's
`$`-prefixed sequences ($$, $&, $1, etc.) get special-cased by
`String.replace` — `src/core/money.js`'s `` `$${dollars}` `` silently lost
its literal `$`, stripping the dollar sign from every formatted amount in
every build. Fixed with a function replacer; regression-tested in
`tests/unit/build.test.js`, which runs the real build as a subprocess
rather than re-testing source modules that never exercised the bug.

**Further sections were removed from the dashboard at the user's request**,
one at a time, after the redesign above: Quick Actions (later re-added,
now opening a popup — see below), the Safety Buffer editable card, Income/
Upcoming Bills/Planned Expenses full list-edit-delete UI, and Budget
Planning (Category Budgets UI). Where a section's only "add" capability
would otherwise have had nowhere left to go (Planned Expenses had no
other entry point once its own section was gone), a matching button was
added to Quick Actions instead of just deleting the capability outright.
`src/ui/components/popup.js` is a shared popup/modal (built on the
Phase 1 `.modal-backdrop`/`.modal` CSS foundation, first actually used
here) that every remaining "add" form opens through — Quick Actions'
buttons and the hero's own "+ Add expense". Quick Actions' "Add Planned
Expense" button was later removed at the user's request (see below);
Planned Expenses as a concept, its data, and its Safe-to-Spend
contribution are all untouched — there's just no UI entry point left to
create a *new* one.

**Safety Buffer was removed from the calculation entirely** (not just the
UI card, which went first) — `setSafetyBufferAction`/`getSafetyBufferCents`
and the `safetyBufferCents` term in `getSafeToSpend`'s formula are gone;
`createEmptyState()` no longer includes the field for new installs. See
`docs/SAFE-TO-SPEND.md` §9 for the full account, including why this
needed no schema version bump or migration (removing a *reader* of a
field, unlike Phases 5/6's additive migrations, doesn't create a shape
mismatch existing stored data needs reconciling against) — a returning
user's leftover `safetyBufferCents` value just sits inertly in their
`localStorage` forever, never read again. `docs/PRODUCT.md` §4/§6 and
this file's own worked-example cross-check test
(`tests/unit/safe-to-spend.test.js`) were updated to match — the
illustrative example is now $750, not $600.

**The Recent Expenses section (now titled "Expenses") gained a period
filter**, at the user's request — a `<select>` (Recent / This week / This
month / Last month / All time / Custom range) above the list; a custom
range adds From/To date inputs. Selecting anything but "Recent" (the
existing default capped-to-10 glance) shows every matching expense,
uncapped, plus a "Total: $X · N expenses" line. This is a pure read-only
lens over Expenses — no stored state, no schema change, and it doesn't
touch Safe-to-Spend (same "derived, not stored" principle as Category
Budgets' monthly figures). New: `src/modules/expenses/selectors.js`'s
`resolvePeriodRange`/`getExpensesForPeriod`/`getExpensesTotalCents`, and
`src/core/date.js`'s `startOfWeek`/`startOfMonth`/`endOfMonth` (Monday-
start weeks — the only convention in use anywhere in the app). **Superseded
by the dashboard redesign below** — this per-card `<select>` is gone,
replaced by the header bar's single global period selector, but the
underlying selectors it introduced (`resolvePeriodRange` etc.) are still
exactly what the global selector is built on.

**A full visual/structural redesign of the dashboard** was done at the
user's explicit, detailed request (light theme by default, real dark-mode
toggle, one global period selector instead of per-card filters, a
Categories card, clearer primary/secondary card hierarchy). Two parts of
the original request conflicted with decisions already recorded in this
file and were resolved with the user (via `AskUserQuestion`) before any
code was written:
- **No icon-rail nav.** The request specified an icon rail navigating
  Today/Tasks/Calendar/Routines/Money/Goals/Weekly Review. Building that
  would have both resurrected scope this file explicitly retired (the
  "budgeting only" pivot, "Product scope" above) and reversed the
  single-screen layout removed at the user's own explicit request in an
  earlier session (`src/ui/shell.js` no longer builds a `<nav>`). The user
  chose **no rail at all** — just a small "Money" brand mark in the new
  header bar (`src/ui/components/header-bar.js`). This app still has
  exactly one screen; nothing was un-retired.
- **Theme.** The app already defaulted to the light cream/green palette
  (`:root` in `src/styles/base.css`) — dark only ever appeared via the OS's
  `prefers-color-scheme`, with no in-app control, and `settings.theme`
  existed in the schema but nothing read or wrote it. The user chose to
  both add a real toggle **and** soften the existing dark palette (lower
  saturation/contrast, softer shadows) to match the "calm, not intense"
  principle in both modes, not just the light default.

What shipped, file by file:
- **Theme**: `src/modules/settings/{actions,reducer,selectors,index}.js`
  gained `setThemeAction`/`getTheme` (no schema version bump — the field
  already existed and already defaulted to `'system'`; this only wires up
  a previously-inert field, same category of change as the Safety Buffer
  precedent above, just in reverse). `src/styles/base.css`'s dark tokens
  now apply two ways — `@media (prefers-color-scheme: dark) { :root:not
  ([data-theme="light"]) { ... } }` for the OS-driven default, and an
  identical `:root[data-theme="dark"] { ... }` block for an explicit
  choice, so an explicit choice always wins over the OS — **superseded
  below**: the attribute-based mechanism this paragraph describes was
  later replaced with a class (`.theme-light`/`.theme-dark`) instead, at
  explicit request; the surrounding logic (explicit-always-wins-over-OS)
  is unchanged, only the selector mechanics are. `src/ui/shell.js`
  sets/removes `data-theme` on `<html>` every render. New
  `src/ui/components/theme-toggle.js` (a sun/moon icon button, added to
  `icons.js`'s `ICON_PATHS`) in the new header bar.
- **Global period selector**: new `src/ui/components/period-selector.js`
  (an icon-button-triggered anchored dropdown — This week/This month/Last
  month/All time/Custom range — using the same sibling scrim+panel
  close-on-outside-click pattern as `popup.js`, just transparent/anchored
  instead of a centered dark backdrop, so it needs no raw `document`-level
  listener). Its selected value lives as module-level state in
  `src/ui/screens/dashboard.js` (ephemeral, not persisted — same
  convention as every other UI toggle in this app; defaults to "This
  month" on load) and is threaded down as an explicit `{period, from, to}`
  prop to every card that needs it, not a cross-imported singleton.
  **Safe-to-Spend and Current Balance deliberately never receive it** —
  both stayed exactly as before, always "right now" snapshots.
- **New pure logic for "This Period"**:
  `src/modules/safe-to-spend/recurrence.js` gained
  `getIncomeOccurrencesInRange` (every scheduled income occurrence
  landing in a date range) and `src/modules/dashboard/index.js` gained
  `getPeriodSummary` (money in/out/bills-due for a range, composing that
  plus `getExpensesForPeriod`). **A real, documented data-model
  limitation**: Incomes/Bills aren't logged transaction history, only a
  forward-looking schedule, so occurrences can never be resolved before
  "today" — `getPeriodSummary`'s `moneyInCents` is `null` (rendered as
  "—", not $0) for any period with no concrete end date ("All time," or a
  custom range missing "to") — **superseded below**, this rendered as
  broken/uncounted rather than intentional and was changed to a real
  projected figure — and both money-in and the bills-due count
  are accurate for "This week"/"This month" (which include today) but
  correctly return nothing extra for a period entirely in the past
  ("Last month," or a wholly-past custom range) rather than fabricate a
  number. Money out (`Expenses`, real logged history) has no such gap.
- **Layout**: Current Balance's standalone card is gone — folded into the
  hero as a `Current balance: $X` subtitle with a small pencil `iconButton`
  that opens the same edit form in a popup
  (`src/ui/components/safe-to-spend-hero.js`) — **superseded further
  below**: Current Balance later got its own standalone card back, in the
  side column, at explicit request. The "Breakdown" card
  (`money-breakdown.js`) is deleted outright — its figures were redundant
  with the hero/breakdown-adjacent cards. Quick Actions
  (`quick-actions.js`) is also deleted — Add Bill moved into "Bills due
  soon"'s header as a small "+ Add bill" `.link-button`
  (`src/ui/components/bills-due-soon.js`), Add Income moved into "This
  Period"'s header the same way (`period-summary.js` at the time —
  **superseded**: Add Income now lives on the "Upcoming income" card
  instead, see below); Add Expense stays the hero's own primary CTA. The
  Categories card
  (`src/ui/components/category-budgets-section.js`, new) is a
  **restoration**, not new scope — Phase 6/7's Category Budgets module
  (`src/modules/category-budgets/`) was never deleted, only its earlier
  dashboard UI was, at the user's own prior request; this rebuilds that UI
  (mini progress bars, `categoryEmojiBadge`, an "Edit categories" popup
  with the existing create/update/delete actions) on the still-intact
  module. Right-column cards (This Period, Bills due soon, Savings) got a
  new `.card--quiet` modifier (smaller heading, no shadow) so the page
  reads as primary (hero, Categories, Expenses) vs. secondary at a glance,
  per the "too many cards with equal weight" complaint that started this
  redesign. **Deviation from the request worth flagging**: the user's
  layout sketch didn't list the Expenses list anywhere in either column;
  since "preserve all existing functionality" (viewing/editing/deleting
  individual logged expenses, not just adding one) was an explicit
  constraint, it was kept, in the main column below Categories, now
  reading the global period instead of its own per-card filter.
- `docs/ARCHITECTURE.md` and `docs/DATA-MODEL.md` updated in the same
  change (settings/dashboard module descriptions, `theme` no longer
  documented as inert).

**Income now automatically updates Current Balance — but only on manual
confirmation, at the user's explicit choice between two options presented
via `AskUserQuestion`.** `docs/DATA-MODEL.md` §3a's Current Balance model
was, until this point, formally documented as excluding Income entirely
("Income receipt isn't tracked as a transaction"); the option *not* chosen
(silently crediting the balance the moment an income's `nextDate` passes)
was flagged as the thing that documented decision was specifically written
to avoid — a scheduled date passing doesn't mean the money actually
landed, and Current Balance is the one number this app treats as ground
truth. What shipped mirrors Bills' "Mark paid" pattern instead:
- New `src/ui/components/upcoming-income.js` — a "Bills due soon"-shaped
  card (nearest 3 not-yet-received incomes, soonest first, a "Mark
  received" button per row) — Income had no list/view UI at all before
  this, only an add-form. Also now owns "+ Add income" (moved off "This
  Period"/`period-summary.js`, which goes back to being a pure read-only
  summary with no actions of its own).
- `src/modules/incomes/actions.js`/`reducer.js` gained
  `markIncomeReceivedAction`/`incomes/mark-received` — not a simple field
  toggle: a **one-time** income becomes permanently `received: true`
  (mirroring Bills' `paid`); a **recurring** income instead advances
  `nextDate` to its next cycle (via new `src/core/date.js`
  `advanceByFrequency`), so it's never permanently "stuck" as received —
  it becomes upcoming again for its new cycle automatically.
- New `src/modules/incomes/balance-effect.js` (`computeIncomeBalanceDelta`)
  + a new `incomes/mark-received` special case in `src/main.js`'s
  `rootReducer`, mirroring `expenses/balance-effect.js`'s existing
  cross-slice pattern exactly (see `docs/ARCHITECTURE.md`) but credits
  instead of debits, and **only** for this one action — ordinary
  create/update/delete/toggle-active on an Income still never touches the
  balance.
- **Deliberately narrower than Expenses, by design, not by omission**:
  editing or deleting an income already marked received does not
  retroactively adjust the balance (a recurring income doesn't even keep a
  durable "received" marker once its date has rolled forward). This
  matches Bills' `paid` flag already having no balance-linkage at all, and
  keeps this a "confirm the event, credit once" feature rather than a
  full received-transaction ledger — consistent with `docs/PRODUCT.md`
  §5's "not a full accounting/double-entry bookkeeping system" non-goal.
- No schema version bump: the new `received` field on Income is additive
  and `undefined` already behaves as `false` everywhere it's read — same
  "leave existing data inert" reasoning as prior additive-field changes
  this file documents.
- `docs/DATA-MODEL.md` §3a and the Income entity shape, and
  `docs/SAFE-TO-SPEND.md` §3 (a clarifying note that this *is* what "income
  doesn't count until it arrives" was always meant to produce once
  confirmed, not an exception to it), updated in the same change.

**Found and fixed a real bug: any popup form submission left scroll
permanently locked.** Reported by the user as "the screen is frozen,
can't scroll" right after using "Mark received" — that action doesn't
open a popup at all, so the actual cause was whichever popup form they'd
submitted just before it. `src/ui/components/popup.js`'s scroll-lock used
to capture "the overflow value to restore" in a closure at open time and
restore it in its own internal `close` — but every caller's form
`onSubmit` (Add Expense, Add Bill, Add Income, Edit current balance, the
category-budget form) calls the *caller's own* local `close()` directly
(`onSubmit: (input) => { dispatch(...); close(); }`), never popup.js's
internal one — so `document.body.style.overflow` never got restored on
that path, only on backdrop-click/Escape/the header's X button. **Fixed**
by removing lock/restore bookkeeping from `popup.js` entirely and instead
deriving `document.body.style.overflow` fresh on every render, in
`src/ui/shell.js`'s `render()`, from whether a `.modal-backdrop` is
actually present in the freshly-built tree (`main.querySelector
('.modal-backdrop') ? 'hidden' : ''`). Since every dispatch already
triggers this render regardless of which of the several ways a popup can
close, this self-corrects every time instead of depending on every
closing path remembering to restore it. Verified via the usual DOM-shim
smoke test: opening a popup, submitting its form (the previously-broken
path), and reopening then closing via the X button and via a backdrop
click (the previously-working paths, to confirm no regression) all now
correctly toggle `overflow` between `'hidden'` and `''`. Consistent with
`docs/TEST-PLAN.md`'s "DOM/UI testing stays manual" policy, this fix
verification isn't a new permanent automated test — the same shim-based
check used throughout this session, then discarded.

**The Savings card now accumulates instead of replacing**, at the user's
request. `src/modules/budget/{actions,reducer,index}.js` gained
`addToSavingsAction` (`'budget/add-to-savings'`) — adds its amount to the
existing `savingsAllocationCents` (rejecting negative/non-integer/$0
amounts, and treating a corrupted stored value as 0 rather than
NaN-poisoning the total, same defensive pattern used throughout this
codebase). `setSavingsAllocationAction` (absolute replace) still exists
unchanged — onboarding's initial savings-target step
(`src/ui/screens/onboarding.js`) still uses it, since there's nothing yet
to add to there; only the dashboard's Savings card switched.
`src/ui/components/single-value-section.js` gained an `additive` option
(the field starts blank — "how much to add," not "what's the new total" —
and copy/button text read "Add"/"Added $X" instead of "Save"/"Saved");
it's currently only used by Savings, so this only changed that one card's
behavior. `docs/DATA-MODEL.md`'s Budget entity section updated in the
same change.

**The Savings card gained a way to correct the total directly, not just
add to it** — a small pencil `iconButton` next to "Currently saved: $X"
(`single-value-section.js`'s new `onEditTotal` option, only meaningful
alongside `additive`) opens a popup (reusing `popup.js`, same pattern as
the hero's Current Balance edit) prefilled with the current total; saving
it dispatches the pre-existing, unchanged `setSavingsAllocationAction`
(an absolute replace) instead of `addToSavingsAction`. The card's own
primary form still only adds — this is a separate, explicitly-labeled
"replaces the total directly, not a regular contribution" path for fixing
a mistake or reconciling against a real account. `docs/DATA-MODEL.md`
updated in the same change.

**The Categories card's "Edit categories" form can now pick an existing
category instead of retyping it, and still add a brand-new one** — both
halves of the same request, satisfied by one change. New
`getKnownCategories(state)` (`src/modules/expenses/selectors.js`) unions
`DEFAULT_EXPENSE_CATEGORIES` with every distinct category already used by
a logged Expense *or* an existing CategoryBudget (reading
`state.categoryBudgets` directly as raw data, the same "read another
slice's raw data for a simple aggregate" precedent
`category-budgets/selectors.js` already used in the other direction, so
neither module formally imports the other). This is now the single shared
`<datalist>` source for **both** the Expense form's category field
(`expenses-section.js`, previously just the 8 hardcoded defaults) and the
CategoryBudget form's category field (`category-budgets-section.js`,
previously a bare free-text input with *no* suggestions at all) — category
stays free text everywhere (no locked enum, no new persisted "list of
categories"), so typing a new name into *either* form makes it a known
suggestion in *both*, immediately, since the list is derived fresh from
`state` on every render. Required threading `state` down into
`renderExpenseForm` (both its callers — the hero's popup and the
Expenses section's inline edit — and `renderSafeToSpendHero` itself,
which didn't receive `state` before this) and into
`renderCategoryBudgetForm`. Verified through the real store/UI, not just
the selector in isolation: created an expense under a custom category and
a category budget under a different custom category, confirmed both
showed up as suggestions in *both* forms, then typed a third brand-new
category into the CategoryBudget form and confirmed it immediately
appeared as a suggestion back in the Expense form. `docs/DATA-MODEL.md`
updated in the same change.

**Found and fixed a real bug, reported by the user: marking a bill paid
made Safe-to-Spend go *up*.** `sumCommittedBills`
(`src/modules/safe-to-spend/calculation.js`) excludes paid bills from
`upcomingBillsCents` by design — `docs/SAFE-TO-SPEND.md` §7 always
documented the presumption that "the money has already left the account
(and Current Balance has already been updated to reflect that)," but
until now nothing actually implemented that second half: marking a bill
paid only stopped it being subtracted as "committed," it never debited
`currentBalanceCents` — so the amount looked like it "came back." Bills
was the one balance-affecting entity of the three (Expenses, Income,
Bills) that hadn't gotten this treatment yet. **Fixed** by adding the
exact same cross-slice pattern as Expenses/Income: new
`src/modules/bills/balance-effect.js` (`computeBillBalanceDelta`) — marks
paid → debits the balance by the bill's amount; toggles back to unpaid →
refunds it — wired into `src/main.js`'s `rootReducer` as a new special
case matching on `action.type === 'bills/toggle' && action.field ===
'paid'` specifically (not the *other* `bills/toggle` use,
`toggleBillActiveAction`'s `field: 'active'`, which still has no balance
effect — deactivating a bill isn't the same claim as having paid it). No
UI or reducer changes needed beyond that — `toggleBillPaidAction`
already existed and already flipped `paid` correctly; only the balance
side was missing. Same scoping limitation as Income, stated explicitly
here rather than silently: editing/deleting an already-paid bill doesn't
retroactively adjust the balance, and marking a bill paid *and* logging a
matching Expense both would double-deduct — Bills and Expenses aren't
linked. Verified end-to-end through the real store and the actual "Mark
paid" button: Safe-to-Spend now stays exactly unchanged when a bill is
marked paid (the amount moves from "committed" to "already spent" instead
of vanishing from the subtraction entirely), Current Balance visibly
absorbs the payment, and un-marking a bill refunds both correctly.
`docs/DATA-MODEL.md` §3a and `docs/SAFE-TO-SPEND.md` §7 updated in the
same change to state that the presumption is now actually enforced, not
just documented.

**"Bills due soon" gained full bill management**, at the user's request
("add a card that tracks bills") — clarified via `AskUserQuestion` into
the option that mirrors the Categories card's "Edit categories" popup
exactly, rather than a second, separate card or a plain uncapped list.
Its compact "nearest 3 unpaid, one-tap Mark paid" list is unchanged; a new
"Manage bills" link (replacing "+ Add bill," which is now folded into
this popup instead of being its own separate entry point) opens a popup
showing **every** bill — paid and unpaid, not just the nearest few — each
row with its amount/recurrence/due date/paid-status, a Mark paid/unpaid
toggle, an edit pencil (reusing the existing `renderBillForm`, which
already supported an edit mode — no new form logic needed), and a delete
trash icon reusing the existing `deleteBillAction`. `src/ui/components/
bills-due-soon.js` now imports `updateBillAction`/`deleteBillAction`/
`getAllBills` alongside what it already had. This full CRUD capability
had existed once before this session, under the retired standalone
"Upcoming Bills" section, and was removed at the user's own earlier
request along with Income/Planned Expenses/Category Budgets' equivalents
— restoring it here (like Savings' edit-total and Categories' own manage
popup before it) doesn't reverse that removal, it rebuilds the capability
in the new, consolidated-card shape instead of resurrecting the old
standalone section. Verified end-to-end through the real store and UI:
the compact list still caps at 3 while "Manage bills" shows all of them
uncapped; marking a bill paid *from inside the popup* correctly debits
the balance (the fix from immediately before this) and the bill
simultaneously drops off the compact list while staying visible (now
"Paid," offering "Mark unpaid") in the full one; delete removes it from
both. Two top-level `let`s (`manageOpen`/`editingId`) had to be renamed
to `billsManageOpen`/`editingBillId` — this bundler concatenates every
module into one scope, and `category-budgets-section.js` already
declared those same names; caught by `build.test.js`, not by `build/
build.js`'s own collision check, which only inspects function
declarations, not `let`/`const` — worth remembering next time a new
popup-owning component reuses this same transient-state naming
convention.

**"Money in" now shows a real number for "All time" instead of "—" —
superseded below**, the "next scheduled occurrence" projection this
paragraph describes was itself replaced a message later with a real
received-income history, once the user clarified "All time" should count
only *received* income, not upcoming/projected income either. Kept here
for the record of what was tried first and why.

The original design (above) rendered `null`/"—" for any unbounded period,
reasoning that summing literally every future paycheck forever isn't a
meaningful number — technically true, but the user reported it as "is not
counted," i.e. it read as broken, not as an intentional "not applicable"
state. Resolved via `AskUserQuestion` into the option that keeps the
"can't sum forever" constraint honest while still showing something
useful: `getPeriodSummary` (`src/modules/dashboard/index.js`) now
projects — for an unbounded range, `moneyInCents` sums each **active**
income's *next* scheduled occurrence only (one per income, via the
existing `getNextIncomeDate`, not every future one via
`getIncomeOccurrencesInRange`), still respecting a custom range's "from"
date if one is given, and excluding an income with no upcoming occurrence
at all (e.g. a past one-time income). A new `moneyInIsProjected: boolean`
on the same return value lets `src/ui/components/period-summary.js` label
the row **"Next income"** instead of **"Money in"** whenever this
fallback is used, so it reads as "what's coming up" rather than falsely
implying a real period total exists. `moneyInCents` is no longer nullable
at all — every period now returns a real number, either a period total or
this projection.

**"All time" Money in now sums real received income, not projected
income — schemaVersion bumped to 6** (**superseded further below**: the
receipts-based approach this paragraph describes was later extended to
*every* period, not just "All time," plus a Bill-side counterpart for
"Money out" — this paragraph is kept for the record of the intermediate
step). The user corrected the fix above:
"All time" should count only *received* incomes, not upcoming/next ones
either. The real obstacle was a genuine data-model gap surfaced via
`AskUserQuestion`: a one-time income does get a durable `received: true`
flag once confirmed, but a *recurring* income doesn't — confirming one
only advances `nextDate` and credits the balance once, with nothing left
behind recording that a given cycle happened. So "count received income"
had no complete answer without a real history. The user picked building
one over the smaller, partial fix (counting only one-time
`received:true` incomes, which would silently miss every recurring
paycheck — the common case). What shipped:
- **New `src/modules/income-receipts/`** (`create-receipt.js` +
  `selectors.js`, no actions/reducer — it's an automatic log, not a
  user-facing CRUD entity): `createIncomeReceipt(income, now)` builds one
  immutable record per confirmation (`docs/DATA-MODEL.md`
  "IncomeReceipt" — `incomeId`, a denormalized `name` so it still
  displays correctly if the Income is later renamed/deleted, `amountCents`,
  `date`, `createdAt`); `getIncomeReceiptsForPeriod`/
  `getIncomeReceiptsTotalCents` mirror `expenses/selectors.js`'s existing
  period-filter/total-sum pattern.
- **Schema version 5 → 6**: `incomeReceipts: []` added to
  `createEmptyState()`, `ARRAY_COLLECTION_KEYS`, and a new
  `migrateV5ToV6` (purely additive, same shape as every prior migration).
- **`src/main.js`'s existing `incomes/mark-received` special case now
  touches three slices, not two**: alongside the existing balance-effect
  debit/credit, it now also reads the confirmed income from
  *`prevIncomes`* (before the mutation — its amount/name don't change,
  but the pre-mutation slice is guaranteed to still contain it) and
  appends a fresh receipt to `incomeReceipts`, all in the same state
  transition. One-time and recurring incomes are treated identically here
  — both log exactly one receipt per confirmation; only the underlying
  `Income` record's own update differs (§3a).
- **`getPeriodSummary` (`src/modules/dashboard/index.js`) now means two
  genuinely different things by "Money in" depending on the period, and
  says so in its own doc comment**: bounded periods (This week/month/
  Last month/a custom range with both dates) still *project* from the
  Income schedule via `getIncomeOccurrencesInRange`, unchanged from
  before — deliberately **not** touched this round, since the user scoped
  this fix to unbounded periods only, calling the "make bounded periods
  receipt-based too" idea out as a separate future ask, not something to
  do now. Unbounded periods (`endDateKey == null` — "All time," or a
  custom range with no "to") now sum real `IncomeReceipts` instead of
  projecting anything, still respecting a custom range's "from" date
  against receipt dates. `moneyInIsProjected` is gone — both branches are
  legitimately "money in" now, so `src/ui/components/
  period-summary.js`'s row label reverted to plain "Money in" always,
  dropping the "Next income" relabeling from the previous, now-superseded
  attempt.
- Verified through the real store and UI, not just unit tests: marked a
  one-time and a recurring income received, confirmed both created
  receipts with correct amounts, confirmed "All time" summed them exactly
  while "This month" stayed on its unchanged schedule-projection value
  (proving the bounded/unbounded split actually holds at runtime, not
  just in the selector's logic).
- `docs/DATA-MODEL.md` (new "IncomeReceipt" entity, root-shape example,
  §7 migration history) and `docs/ARCHITECTURE.md` (new module in the
  tree, the cross-slice-exception paragraph updated to describe the
  Income case as three-way, not two) updated in the same change.

**Onboarding ("Let's set up your budget") is now a step-by-step wizard,
not one long scrollable page** — at the user's request, plus two content
additions to it (a name question, and a frequency picker on the payday
question). `src/ui/screens/onboarding.js`:
- New module-level `currentStep` (transient UI state, same "outside the
  store, resets on reload" convention as every other UI toggle in this
  app — anything already saved on an earlier step stays saved regardless,
  since it's independent of this counter). Each step is its own function
  returning one card; `renderOnboarding` renders exactly one at a time,
  plus a small "Step X of Y" line. Submitting a step's form both saves
  whatever was filled in (unchanged per-field optionality/validation from
  before — a blank field still just means "skip it") **and** advances to
  the next step, via a shared `goNext()` that increments `currentStep`
  and calls `requestRender`. The final "Finish setup" card is unchanged,
  now just the state *after* the last real step rather than a fifth
  section on the same page. "Skip for now" still exits from anywhere.
  **Deliberately no "Back" button** — added complexity (would need either
  prefilling already-answered steps or accepting that Back-then-Continue
  on the payday/bills steps creates a *second* income/bill, since those
  dispatch `create*Action` on submit) for something not asked for; skipped
  rather than guessed at.
- **New first step: "Your name"** — purely for greeting copy, entirely
  optional. `src/modules/settings/{actions,reducer,selectors,index}.js`
  gained `setDisplayNameAction`/`getDisplayName` (trims input; blank
  clears back to `null`, not an empty string) — `settings.displayName`
  existed in the schema from Phase 0 but, like `theme` before its own
  toggle shipped, had nothing that ever actually wrote it until now.
  `src/ui/screens/dashboard.js`'s `greetingText` already read it — this
  is what finally makes "Good morning, {name}." actually happen.
- **The payday step gained a frequency picker** (One-time/Weekly/
  Biweekly/Monthly, `INCOME_FREQUENCIES`, defaulting to Monthly) — before
  this it silently hardcoded `frequency: 'monthly'` regardless of what the
  user actually meant, with no way to say "this is a one-time deposit" or
  "I get paid weekly" during onboarding (only reachable afterward, via
  editing the income). The dropdown's selected value now flows straight
  into `createIncomeAction` instead of a hardcoded literal.
- Verified through the real store and UI end to end, not just unit tests
  on the new settings pieces: stepped through all four questions (name →
  balance/savings → payday incl. picking "Weekly" → bills, skipped via its
  own link since a real `<form>` submit needs `FormData`, which the
  DOM-shim smoke-test harness can't simulate), confirmed each answer
  landed in the store *as that step was submitted* (not held back until
  Finish), confirmed the frequency picker's chosen value was the one
  actually saved, and confirmed the dashboard's greeting read back the
  saved name correctly ("Good afternoon, Alex.") once onboarding finished.
- **A gap worth knowing, not fixed here since it wasn't asked**: once
  created, an onboarding-step income has no in-app way to edit or delete
  it — "Upcoming income" only offers "Mark received"/"+ Add income", never
  an edit-in-place list the way "Manage bills" now does for Bills. A typo
  on the payday step (amount, date, or frequency) currently has no fix
  short of deleting and recreating it a different way, or living with it.
- `docs/DATA-MODEL.md`'s Settings section updated in the same change to
  note `displayName` is now live, not inert.

**A specific, fully-specified color system was applied — new canonical
token names, exact hex values, and a class-based (not attribute-based)
theme switch.** `src/styles/base.css` restructured around 11 canonical
tokens given verbatim (`--bg`, `--surface`, `--border`, `--text-primary`,
`--text-secondary`, `--accent`, `--accent-bg`, `--warning`,
`--warning-bg`, `--danger`, `--progress-track`) rather than changing
values in place under the old `--color-*` names. Every existing
`--color-*` token (~180 usages across `components.css`/`responsive.css`)
is now a plain **alias** of one of these (`--color-bg: var(--bg)`, etc.)
instead of being renamed — avoids a sweeping, error-prone rename across
the whole stylesheet for the same visual result; the 11 tokens above are
now the only thing a future palette change would ever need to touch.
Two values weren't in the given palette and had to be derived, following
the pattern of the ones that were: `--danger-bg` (a background tint for
danger text, matching how `--warning`/`--warning-bg` and
`--accent`/`--accent-bg` already pair up — light `#fbeae3`, dark
`#382920`), and `--color-accent-contrast` (the text color used *on*
accent-colored buttons, kept as the existing white/near-black pairing —
outside the requested token list, and a standard contrast pairing, not
the "dominant canvas" pure-white/black the request's own warning was
about). `--progress-track` is a genuinely new token, not a rename — the
hero and Categories mini progress-bar tracks used to reuse `--color-border`
for their background; now they use the dedicated token instead, matching
the request's palette exactly. Category colors (`--color-cat-*`, 7 fixed
identifying hues, not swapped by theme — see their own comment in
base.css) and shadows (`--shadow-sm`/`--shadow-md`) were outside the given
palette and left untouched.
- **Theme switch is now class-based, not attribute-based** —
  `.theme-dark`/`.theme-light` on `<html>`, toggled by `src/ui/shell.js`,
  replacing the `[data-theme="..."]` attribute mechanism from the
  original toggle build (superseded note left on that paragraph above).
  Same logic otherwise: no class ('system', the default) follows the OS
  via `prefers-color-scheme`; an explicit class always overrides it.
- **Already persisted through `localStorage` — no second write path
  added.** The request asked for "a toggle stored in localStorage"; this
  already happens today, through the same single storage-adapter path
  every other piece of state in this app uses (`docs/ARCHITECTURE.md`) —
  a bespoke, separate `localStorage.setItem('theme', ...)` call would have
  violated CLAUDE.md's own "the storage adapter is the only localStorage
  access point" rule for no benefit, so none was added.
- One apparent tension in the given palette, resolved by using the values
  exactly as given rather than second-guessing them: light `--surface` is
  literally `#FFFFFF` (pure white) even though the same request says
  "never use pure black/white for text/background." Read as intentional —
  `--surface` is a raised card color layered *on top of* the warm
  `--bg`/`--text-primary` pairing, not the dominant canvas those two are;
  a pure-white card against a cream page is a common, deliberate paper-like
  contrast effect, not the flat, characterless pure-white/black canvas the
  instruction reads as warning against. Implemented exactly as specified,
  not altered.
- Verified via the real store/UI (theme toggle click flips exactly one of
  `.theme-dark`/`.theme-light` on `<html>`, never both at once, and the
  choice persists through the store) and by confirming every given hex
  value landed correctly, for both themes, in the actual built bundle —
  not just reasoned about in the source. `docs/ARCHITECTURE.md` and
  `docs/DATA-MODEL.md` updated in the same change to describe the class
  mechanism instead of the attribute one.

**Current Balance got its own standalone card back**, in the side column
directly above "Upcoming income," and was removed from the Safe-to-Spend
hero entirely — reversing the "fold it into the hero as a subtitle"
decision from earlier in this file (superseded note left on that
paragraph), same pattern as Savings' edit-total popup and Bills' "Manage
bills" before it: restoring a capability in a new spot, not undoing the
user's own prior call to simplify. `src/ui/components/
safe-to-spend-hero.js` lost `renderBalanceEditForm`, the `balanceFormOpen`
transient-state flag, the `.hero__balance` subtitle + its edit-popup
entirely, and the now-unused `iconButton`/`setCurrentBalanceAction`/
`parseBalanceToCents`/`centsToDollarString` imports — the hero now only
ever shows the Safe-to-Spend amount, the committed-vs-available progress
bar (which still displays `currentBalanceCents` as "of $Y available," a
different framing than a dedicated balance display, deliberately left
alone), the "+ Add expense" CTA, and the disclaimer. `src/ui/screens/
dashboard.js` gained a `renderSingleValueSection` call for it (the same
shared component Savings already used, here with `additive: false`, the
default — Current Balance is still a checkpoint you set directly, not a
running total you add to) positioned in the side column, immediately
before `renderUpcomingIncome`. No new module code needed — every action/
selector this uses (`getCurrentBalanceCents`, `setCurrentBalanceAction`)
already existed. `.hero__balance`'s now-dead CSS removed from
`components.css`. Verified through the real store/UI: the hero no longer
mentions Current Balance at all; the new card shows the right starting
value and correctly accepts a negative one (`allowNegative: true`,
unchanged from before); editing it there immediately updates the
Safe-to-Spend hero's own amount, confirming the two stayed correctly
wired to the same underlying value despite living in different cards now;
and the side column's actual render order was confirmed card-by-card,
not just assumed from the source, landing Current Balance directly above
Upcoming income as asked.

**Onboarding: centered layout, savings no longer double-subtracted from
the reported balance, and both the payday and bills steps now accept
multiple entries.** Three separate asks in one request, all scoped to
`src/ui/screens/onboarding.js`:
- **Centered, single-question layout**: new `.screen--onboarding` CSS
  (`components.css`) — `display: flex; flex-direction: column;
  align-items: center; justify-content: center; min-height: 100vh` (with
  a `100dvh` upgrade layered on top for browsers that support it, more
  accurate on mobile where the address bar resizes the viewport), plus a
  `max-width: 480px` cap on the header and whichever step card is
  showing. `min-height` is a floor, not a hard clamp — a step long enough
  to exceed the viewport still scrolls normally, it just doesn't force a
  scroll when it easily fits. `.onboarding-header` also gained
  `text-align: center`; card *content* (labels, inputs) stays left-aligned
  as before — only the page-level centering changed.
- **Savings no longer subtracted twice during setup** — see
  `docs/DATA-MODEL.md` §3a's new paragraph for the full reasoning (a
  deliberate, documented exception scoped to this one onboarding step,
  not a change to how Current Balance/Savings relate anywhere else in the
  app): when both fields in "Current balance & savings" are filled in,
  the stored balance becomes their *sum*, so Safe-to-Spend nets back to
  exactly the figure the user typed as their balance, not that figure
  minus their own reported savings again. A hint line under the form
  spells this out in plain language. Verified precisely: entered $1000
  balance + $200 savings → stored balance $1200, stored savings $200,
  Safe-to-Spend computed $1000 — the entered figure exactly, confirming
  the math cancels out as intended, not just that it compiles.
- **Both the payday and bills steps now support adding more than one** —
  submitting either form no longer auto-advances to the next step; it
  adds the record, re-renders to show a running "added so far" list (new
  `addedItemsList` helper — bare `.money-item` markup, no actions, reusing
  existing CSS classes rather than a new list component), and resets for
  another entry. A separate "Continue" button (styled as a real secondary
  button once at least one item exists, or as the softer skip-styled
  `.link-button` when the list is still empty) moves on whenever the user
  is done. The payday step also gained a **Name** field (previously
  hardcoded to `'Paycheck'` unconditionally) — defaults to "Paycheck" for
  the first entry so a single-income user types nothing extra, blank
  thereafter so a second/third entry (e.g. "Side gig") doesn't default to
  a duplicate, colliding name. This was necessary, not just nice-to-have,
  for the multi-income ask to make sense at all — two unlabeled
  "Paycheck" entries would be indistinguishable in the list and later in
  "Upcoming income." Bills didn't need an equivalent change — `Bill`
  already required a name. Verified through the real store/UI: added a
  second income with a custom name without losing the first, confirmed
  the step doesn't advance on its own after either add (only "Continue"
  does), and confirmed the added-so-far list displays both entries
  correctly for income (name, amount, frequency) — bills' own list was
  verified the same way, though its actual form submission couldn't be
  driven through the DOM-shim smoke-test harness (it depends on
  `FormData`, same limitation noted for other `FormData`-based forms
  earlier in this file), so that one path was exercised via direct
  dispatch instead, matching what the form's own `onSubmit` already does.

**"Skip for now" no longer shows on onboarding's finish screen** — it's
redundant there specifically, since "Finish setup" already dispatches the
identical `completeOnboardingAction`; still shown on every question step
as before, where it's the only way to exit early. One conditional in
`renderOnboarding` (`onLastStep ? null : el('button', ...)`), no other
changes.

**"This Period" now means exactly what its two figures claim, for every
period, not just "All time" — schemaVersion bumped to 7.** Two related
asks: "Money in" should never count an Income that's merely upcoming, not
yet received; "Money out" should never count a Bill's amount unless it's
marked paid. The first was already half-true (receipts-based "All time"
from the previous change) but **This week/This month/Last month/a custom
range with both dates still projected** from each income's
`nextDate`/`frequency` (`getIncomeOccurrencesInRange`) rather than reading
confirmed receipts — an amount could show as "Money in" for a paycheck
that hadn't arrived yet, as long as it was *scheduled* to land within the
selected window. The second was true for zero periods — "Money out" only
ever summed `Expense`s; a paid Bill never contributed to it at all, only
`Expense`s did, regardless of how period-scoped "Money out" claimed to be.
- **`getPeriodSummary` (`src/modules/dashboard/index.js`) now reads real,
  dated historical logs for both figures, uniformly, for any period** —
  the whole bounded/unbounded special-casing this function used to need
  is gone. "Money in" = `IncomeReceipt`s in range (unchanged from the
  "All time" version, now applied everywhere). "Money out" = `Expense`s
  in range **plus** a new `BillPayment` log in range (docs/DATA-MODEL.md
  "BillPayment", mirroring `IncomeReceipt`'s shape/reasoning exactly —
  `src/modules/bill-payments/`). `getIncomeOccurrencesInRange` is no
  longer called by anything, but kept (still fully tested), doc-commented
  as available for a future, distinctly-labeled "projected income" view
  if one's ever wanted — not deleted just because it's currently unused.
- **New three-way cross-slice effect, mirroring Income's exactly**:
  `src/main.js`'s existing `bills/toggle` + `field: 'paid'` special case
  now also creates a `BillPayment` on "Mark paid" and **removes the most
  recent one for that bill** on "Mark unpaid" — Bills, unlike Income, have
  a real un-confirm action (`paid` toggles both ways), so the log has to
  stay a true reflection of what's currently recorded as paid, not
  accumulate reversed mistakes. A bill cycling paid → unpaid → paid again
  correctly ends up with one live payment record, not two.
- Verified through the real store and UI, not just the selectors in
  isolation: created a scheduled-but-unreceived income and a due-but-unpaid
  bill, confirmed "This month" showed $0 for both "Money in" and "Money
  out" even though both fell within the selected window; marked both
  received/paid and confirmed the figures updated to the real amounts;
  confirmed "All time" showed the same totals (no double-counting, no
  scheduled-only leakage); and confirmed `billPayments`/`incomeReceipts`
  each had exactly one entry. `docs/DATA-MODEL.md` (new "BillPayment"
  entity, root-shape example, §7 migration history, the "three specific,
  deliberate automatic effects" paragraph reworded now that a real, if
  narrow, received/paid history *does* exist) and `docs/ARCHITECTURE.md`
  (new module in the tree, the cross-slice-exception paragraph now
  describing both Income and Bills as three-way) updated in the same
  change.

**Bills no longer reduce Safe-to-Spend until marked paid — a formula
change, not a display fix, made at the user's explicit request after
confirming via `AskUserQuestion` that this really was meant to change the
core number (not just a card, or the already-separate "This Period"
money-out figure fixed in the paragraph above this one).** Previously,
`getSafeToSpend` subtracted every active, unpaid bill due on or before
the payday horizon as a committed term (§2 of the version of
`docs/SAFE-TO-SPEND.md` that predates this change) — the same treatment
Planned Expenses still get. Now bills contribute **nothing** to
`safeToSpendCents`/`totalCommittedCents` while unpaid, regardless of due
date; the only thing that ever reduces Safe-to-Spend because of a bill is
`toggleBillPaidAction` ("Mark paid"), which — unchanged — debits Current
Balance by the bill's amount, flowing into `safeToSpendCents` the same
way any other dollar in that checkpoint does. This makes Bills symmetric
with Income (`docs/SAFE-TO-SPEND.md` §3): informational until a real,
dated, user-confirmed event happens, never subtracted on the strength of
a schedule alone.
- `src/modules/safe-to-spend/calculation.js`: the bill-summing helper
  (renamed `sumCommittedBills` → `sumUpcomingBills`) is unchanged in what
  it computes, but its result (`upcomingBillsCents`) is no longer folded
  into `totalCommittedCents` — it's returned purely for display, the same
  treatment `upcomingIncomeCents` already had. No UI currently renders it
  (verified by grep) — same "leave it available, don't delete it" call as
  `getIncomeOccurrencesInRange` earlier in this file.
- No schema change — this is pure arithmetic, no stored shape changed.
- `docs/SAFE-TO-SPEND.md` §2 rewritten (the formula itself, and the
  reasoning for the change); §7 (paid-bill handling) kept as a marked
  "superseded design" section explaining the real bug it originally fixed
  under the old formula, plus what still applies (the balance debit
  mechanism) and what doesn't (there's no longer an earlier subtraction
  for it to "cancel out"); §11b and §13 updated to drop bills from
  `totalCommittedCents`'s composition. `docs/DATA-MODEL.md` §3a's
  bill-paid paragraph and `src/modules/bills/balance-effect.js`'s header
  comment rewritten the same way. `docs/PRODUCT.md` §6's illustrative
  example redrawn (bills moved off the subtracted list, shown as a
  separate "for awareness" line) since it's directly cross-checked by
  `tests/unit/safe-to-spend.test.js`.
- Every test that baked the old "bills subtract immediately" behavior
  into its expected numbers was found and rewritten, not left red:
  `tests/unit/safe-to-spend.test.js` (bills-only, multiple-bills,
  recurring-bills, and — since bills could no longer stand in for "a
  commitment that subtracts" — the negative/zero/decimal-precision
  sections were switched to use Planned Expenses instead, which still
  subtract unconditionally, to keep exercising the same
  negative-result/zero-result/cent-precision contract those sections are
  actually about), `tests/unit/dashboard-integration.test.js` (the "adding
  a bill reduces the result" test inverted to "does NOT reduce," the
  "marking paid does NOT change Safe-to-Spend" regression test inverted to
  its new-correct opposite — marking paid now *does* reduce it, since
  that's the first time it counts at all), and `tests/unit/
  qa-user-flows.test.js` (FLOW A/C/D). 446/446 pass after the rewrite.

**Dashboard: the phone layout now shows Current Balance and This Period
directly after the Safe-to-Spend hero, and a real spacing bug between
cards is fixed — both reported directly by the user from a screenshot —
superseded below.** This paragraph's own fix (the flat single-CSS-Grid
design it describes) turned out to introduce a different real bug, also
reported directly by the user from a screenshot, fixed in the entry right
after this one — the flat-grid mechanism this paragraph describes is no
longer what's in the codebase, only the mobile *ordering* result it
achieved (hero → balance → this period → categories → expenses → ...)
still holds.
Root cause of both: `src/ui/screens/dashboard.js` used to build two fixed
wrapper `<div>`s (`.dashboard-grid__main`, `.dashboard-grid__side`) — a
"main" column (Hero, Categories, Expenses) and a "side" column (This
Period, Current Balance, Upcoming Income, Bills, Savings, the privacy
note) — laid out side-by-side only at desktop width (`src/styles/
responsive.css`'s `1024px` breakpoint); below that width there was no
grid at all, so the two divs just stacked as plain blocks in DOM order —
main column *in full*, then side column *in full*. That buried Current
Balance and This Period under Categories/Expenses on a phone, and
separately, `.card:last-child { margin-bottom: 0 }` zeroed the bottom
margin of whichever card happened to be the literal last child of the
*main-column wrapper* (Expenses) — collapsing the gap before This Period
to nothing, even though they're unrelated cards, purely because of which
wrapper div Expenses happened to be inside.
- **Fixed by flattening to one CSS Grid** with every card as a direct
  grid item (`gridItem(slot, node)` in `dashboard.js`, tagging each with
  `dashboard-grid__item--{slot}`), instead of two fixed wrapper divs.
  Spacing now comes from the grid's own `gap` (`src/styles/
  components.css`'s new base `.dashboard-grid` rule, always active, not
  desktop-only) with `.dashboard-grid .card { margin-bottom: 0; }`
  neutralizing the old per-card margin inside this grid specifically — so
  the gap is uniform and can never collapse the way the old
  `:last-child` rule could.
- **Ordering is now explicit CSS `order` per breakpoint, not implied by
  DOM position** — `components.css`'s base (mobile-first, always active)
  rule sets the priority order the user asked for: hero → balance →
  period → categories → expenses → income → bills → savings → privacy.
  `responsive.css`'s existing `1024px` breakpoint overrides `order` (and
  assigns `grid-column: 1` vs `2`) back to the original desktop grouping
  — main column Hero/Categories/Expenses, side column This
  Period/Balance/Income/Bills/Savings/Privacy — which is **unchanged from
  before this fix**; only mobile's order actually changed, per what was
  asked.
- No logic touched, no new tests needed (446/446 already-passing tests
  confirm nothing else moved) — verified instead by inspecting the actual
  compiled `dist/index.html`'s `<style>` block (grepped for both the
  mobile-order rules and the desktop override, confirmed both compiled
  correctly with no minification to obscure them) and confirming all nine
  `dashboard-grid__item--*` classes render in the bundle.

**Found and fixed a real follow-on layout bug in the fix directly above,
reported directly by the user from a screenshot: at desktop width, the
side column (This period, Current balance, ...) had large, uneven empty
gaps between cards.** Root cause: the flat single-CSS-Grid design the
previous entry introduced made every card a *direct* grid item, pinning
only its column explicitly and leaving its row to auto-placement — which
packs items row by row **across both columns**, so a row's height is
forced to fit whichever column's card lands in it is tallest. Pairing the
tall Hero card into the same row as the much shorter "This period" card
left "This period" stranded with a large empty gap below it before the
next row (Current balance) could start, and the same thing compounded
down the rest of the side column. **Fixed** by wrapping each column's
cards in their own `.dashboard-grid__col` container
(`src/ui/screens/dashboard.js`'s `mainColumn`/`sideColumn`) — at desktop
width (`src/styles/responsive.css`) each is a real, independent flex
column (`display: flex; flex-direction: column`), so one column's card
heights can never distort the other's spacing; `.dashboard-grid` itself
just places the two columns side by side. On mobile
(`src/styles/components.css`), `.dashboard-grid__col` is `display:
contents` instead — it removes its own box, promoting its children back
to direct flex items of `.dashboard-grid`, so the flat mobile `order`
sequence from the previous entry (hero → balance → this period → ... )
is completely unaffected; only the desktop mechanism changed. No
calculation logic touched (446/446 tests still pass unchanged) — verified
for real, not just reasoned about: built the bundle and loaded it in an
actual headless browser (Playwright, installed temporarily for
verification only — not added as a project dependency) at both 1400px
and 390px with realistic seeded data, confirming tight/uniform spacing at
desktop and the correct mobile order, before and after screenshots
compared directly.

**Added "Brain Dump" quick-capture, at the user's request — but only
after a real scope conflict was flagged and resolved via
`AskUserQuestion` before any code was written.** The request (a
persistent header button, a global "N" shortcut, a single-field popup
that saves instantly and stays open, and a persistent "Inbox" of
free-text notes with "Convert to expense"/dismiss actions) is, read
literally, general note/task capture — `docs/PRODUCT.md` §5 explicitly
rules out "task capture/completion as a standalone feature," and this
file's own "Product scope" section says the same. The user chose to keep
the exact requested UX but resolve the conflict by **scoping every
captured item to money**: what's stored is an `ExpenseDraft`
(`docs/DATA-MODEL.md`), framed as an *unconfirmed expense stub*, not a
generic note — every one either becomes a real `Expense` via "Convert to
expense" or is dismissed; nothing about a draft's mere existence is ever
read by Safe-to-Spend (same "excluded by construction" treatment as
`CategoryBudget`, `docs/SAFE-TO-SPEND.md` §3b). This is why
`docs/PRODUCT.md` itself needed no edit — the feature doesn't touch its
§5 non-goals or need a new §4 bullet, since it's a faster on-ramp to the
already-listed "Expense Tracking" feature, not a new one standing apart
from it.

What shipped, file by file:
- **New `src/modules/expense-drafts/`** (`actions`/`reducer`/`selectors`/
  `index`, the same shape as every other list-entity module — see
  `src/core/list-entity.js`) — only `create`/`delete` are ever dispatched,
  a draft is never edited in place. `schemaVersion` bumped 7 → 8
  (`expenseDrafts: []`, purely additive, same shape as every prior
  migration — see `docs/DATA-MODEL.md` §7). Plain generic routing in
  `src/main.js`'s `SLICE_REDUCERS`, **not** a cross-slice special case
  like Expenses/Income/Bills — creating or deleting a draft never touches
  `budget.currentBalanceCents` on its own.
- **New `src/ui/components/brain-dump.js`** — the persistent "+ Brain
  dump" header button (`src/ui/components/header-bar.js`) and its capture
  popup. The popup's "stays open, clears, for the next thought" behavior
  needed no bespoke logic: `dispatch` already triggers a full synchronous
  re-render (`src/core/store.js`), which rebuilds the popup from scratch
  with a fresh empty input — the existing `renderPopup`'s own
  `requestAnimationFrame(focusFirstField)` refocuses it automatically, the
  same mechanism every other popup already relies on to focus on open.
- **The global "N" shortcut lives in `src/ui/shell.js`**, attached once at
  mount time (not inside `render()`, which reruns on every store change —
  attaching there would pile up a new listener each time) — guarded
  against hijacking real typing (any focused `<input>`/`<textarea>`/
  `<select>`/`contenteditable`), against modifier keys (Cmd/Ctrl/Alt+N),
  and against firing during onboarding, which has no header bar for the
  popup to visually belong to.
- **New `src/ui/components/inbox-section.js`** — the Inbox card, below
  Expenses per the request, most-recent-first
  (`getExpenseDraftsSortedByRecent`), each row showing the note text, a
  relative timestamp, "Convert to expense," and a dismiss icon (confirmed
  via `window.confirm`, matching every other delete action in this app —
  Expense/Bill/CategoryBudget deletes all confirm the same way). "Convert
  to expense" reuses the real Add Expense form
  (`expenses-section.js`'s `renderExpenseForm`, unmodified in its
  existing behavior) via a new, additive `initialDescription` option that
  prefills and force-expands the Description field without flipping the
  form into its edit-mode framing (button stays "+ Add expense," no
  Cancel button) — a small, deliberate deviation from a literal reading
  of "pre-fills... then removes it from Inbox": the draft is only removed
  once the resulting Expense is actually **saved**, not the instant
  "Convert to expense" is clicked, so closing that popup without
  submitting (Escape/backdrop/X) leaves the note exactly where it was
  instead of silently losing it.
- **New `formatRelativeTime` in `src/core/date.js`** ("just now"/"2m
  ago"/"3h ago"/"5d ago", falling back to `formatFriendlyDate` past a
  week) — the first relative-past-time formatter in this codebase (every
  existing one, e.g. `upcoming-income.js`'s "Expected in N days," is
  forward-looking).
- Empty state: "Nothing here yet — press N or tap + Brain dump to jot
  something down." — matches the requested low-pressure tone exactly, no
  wording implying falling behind.
- Verified end-to-end through the real store/UI, not just unit tests
  (though 19 new ones were added — `tests/unit/expense-drafts.test.js`,
  a new `schema.test.js` v7→v8 block, `date.test.js`'s
  `formatRelativeTime` block, one `main.test.js` routing check — 465/465
  pass): built the bundle and drove it with a headless browser
  (Playwright, installed temporarily for verification only), confirming
  the header button opens the popup, Enter *and* the Save button both
  capture instantly, the field clears and stays focused for a second
  entry, the "N" shortcut opens the same popup, "Convert to expense"
  actually pre-fills and visibly expands the Description field while
  keeping "+ Add expense" phrasing, submitting it removes the draft *and*
  correctly updates Current Balance/Safe-to-Spend through the existing
  Expense balance effect, and the header button doesn't overflow at a
  375px phone width. Both light and dark themes checked directly, not
  assumed. `docs/DATA-MODEL.md` (new "ExpenseDraft" entity, root-shape
  example, §7 migration history) and `docs/ARCHITECTURE.md` (new module
  in the tree, `shell.js`/`components/` descriptions) updated in the same
  change. Implemented ahead of `docs/ROADMAP.md`'s phase order (Phase 9 is
  Data Backup/Import/Export) at the user's own explicit, detailed request
  for this specific feature — Phase 9 itself remains not started.

**A UX refinement pass on the dashboard's layout/hierarchy — explicitly
scoped by the user as "not a new feature," and it isn't one: no action,
selector, or stored shape changed, only composition/CSS.** Four asks:

- **Unbalanced columns.** Measured against the real app rather than
  guessed (Playwright, temporary, not a project dependency): with a
  realistic dataset the side column (This period/Current balance/Upcoming
  income/Bills due soon/Savings/privacy — 6 cards, several with an
  always-visible form) ran 176px taller than the main column; with little
  data logged yet, the gap was worse — the side column's cards have a
  high floor height regardless of content, while the main column's
  Categories/Expenses/Inbox collapse a lot in their empty states. Fixed
  primarily via the second option the user offered (a layout that doesn't
  depend on the columns matching), not by hand-balancing which cards live
  in which column — that would only drift out of balance again the next
  time either column's content changes. New `src/styles/responsive.css`
  breakpoint at `1280px`: the side column becomes a 2-per-row CSS Grid
  (`.dashboard-grid__col--side`) instead of a single vertical stack,
  roughly halving its height; the privacy note spans both sub-columns
  (it's a text line, not a stat card). `app-main`'s max-width also grows
  a little at this breakpoint so the paired-up cards aren't cramped.
  Re-measured after the fix: the realistic-data gap dropped from 176px to
  25px; the sparse-data gap dropped from an estimated 250px+ to 240px (a
  smaller improvement in absolute terms there, but off a much higher
  base — side column height roughly halved in both cases). Below 1280px,
  the side column stays a single stack (unchanged) — verified at 1024px
  and 1100px specifically, where two real cards (Current Balance,
  Savings) contain a text input + button that a naively-narrower half-a-
  column width would cramp. **A known, accepted trade-off, not fixed**:
  at exactly the new breakpoint's narrower per-card width, a couple of
  two-word headings ("Current balance," "Upcoming income") wrap to two
  lines instead of one — legible, not overlapping or cut off, just not
  as tidy as a single line; judged not worth adding more CSS complexity
  to chase given the actual balance win, and left as noted here rather
  than silently accepted.
- **No at-a-glance summary.** New `src/ui/components/summary-strip.js` —
  a compact row of 4 stat tiles above the hero (Safe to spend, Bills due,
  Days left, Inbox items), styled deliberately lighter than `.card` (no
  shadow, tight padding — see `.summary-tile` in components.css) so it
  reads as a glance strip, not a fifth card competing with the hero right
  below it. **Zero new calculation logic** — every figure was already
  computed elsewhere and simply not surfaced yet: `safeToSpendCents` and
  `daysUntilPayday` from the same `getSafeToSpend` result the hero
  already renders (`daysUntilPayday` existed since Phase 3 but had never
  been shown anywhere in the UI until now), bill count from the same
  `getUpcomingBills` selector "Bills due soon" already uses, Inbox count
  from `getAllExpenseDrafts(state).length`. `auto-fit`/`minmax` wraps the
  strip to 2-across then 1-across on narrower viewports with no manual
  breakpoint needed.
- **Inbox was buried.** Moved from last in the main column (after
  Categories/Expenses) to directly below the hero — one line in
  `src/ui/screens/dashboard.js` moved, both the mobile flat `order`
  sequence (components.css) and the desktop main-column order
  (responsive.css) updated to match. No component changed.
- **Flat visual hierarchy.** Current Balance and Savings
  (`src/ui/components/single-value-section.js`, the one component behind
  both cards) gained the `.card--quiet` class already used by This
  Period/Upcoming Income/Bills Due Soon — before this change they were
  the two side-column cards still rendering at full `.card` weight, the
  same visual weight as Categories/Expenses, which is exactly the "equal
  weight" complaint. `.card--quiet` itself gained a smaller padding
  (`--space-4` instead of `--space-5`) and a smaller headline-figure font
  size (`.single-value-form__current` inside it drops from
  `--font-size-xl` to `--font-size-base`) — both apply automatically to
  every existing `.card--quiet` user, not just the two newly-converted
  ones. The hero is untouched — still the only element using the green
  gradient/serif-amount treatment.
- Verified through the real store/UI at every breakpoint that matters,
  not just the primary 1400px target: 1024px and 1100px (below the new
  wide-desktop breakpoint — single-column side, unchanged), 1280px+
  (the new 2-per-row side grid), a 390px phone (summary strip wraps 2×2,
  Inbox correctly appears right after the hero), and both themes (the
  existing token system needed no changes — every new class reads
  `var(--color-*)` tokens, same as everything else). Confirmed the exact
  empty-state copy this change was told to leave alone
  ("Nothing here yet — press N or tap + Brain dump to jot something
  down.") rendered unchanged. 465/465 existing tests pass unmodified — no
  test file needed touching, since nothing here is calculation logic;
  `docs/ARCHITECTURE.md`'s `components/` line updated in the same change
  to list `summary-strip.js`.

**A follow-on restructuring of the right column specifically, at the
user's explicit request — fixing inconsistent card grouping/color usage,
again layout/styling only, no data logic touched.**

- **"This Period" and "Current Balance" merged into one card, "Right
  now"** (new `src/ui/components/right-now-section.js`, replacing both;
  `period-summary.js` deleted outright — nothing imported it anymore).
  Three rows — Current balance, Money in, Money out — same row-icon
  layout "This Period" always used (`.right-now*` CSS classes are the old
  `.period-summary*` ones, renamed in place since the row shape itself
  didn't change, only the card it lives in). The old "Bills due" row (a
  period-scoped count) was dropped from the merge — it would now
  duplicate both the Bills Due Soon card directly below it and the
  summary strip's own bills-due tile. Current Balance kept its edit
  capability as "a small inline edit affordance" (the option the user
  offered as their preferred fallback if a full inline form didn't fit) —
  a pencil `iconButton` next to the Current Balance row opens a popup,
  same interaction Savings' own "edit total" pencil already used.
  Implemented by generalizing `single-value-section.js`'s
  `renderEditTotalForm` (now exported; three new optional params —
  `parse`, `errorText`, `hint` — all defaulting to its exact prior
  hardcoded behavior, so Savings' existing call site needed no changes)
  rather than duplicating that popup-form boilerplate a second time,
  parsing with `parseBalanceToCents` (negative allowed — Current Balance
  legitimately can, docs/DATA-MODEL.md "Current Balance model") and no
  `hint` (Savings' hint text about "replacing vs. adding" only makes
  sense next to an additive form Current Balance has never had). Dispatches
  the same, unchanged `setCurrentBalanceAction`.
- **Bills Due Soon / Upcoming Income color coding — verified already
  correct, not changed.** `.bills-due-soon` was already
  `var(--color-status-caution-bg)` (amber/warning) and `.upcoming-income`
  already `var(--color-status-positive-bg)` (green/positive) — this
  request's color-consistency ask was already satisfied by existing code;
  confirmed by reading the CSS rather than assumed, and left untouched.
  Their order swapped (Bills now first/left, Income second/right) to
  match the exact "Bills Due Soon + Upcoming Income" order the user wrote
  in their requested column order, on both the desktop side-by-side pair
  and the mobile flat stack.
- **Savings moved to the bottom of the right column, full width.**
  Already styled neutrally (`single-value-section.js`'s card carries no
  color class, unlike Bills/Income) — no restyling needed, only
  repositioning. "Full width" at the 1280px+ wide-desktop breakpoint
  (src/styles/responsive.css, from the prior column-rebalancing entry
  above) means `grid-column: 1 / -1`, same technique already used there
  for the privacy note — now also applied to "Right now", since a
  three-row merged card reads better spanning the full column than
  squeezed into half of it. A CSS Grid item with an explicit full span
  always claims its own entire row during auto-placement, so "Right now"/
  Savings/privacy (all `1 / -1`) can never end up sharing a row with the
  Bills/Income pair the way the hero once did with the old "This period"
  card (see that bug's own entry above) — no explicit `grid-row` needed
  to get the requested order (Right now → Bills | Income → Savings →
  privacy).
- **Resulting column-height balance — checked and reported, not
  silently left as-is, per the user's own request to be told if it
  didn't come out even.** Measured before and after (temporary
  Playwright, not a project dependency): merging two right-column cards
  into one, plus the two color-tint cards already being compact, shortened
  the right column enough that the **left** column is now the taller one
  — about 184px taller with realistic data at the primary 1400px target
  (previously the right column was taller by a smaller margin, per the
  prior entry's own rebalancing work). This is a direct, expected
  consequence of the consolidation just requested — merging cards
  necessarily makes that column shorter — not a bug or an overlooked
  side effect, and was reported back rather than papered over with an
  artificial height hack (e.g., padding one card to force a match), which
  would misrepresent real content just to hit a pixel target. Left for
  the user to decide whether a follow-up rebalancing pass is wanted.
- Verified through the real store/UI at every breakpoint that matters
  (1400px, 1100px — below the wide-desktop side-grid breakpoint, and a
  390px phone) and both themes, including driving the actual "Edit
  current balance" popup end to end (opened it, saved a negative amount,
  confirmed `-$42.50` rendered correctly in the merged card — proving the
  `parseBalanceToCents`/negative-allowed wiring, not just reading the
  source). 465/465 existing tests pass unmodified. `docs/ARCHITECTURE.md`
  updated in the same change (`right-now-section.js` in the tree,
  `period-summary.js` noted as removed).

**One more small right-column tweak, at the user's request: Bills Due
Soon moved from beside Upcoming Income to directly underneath it** — one
line reordered in `src/ui/screens/dashboard.js` (income before bills,
was bills before income), matching `order` values updated in both
components.css (mobile) and responsive.css (desktop). This left the
1280px "pair Bills+Income 2-per-row to rebalance column height" mechanism
from the entry above with nothing left to pair — every side-column card
is single/full-width now — so that whole breakpoint block (the `1fr 1fr`
sub-grid, `app-main`'s extra width) was deleted rather than kept as inert
CSS with no visual effect. The side column is simply one flex-column
stack at every desktop width now. 465/465 tests still pass (no logic
touched); re-verified at 1400px and 1100px that both now render
identically (same side-column height, 1177px, at both — confirming the
breakpoint removal changed nothing it wasn't supposed to).

**Summary strip tiles swapped, at the user's request: Safe to Spend ->
Total expenses (position 1), Days left -> Total bills (position 2,
moved up from 3) — Bills due and Inbox items shift down to fill 3 and
4.** Rationale not stated by the user but worth recording: Safe to Spend
showing twice (strip + hero, one card below it) added little, and "Days
left" (`daysUntilPayday`) wasn't reused by anything else the same way
the other three tiles' figures are. Both replacements reuse existing
selectors — "Total expenses" is `getExpensesTotalCents(getAllExpenses
(state))`, already public, no new code. "Total bills" needed one new
selector, `getUpcomingBillsTotalCents(state)`
(`src/modules/dashboard/index.js`) — every active, unpaid bill's amount
summed with no due-date horizon, deliberately *not*
`getSafeToSpend`'s own `upcomingBillsCents` (which only counts bills due
before the next payday) so it matches what the neighboring "Bills due"
count tile already means. Defensive against a corrupted `amountCents`,
same pattern as every other `*TotalCents` selector in this codebase.
`renderSummaryStrip` no longer takes a `result` param at all (nothing
left in it reads `getSafeToSpend`'s output). `daysUntilPayday` itself is
untouched and still computed — same "kept available even though nothing
currently renders it" treatment other unused-but-real fields in this
codebase get. Four new tests in `tests/unit/dashboard.test.js` for the
new selector; 470/470 total pass. Verified against the real store/UI,
not just the selector in isolation — Total expenses ($92.00) and Total
bills ($960.00 = $900 Rent + $60 Internet) both matched the same seeded
data's other cards exactly.

**"Right now" card's heading now shows the header bar's selected period
(e.g. "This month"), not a static "Right now" label; app-main's left/right
padding reduced by exactly 20%.** Two small, unrelated asks in one
message.
- Heading: new `getPeriodLabel(value)` exported from
  `src/ui/components/period-selector.js` (the same label text the period
  dropdown already showed, previously private to that file) —
  `src/ui/screens/dashboard.js` now passes `getPeriodLabel(selectedPeriod)`
  into `renderRightNowSection` as `periodLabel`, which becomes the
  `sectionHeading` text instead of the literal string `'Right now'`.
  Deliberately just a label swap, not a scope change: Current Balance
  inside that same card still isn't period-scoped (still always "right
  now" underneath — docs/DATA-MODEL.md "Current Balance model" is
  unchanged), only Money in/out actually vary with the selected period,
  same as before. Verified by actually switching the period selector
  through the real UI (This month -> This week -> All time) and reading
  the heading text back each time, not just checking the wiring.
- Padding: new `--app-edge-padding: 12.8px` token in `src/styles/base.css`
  (`var(--space-4)` = 16px, reduced by exactly the requested 20%) —
  deliberately not folded into the space-1..8 scale, since every value
  there is a whole multiple of 4px and this one-off isn't; a single
  purpose-named token instead of duplicating `12.8px` across the three
  separate `.app-main` rules (base/640px/1024px) that set it. Only the
  horizontal component changed — each breakpoint's vertical padding is
  untouched (`--space-4`/`--space-6`/`--space-8` as before), confirmed via
  computed styles in the real browser (`paddingLeft`/`paddingRight`:
  `12.8px`, `paddingTop` still `32px` at desktop width).

**Current Balance split back out of the merged "Right now" card into its
own standalone card again, directly below the period card, at the user's
request.** `src/ui/components/right-now-section.js` no longer touches
Current Balance at all — no `getCurrentBalanceCents`/
`setCurrentBalanceAction`, no edit-pencil popup, no `dispatch`/`state`
params it doesn't need anymore; it's back to exactly two rows (Money in,
Money out), titled with the selected period (unchanged from two entries
above this one). `src/ui/screens/dashboard.js` re-adds Current Balance as
its own `gridItem`, positioned directly under the period card — reusing
`single-value-section.js`'s `renderSingleValueSection` completely
unmodified, the exact same call (title/description/icon/
`allowNegative: true`) it used before the merge ever happened. No new
component needed — the merge never deleted this capability, only stopped
calling it from dashboard.js. `order` values updated in both
components.css (mobile) and responsive.css (desktop) for the reinstated
`balance` slot. The period card's heading icon changed from `wallet`
(which made sense paired with a balance row) to `calendar` (matching the
old "This Period" card's icon) now that the card is purely period-scoped
again. File/function names (`right-now-section.js`/
`renderRightNowSection`) and the `.right-now*` CSS classes were
deliberately **not** renamed even though "right now" no longer describes
a card with zero always-current content left in it — same call already
made for the CSS classes when this card was created from the deleted
`period-summary.js` (a name outliving what it describes, documented
inline rather than churning every reference for an internal identifier
with no user-visible effect); both files now cross-reference this same
history in their header comments. `docs/ARCHITECTURE.md`'s `components/`
line updated to match. 470/470 tests pass (no logic touched — this is
composition/layout only); verified through the real UI that the period
card and the reinstated Current Balance card both render correctly and
in the right order.

**Current Balance's inline field/Save button removed, at the user's
request — just a pencil icon that opens a small popup to change it.**
`src/ui/components/single-value-section.js` gained a new `editOnly`
option: when true, the card renders only the "Currently: $X" line plus a
pencil `iconButton`, skipping the inline `amountField`/error/success/
submit-button form entirely — the popup (reusing the same
`renderEditTotalForm` Savings' own "edit total" pencil already used) is
the only way to change the value, not a secondary shortcut alongside a
still-visible form. `src/ui/screens/dashboard.js`'s Current Balance call
site gained one new line, `editOnly: true` — no new component, no change
to `setCurrentBalanceAction` or any other logic.
- **A real cross-instance bug caught and fixed while making this
  change, not shipped:** the pencil-popup's open/closed state used to be
  one shared module-level boolean (`editTotalFormOpen`), fine when only
  Savings ever used the pencil pattern, but Current Balance switching to
  `editOnly` meant two separate card instances could now show this popup
  — with a single shared boolean, opening one card's popup would have
  made the *other* card's popup appear open too on the next render (both
  instances check the same flag). Fixed by keying the open state to the
  section's own `id` (`editPopupOpenId`, holding the open section's id or
  `null`, not a bare boolean) — same "track *which one*, not just
  whether one" convention already used elsewhere in this app (e.g.
  inbox-section.js's `convertingDraftId`). Verified directly, not just
  reasoned about: opened Current Balance's popup, saved a new value
  ($999.99, confirmed it rendered), then opened Savings' popup and
  confirmed Current Balance's popup did *not* also appear open.
- 470/470 tests pass (no logic touched). Verified end to end through the
  real UI: no inline input exists under Current Balance anymore, the
  popup pre-fills correctly, saves correctly, and both cards' pencils
  work independently.

**Added a currency picker, top-left of the dashboard, at the user's
request — with the scope clarified via `AskUserQuestion` before writing
any code, since "multi-currency" is genuinely ambiguous and the two
readings have wildly different costs.** The two options put to the user:
(a) a display-only currency picker — one formatting preference for the
whole app, no conversion, no per-entry currency; or (b) true multi-
currency tracking — each Bill/Income/Expense in its own currency,
converted into one Safe-to-Spend figure, which needs exchange rates from
somewhere. (b) would have been a large, invasive change (new fields
across most of the data model, conversion logic threaded through every
money calculation in `safe-to-spend/calculation.js` and friends) and,
if the rates were meant to update automatically, would have required an
explicit decision to override this app's own non-negotiable "no external
API calls, nothing should make a network request in normal use, fully
offline-capable" rule — a live-rates API is exactly the kind of thing
that rule exists to keep out. The user picked (a).

What shipped, entirely within that scope:
- **`src/core/money.js`** gained `SUPPORTED_CURRENCIES` (a short, fixed
  list — USD/EUR/GBP/JPY/CAD/AUD, not exhaustive, a one-line addition to
  extend) and rewrote `formatCents` from hand-rolled `` `$${dollars}...` ``
  string-building to `Intl.NumberFormat('en-US', { style: 'currency',
  currency })` — the locale is pinned to `en-US` regardless of the
  browser's own locale, so punctuation/thousands-separator conventions
  stay deterministic and unchanged for the existing USD default; only the
  *currency* varies. `Intl.NumberFormat` handles each currency's real
  minor-unit convention correctly on its own (JPY has no decimal places,
  confirmed via a real formatted `¥2,450`, no decimals, not hand-coded
  per currency). This is a **narrow, deliberate exception to money.js's
  otherwise pure-function design**: which currency is active is
  module-level state (`activeCurrency`, set via `setActiveCurrency`/read
  via `getActiveCurrency`), not a parameter every caller passes in —
  `formatCents` is called from roughly a dozen UI files, several through
  nested row-building helpers that don't currently receive `state` at
  all, so threading a currency argument through every one of them would
  have been a much larger, riskier change for a display-only preference.
  This mirrors a pattern this codebase already uses for exactly this kind
  of cross-cutting display concern: theme is applied as a class on
  `<html>` once per render, not threaded as a prop through every
  component that needs it. `src/ui/shell.js`'s `render()` now calls
  `setActiveCurrency(getCurrency(state))` right alongside its existing
  theme-class toggle, before building either screen's tree — safe because
  every render in this app is fully synchronous, top-to-bottom DOM
  construction, so there's no interleaving that could let one render's
  `formatCents` calls see a different render's currency.
- **`settings.currency`** (`src/modules/settings/`) — `setCurrencyAction`/
  `getCurrency`, defaulting to `'USD'`, rejecting an unrecognized code
  rather than storing it (same "ignore invalid, don't store garbage"
  pattern `setThemeAction` already used). No schema version bump — same
  "a new scalar settings field with a safe default when missing needs no
  migration" precedent `theme`/`displayName`/`reducedMotion` already
  established.
- **New `src/ui/components/currency-selector.js`** — an anchored
  dropdown, structurally the same scrim+panel pattern
  `period-selector.js` already uses (a transparent full-page click-catcher
  behind the panel, closing on an outside click or Escape with no raw
  `document`-level listener), but anchored to its toggle's *left* edge
  instead of the right, since this toggle lives at the left end of the
  header bar (a right-anchored panel there would run off the left edge
  of the viewport). Rendered inside `header-bar.js`'s brand area,
  directly next to "Money" — literally top-left, as asked, not grouped
  with the period-selector/theme-toggle controls on the right.
- **A real `let`/`const` name collision caught by the build's own
  regression test, not shipped**: this bundler concatenates every module
  into one shared scope (no per-module isolation), and
  `currency-selector.js`'s first draft declared `let panelOpen = false`
  — the exact same name `period-selector.js` already uses for its own,
  unrelated open/closed flag. `npm run build` doesn't catch `let`/`const`
  collisions (only function declarations — a known, documented gap from
  an earlier session), but `tests/unit/build.test.js` does, because it
  executes the real built bundle rather than just reading source; it
  failed with `SyntaxError: Identifier 'panelOpen' has already been
  declared` until renamed to `currencyPanelOpen`.
- **`tests/unit/build.test.js` itself needed a real update, not just a
  passthrough**: its regression check for a much older bug (a *string*
  `.replace()` call mangling a literal `$` immediately before a `${...}`
  interpolation — see that file's own header comment) pattern-matched
  money.js's old hand-rolled `` `$${dollars}...}` `` template literal
  verbatim in the built bundle. That exact source no longer exists after
  this change (formatCents is `Intl`-based now), so the old assertion
  would have been testing dead source text, not a real property. Rewired
  to check the actual fix directly instead — that `build.js`'s `.replace()`
  call still passes a function, not a string, as its second argument —
  which is what actually prevents this whole bug class regardless of what
  any given module's source contains later; the stronger half of the
  original test (extracting the real `formatCents` from the built bundle
  and executing it, proving actual runtime output, not a string-match
  coincidence) was kept unchanged.
- Verified end-to-end through the real UI, not just the unit tests (13
  new ones, across `money.test.js`/`settings.test.js`/the rewritten
  `build.test.js` — 483/483 total pass): switched currency to EUR and
  confirmed *every* dollar figure on the dashboard updated together — the
  hero, the summary strip, "This month," Current Balance, Upcoming
  Income, Bills Due Soon — with zero changes to any of those files' own
  code, proving the module-level `activeCurrency` mechanism actually
  reaches every caller as designed. Also confirmed the choice survives a
  real reload by reading `localStorage` directly (a first attempt using
  Playwright's `page.reload()` gave a false-negative — its own
  `addInitScript` re-seeds `localStorage` on every reload in that test
  harness, unrelated to the app itself, caught and correctly identified
  as a test artifact rather than chased as a false bug).
  `docs/DATA-MODEL.md` ("Settings," including the "why not real
  multi-currency" reasoning) and `docs/ARCHITECTURE.md` (money.js,
  settings/, and the new component) updated in the same change.

**Currency picker: moved to the header bar's right-side controls group
(next to the period selector and theme toggle) and switched from a
text-code button ("USD") to an icon button showing the currency's bare
sign ("$"), both at the user's explicit follow-up request.** New
`getCurrencySymbol(currency)` in `src/core/money.js` — derived from
`Intl.NumberFormat`'s `narrowSymbol` display (not a second hardcoded
currency→symbol map, so it can never disagree with `formatCents` about
what a code renders as); `narrowSymbol` specifically because `Intl`'s
default `symbol` style disambiguates CAD as "CA$" rather than a plain
"$", which a one-character icon glyph doesn't have room for.
`currency-selector.js`'s toggle is now a plain `.icon-btn` (not
`iconButton()` — that helper always renders a hand-authored SVG glyph;
this needed a text character instead) showing that symbol, matching the
square footprint of its new neighbors. The dropdown panel's anchor
flipped from `left: 0` to `right: 0` to match — it's no longer at the
left end of the header bar, so a left-anchored panel would have run off
the right edge instead of overflowing safely inward. `header-bar.js`'s
brand area is back to just the wallet icon + "Money," unchanged from
before the currency picker ever existed. 487/487 tests pass (4 new, for
`getCurrencySymbol`); verified through the real UI that the icon shows
the correct sign and updates immediately on selection.

**Added Debt Tracking, at the user's explicit and detailed request —
ahead of `docs/ROADMAP.md`'s phase order (same footing as "Brain dump"
before it), additive, and with every prior phase left intact.** A new
`src/modules/debts/` module (`actions`/`reducer`/`selectors`/
`payment-effect`/`index`, the same shape as every other list-entity
module) holds `Debt` records: `name`, `originalBalanceCents`,
`currentBalanceCents`, `minimumPaymentCents`, `dueDate` (a **day-of-month
integer 1–31**, matching the request's `dueDate: 15` example — not a
YYYY-MM-DD; debt payments are treated as monthly-recurring for
scheduling, `paymentFrequency` only feeds the payoff estimate),
`interestRate` (optional APR percent, `null` = not entered, `0` is a
distinct valid value), `paymentFrequency` (`monthly`/`biweekly`/
`weekly`). `schemaVersion` bumped 8 → 9 (`migrateV8ToV9` — purely
additive, adds empty `debts` + `debtPayments`; both added to
`ARRAY_COLLECTION_KEYS`). Everything documented in the same change:
`docs/DATA-MODEL.md` (root shape, "Debt" + "DebtPayment" entities, §7
migration), `docs/SAFE-TO-SPEND.md` §3c, `docs/ARCHITECTURE.md` (module
tree + the cross-slice-exception paragraph, now four uses), `docs/
PRODUCT.md` §4 item 16, `docs/ROADMAP.md`.

- **Safe-to-Spend is untouched by design.** `getSafeToSpend` never reads
  `state.debts`/`state.debtPayments`; `src/modules/debts/` has no import
  relationship with `src/modules/safe-to-spend/` either way — the same
  "excluded by construction" treatment as `CategoryBudget`
  (`docs/SAFE-TO-SPEND.md` §3b/§3c). Owing money doesn't reduce
  Safe-to-Spend; only a *payment* does, and only through the ordinary
  Expense it logs.
- **A payment is a cross-slice effect, the fourth use of that documented
  exception** (`docs/ARCHITECTURE.md` §7). `recordDebtPaymentAction` →
  `src/main.js`'s `rootReducer` special-cases `debts/record-payment` and,
  in one atomic transition: decrements the debt's `currentBalanceCents`
  (clamped at 0 — a debt **never** goes negative; an over-payment zeroes
  it but still logs the full amount that really left the account),
  appends a real `Expense` (category `"Debt Payment"`, `description`
  `"Payment: <name>"`, a `debtId` back-reference), debits
  `budget.currentBalanceCents` by that expense's amount, and appends a
  `DebtPayment` log record (the Debt-side counterpart to `BillPayment`/
  `IncomeReceipt`, denormalized `name`, links `expenseId`). So the money
  hits Current Balance → Safe-to-Spend **exactly once**, via the Expense
  path — never double-counted against the debt balance
  (`tests/unit/debts-integration.test.js` proves Safe-to-Spend drops by
  exactly the payment amount, not twice).
- **UI, reusing the existing design system, no new visual language.** New
  `src/ui/components/debts-section.js` — a "Debt overview" `.card` in the
  dashboard's main column (between Categories and Expenses; `order` values
  added in `components.css` + `responsive.css`). Per debt: name, `$X
  remaining · $Y original`, a progress bar reusing the Categories card's
  `.category-row__bar`/`.category-row__bar-fill` primitives (a fuller bar
  = more paid off, so the default green fill reads correctly with no
  status modifier), `N% paid off` (or `Paid off 🎉` with positive-tone
  styling — the debt is **not** auto-deleted), an optional payoff-estimate
  line (only when an APR is set, always labelled "(estimate)"; a payment
  that doesn't cover one month's interest shows a calm note, never an
  impossible date), and a "Make payment" button. "Manage debts" opens a
  popup with the add form + inline edit/delete rows, mirroring
  `category-budgets-section.js`/`bills-due-soon.js` exactly (add form at
  top, `window.confirm` on delete). The payment popup prefills the
  minimum payment, defaults the date to today, and takes an optional
  note. Add/edit form: name/original/current/minimum/due-day up front,
  APR + frequency behind the shared "+ More options"
  (`renderMoreOptions`).
- **"Bills due soon" integration** (`docs/PRODUCT.md` §8): a debt's
  minimum payment shows as an ordinary-looking row in the *existing*
  "Bills due soon" card — no separate "debt bills" list — with a "Make
  payment" action that opens the Debt overview card's payment popup via a
  new exported `openDebtPaymentPopup` (same "set module state + request a
  render" pattern as `openBrainDumpCapture`; the popup is rendered by
  `renderDebtsSection`, always in the tree). `getUpcomingDebtPayments`
  resolves each debt's `dueDate` day-of-month to the next such calendar
  day. A debt already paid for the current month (a `DebtPayment` dated
  in it — `hasDebtPaymentInMonth`) drops off the card, mirroring a paid
  Bill. "Manage bills" stays bills-only.
- **Summary strip** (`src/ui/components/summary-strip.js`) gains a "Total
  debt" tile (`getTotalDebtCents`) inserted after "Total bills" — but
  **only when the user is tracking at least one debt**, so the strip
  stays four tiles for everyone else (progressive disclosure, CLAUDE.md).
  The request's §4 "show $0 when there are no debts" is instead satisfied
  by the always-present Debt overview card's own empty state. `auto-fit`/
  `minmax` handles the extra tile with no breakpoint change.
- **Edge cases handled** (`docs/PRODUCT.md` §15): $0-balance debt
  (excluded from "due soon", shows "Paid off 🎉"), over-payment (clamp +
  full-amount expense), missing APR / 0% APR (no estimate vs. simple
  division), decimal payments (integer cents from the form), delete a
  debt (its past payment `Expense`s stay in history — `deleteDebtAction`
  only removes the `Debt`), refresh (persists through the normal storage
  adapter + v8→v9 migration; existing users get `debts: []` with no data
  loss). Not handled by design (same scoping as Bills/Income in
  `docs/DATA-MODEL.md` §3a): editing/deleting a debt or its payment
  Expense doesn't retroactively re-sync balances; no duplicate-payment
  detection beyond what the visible `DebtPayment` log gives.
- **Tests:** `tests/unit/debts.test.js` (reducer CRUD/validation, clamp,
  progress, next-due-date, payoff estimate, "due soon" rows) +
  `tests/unit/debts-integration.test.js` (the `rootReducer` cross-slice
  transition, no-double-count, over-payment, delete-keeps-expenses) + a
  v8→v9 block in `schema.test.js` — 527/527 pass (40 new). Build passes.
  UI verified via the session's usual throwaway DOM-shim smoke test
  (empty state, debt rows + progress + payoff line, paid-off state, the
  conditional summary tile, bills-due-soon merging bills + debt rows, a
  paid debt leaving that list), then discarded per
  `docs/TEST-PLAN.md`'s manual-DOM-testing policy.
- **Bundler gotchas hit and fixed** (`build/build.js` concatenates every
  module into one scope): `FREQUENCY_LABEL`/`frequencyField` collided
  with `income-section.js` → renamed `DEBT_FREQUENCY_LABEL`/
  `debtFrequencyField`; the multi-line `import { ... }` and multi-line
  re-`export { ... }` this bundler's single-line regexes don't match had
  to be collapsed to one line each.

**Added a left sidebar navigation, at the user's explicit and detailed
request — but as *in-page section navigation*, not a return to
multi-view routing, confirmed with the user via `AskUserQuestion`
before any code was written.** The request's own constraints ("don't
rewrite working functionality", "simplest architecture compatible with
the existing app", "don't overbuild", "don't redesign the dashboard")
plus this file's history — the multi-view Dashboard/Money nav + hash
routing was removed at the user's own earlier explicit request, and an
icon-rail nav was explicitly declined once already (see the
"visual/structural redesign" entries above) — pointed to one answer: the
app stays **one scrolling screen**, and the sidebar scrolls to / spies
on the existing dashboard cards. No router, no URL/hash changes, no
storage/schema changes, no card/calculation/reducer changes.

- **New `src/ui/components/sidebar.js`** — `renderSidebar({
  onToggleCollapse, onNavigate, onCloseDrawer })` returns `{ nav, scrim
  }`. 8 items in 3 groups, each mapped to an existing card's heading id:
  **Main** — Dashboard (→ page top); **Money** — Balance
  (`current-balance-heading`), Income (`upcoming-income-heading`),
  Expenses (`expenses-heading`), Bills (`bills-due-soon-heading`), Debts
  (`debts-heading`); **Planning** — Categories (`categories-heading`),
  Savings (`savings-heading`). No "Settings" item — theme/currency
  already live in the header bar and there is no settings screen (not
  inventing one — the request's §16 rules that out). Icons reuse
  `src/ui/components/icons.js`; 5 new hand-authored glyphs added there
  (`menu`, `home`, `credit-card`, `chevron-left`, `chevron-right`) in
  the same 24×24 stroke style — no icon library added.
- **Desktop (`>=1024px`)** — a fixed left rail; collapsible to
  icons-only (68px) with the section name kept reachable via each
  button's `title` (hover tooltip) + `aria-label` (AT), active highlight
  still shown. Active item follows scroll position via a lightweight
  rAF-throttled `scroll` listener in `src/ui/shell.js` calling
  `syncSidebarActive()` (patches the sidebar DOM directly — no store
  round-trip, no re-render), plus an immediate set on click with a
  ~700ms spy-suppression so it doesn't flicker through sections during
  the smooth scroll. `.app-main` gets a left offset for the rail; the
  dashboard's content moved into a new `.dashboard-body` wrapper that
  re-establishes the 1040px centered measure inside that offset area
  (onboarding, which has no sidebar, is untouched — the `body.has-sidebar`
  class gates all of it).
- **Mobile (`<1024px`)** — the rail goes off-canvas; a hamburger in the
  header bar (`src/ui/components/header-bar.js`, new `onOpenNav`, hidden
  by CSS at `>=1024px`) opens it as a slide-in drawer with a dim scrim.
  Selecting an item scrolls **and** auto-closes the drawer; scrim
  click / Escape / an in-drawer × button also close it; `<body>` scroll
  is locked while open (folded into shell.js's existing
  popup-scroll-lock line); focus moves into the drawer on open and back
  to the hamburger on close (rAF, matching `popup.js`'s pattern). The
  drawer stays `visibility: hidden` while off-canvas so it's inert to
  keyboard/AT when closed.
- **The dashboard's two-column grid breakpoint moved `1024px` →
  `1280px`** — the fixed rail eats ~270px, so two columns only get an
  uncramped measure once the viewport is genuinely wide enough
  (CLAUDE.md "Responsive design" — cards stay uncramped). Between 1024
  and 1279 the dashboard is a single comfortable column beside the rail.
  This is the only pre-existing responsive rule that changed; the mobile
  flat-`order` sequence is unchanged.
- **State** — `collapsed` / `drawerOpen` / `activeNavId` are ephemeral
  module-level state in `sidebar.js`, resetting on reload, exactly like
  `selectedPeriod` and every other UI toggle in this app. Deliberately
  **not** persisted: the request's §16 says "no new settings", and
  CLAUDE.md forbids a bespoke `localStorage` write outside the storage
  adapter — adding `settings.sidebarCollapsed` for a cosmetic default
  wasn't worth either cost.
- **Accessibility** — `<nav aria-label="Sections">`, real `<button>`s
  with visible text + `aria-label` + `title`, `aria-current="true"` on
  the active item, `aria-expanded` on the collapse toggle and hamburger,
  `aria-controls="app-sidebar"`, Escape-to-close, focus management on
  the drawer. Icons are `aria-hidden` (never the only label), per the
  existing icon-set contract.
- **Docs** updated in the same change: `docs/ARCHITECTURE.md`
  (`shell.js` + `components/` descriptions — still one screen, now with
  in-page section nav). No `docs/DATA-MODEL.md` / `docs/SAFE-TO-SPEND.md`
  change — nothing about data or the formula moved.
- **Verification** — `npm run build` + all 527 existing tests pass
  unchanged (no logic touched). UI checked via the session's usual
  throwaway DOM-shim smoke test: `renderSidebar` structure (nav / 3
  groups / 8 links / labels / tooltips / default-active Dashboard /
  toggle / close / scrim), nav-item click → `onNavigate(id)`, collapse /
  close / Escape wiring, `scrollToNavTarget('dashboard')` → scroll to
  top, the full dashboard rendering with the sidebar + scrim +
  `.dashboard-body` and every heading target present with all existing
  cards intact, and the scroll-spy marking the correct section active
  from simulated heading positions (exactly one active link,
  `aria-current` set). Then discarded per `docs/TEST-PLAN.md`'s
  manual-DOM policy. Bundler gotchas avoided: single-line imports/
  exports in `sidebar.js`, and all new top-level names prefixed
  (`renderSidebar`, `syncSidebarActive`, `SIDEBAR_ITEMS`,
  `scrollToNavTarget`, `isSidebarCollapsed`, …) since the bundler
  concatenates every module into one scope.

**The sidebar was then converted from in-page anchors into a real
multi-view app, at the user's explicit and detailed request** — a direct
reversal of the "single scrolling screen" decision (and of the in-page
sidebar built the message before). Each sidebar item is now a dedicated
screen; the main content area swaps completely between them; the sidebar
+ header bar are the persistent shell. Scroll-spy and the scroll-to
mechanism from the previous version are gone.

- **Routing: a ~55-line hash router, `src/ui/router.js`** (`getCurrentView`
  / `navigateToView` / `initViewRouter`) — no framework (docs/
  ARCHITECTURE.md §2). `#dashboard` (default), `#income`, `#expenses`,
  `#bills`, `#debts`, `#budget`, `#categories`, `#settings`; `#index` and
  a bare/unknown hash both resolve to the Dashboard. Application state is
  **completely independent of the hash** — switching views, refresh, and
  browser Back/Forward never touch the store or localStorage (verified in
  the smoke test). `src/ui/shell.js` renders `VIEW_RENDERERS[getCurrentView()]`
  into `<main>` and re-renders on **both** store changes and `hashchange`
  (the latter also scrolls the new view to the top — docs/PRODUCT.md
  §15/§17). Onboarding still gates everything and ignores the route.
- **`src/ui/components/app-frame.js` (`renderAppFrame`)** — the persistent
  shell every screen wraps its content in: sidebar + mobile scrim +
  header bar + an optional `<h1>`. It wires navigation
  (`onNavigate → navigateToView`, closing the mobile drawer first), the
  collapse toggle, the drawer, and the global period selector **once**,
  for all eight screens.
- **`src/ui/components/sidebar.js` rewritten**: view-based `SIDEBAR_ITEMS`
  (Dashboard / Income / Expenses / Bills / Debts / Budget / Categories /
  Settings, grouped Main / Money / Planning / Other), `renderSidebar({
  activeView, … })` (active item = current route, `aria-current="page"`),
  `data-view` hooks. Deleted: `activeNavId`, `scrollToNavTarget`,
  `syncSidebarActive`, `applySidebarActiveClass`, `spySuppressedUntil`,
  the `getSidebarActiveId`/`setSidebarActiveId` pair, and shell.js's
  passive `scroll` listener. Kept: the collapsed/drawer ephemeral state
  and all the desktop-rail / mobile-drawer CSS from the previous message
  (unchanged).
- **Seven new screen files** (`src/ui/screens/{income,expenses,bills,
  debts,budget,categories,settings}-view.js`), each a thin composition —
  they reuse the *same* section components the Dashboard summarises, via
  a new `compact` flag on each: `compact: true` (Dashboard) = a preview
  list + a "View all X →" link that routes to the dedicated view, with
  Balance/Savings shown read-only (`renderSingleValueSection`'s new
  `readOnly`) and no add/edit/delete; `compact` omitted (dedicated view)
  = the full existing management UI, popups and all. So there is **one
  implementation per feature**, not two. The Income view builds a small
  view/add/edit/delete/mark-received list from the existing
  `renderIncomeForm` + income actions (docs/PRODUCT.md §10 — no such list
  UI existed before); the Budget view = Current Balance + Savings
  (editable here, read-only on the Dashboard) + the period Money-in/out
  card + a Safe-to-Spend line; the Settings view consolidates the
  *existing* `settings.*` state (display name, theme, currency) into one
  screen — no new settings invented (docs/PRODUCT.md §16 rules that out).

**Follow-up, at the user's request: the Income / Expenses / Bills / Debts
views got a green "+ Add" button top-right and no inline entry fields.**
`renderAppFrame` gained a `titleAction` slot (rendered right of the `<h1>`
in `.view-header`, now a flex row). Each of the four views passes a
`btn btn--primary btn--small` "+ Add X" button there (`.btn--primary` is
already the accent/green fill — no new colour) that opens the existing
add form (`renderExpenseForm` / `renderIncomeForm` / `renderBillForm` /
`renderDebtForm`) in a `renderPopup`, via a per-view module-level
`add*Open` flag. The always-visible add forms were removed: the Expenses
section's `showAddForm` param is gone (and its now-unused
`createExpenseAction` import); the Income view's card no longer renders
`renderIncomeForm` inline; and the "Manage bills" / "Manage debts" popups
(reached from `renderBillsDueSoon` / `renderDebtsSection` in their full
mode) lost their top-of-popup add form — they're now edit/delete-only
lists, retitled "All bills" / "All debts". So each of the four views
shows only its information (lists + per-row quick actions + edit/delete)
plus the one green add button. The Dashboard is untouched (it never had
`titleAction`; its previews stay read-only with "View all →" links).
Verified in the smoke test: green `.btn--primary` button in each view
header, zero `<form>` on the page until it's clicked, click opens the
titled add popup, close works; Dashboard header has no add button.

**Follow-up spacing/naming pass (from user screenshots):** (1) the app
brand is now **"Budget and Planner"** (was "Money"), and after the user
said the wordmark looked unpolished it became a proper lockup — new
shared `src/ui/components/brand.js` (`renderBrandMark`) — an
accent-filled 34px rounded badge
holding a new hand-authored `brand` glyph (a rounded frame + check —
"money that's accounted for"), next to a two-line wordmark, **"Budget"**
(`--font-size-lg`, tight tracking) over **"and Planner"**
(`--font-size-xs`, uppercase, letter-spaced, `--color-text-secondary`) —
a deliberate stacked logotype that fits the 240px rail without clipping.
`.sidebar__brand-name` / `.header-bar__brand-name` rules were replaced by
`.brand*` rules; the collapsed-sidebar rule now hides `.brand__name`; the
sidebar's **"Money" nav-group label** is unrelated and unchanged. The
brand mark then moved to be **sidebar-only** (removed from
`header-bar.js`, where it had duplicated on desktop) — the header's left
slot now holds just the mobile hamburger.
(2) `.money-form` is now `display: flex; flex-direction: column; gap:
var(--space-4)` with `.money-form .field { margin-bottom: 0 }` — every
child (including a bare name `<input>`, which previously had no
`margin-bottom` and butted straight against the next field's label) now
gets one uniform gap; `.modal__body > .money-form` also drops its inline
top divider (redundant under the modal header). (3) `.bills-due-soon__row`
gets a hairline `border-bottom` between rows (tinted toward the card's
amber accent via `color-mix`, with a `--color-border` fallback, since
plain border is faint on that background). (4) `select.field__input` got
real vertical padding, and `.settings-view .field__input/.money-form` are
capped at `26rem` so a lone `<select>` doesn't stretch the full width of
the wide settings card. All CSS-only except the brand strings and the
`view-stack settings-view` class on the Settings body. 527/527 tests
still pass.
- **`src/ui/screens/dashboard.js` is now the overview** — hero + summary
  strip + `compact` preview cards, each linking out. It composes via
  `renderAppFrame` (its greeting/date became the frame's title/subtitle;
  `.today-header` CSS deleted). The 2-column `.dashboard-grid` (and its
  1280px breakpoint from the previous message) is unchanged.
- **`debts-section.js`**: `openDebtPaymentPopup` (the cross-card opener
  added last message so "Bills due soon" could pay a debt inline) is
  **removed** — a debt row in "Bills due soon" now routes to `#debts`
  instead, where the payment popup lives. The "Make payment" + "Manage
  debts" popups are otherwise unchanged, just `compact`-gated.
- **Data model / calculations: zero changes.** No schema bump, no reducer
  or selector touched, no `src/modules/**` change at all. Every view
  reads the same `state` and calls the same `dispatch` — proven in the
  smoke test (add an expense from the Expenses view → the Dashboard
  summary, Current Balance, and Safe-to-Spend all reflect it; navigating
  between views leaves `JSON.stringify(state)` byte-identical).
- **Verification**: `npm run build` + all 527 existing tests pass
  unchanged. UI checked via the session's throwaway DOM-shim smoke test
  (router parsing incl. aliases/unknown fallback + navigate
  change-detection; all 8 views render with the shell + exactly one
  active nav item matching the route + the right `<h1>`; sidebar groups
  in order; navigation doesn't mutate state; the add-expense-on-Expenses-
  view → Dashboard data-sync flow through the real form; Dashboard shows
  "View all …" links and *no* "Manage …"/"Edit …" links), then
  discarded. `docs/ARCHITECTURE.md` (§6 tree — router.js, app-frame.js,
  the screens list, the sidebar description) and `docs/PRODUCT.md` §11
  updated in the same change.
- **Bundler gotchas**: single-line `import { … }` / re-`export { … }`
  only (the build's regexes don't match multi-line — hit it in the three
  view files with long import lists, and `build.test.js` catches it by
  executing the bundle); `FREQUENCY_LABEL` / `incomeRow` collided with
  `income-section.js` / `upcoming-income.js` → renamed
  `INCOME_VIEW_FREQUENCY_LABEL` / `incomeViewRow`.

**Light-mode repalette ("Steady"), at the user's request — the warm
cream + sage green read as competitor-ish.** `src/styles/base.css`'s
`:root` (light) 13 colour tokens swapped for a cool, low-arousal set: a
faintly teal-tinted paper ground (`--bg #f2f6f6`), deep slate ink
(`--text-primary #23323a`, `--text-secondary #566a71`), a calm deep-teal
accent (`--accent #0e7c76`, `--accent-bg #ddefec`), and cooled
warning/danger (`#b06f1f` / `#bb463b`). Rationale: cool hues sit easier
for a low-cognitive-load ADHD UI, and teal keeps the "money = balance /
clarity / positive" association without being the same green; red stays
the sole "negative" signal. Every value contrast-checked (AA+ at the
weight it's used). Nothing else touched — the ~180 `var(--color-*)`
call sites are unchanged (they alias these), the hero gradient already
reads `var(--color-accent-muted)`, and `dist/index.html` was rebuilt.
Shadow tint moved warm-brown → cool slate (`rgba(26,42,49,…)`). The
**dark** theme's *accent trio only* was retuned to teal (`--accent
#5fb3ab`) so the brand/positive colour matches between modes; its warm
charcoal base is otherwise untouched and flagged in `base.css` as a
candidate for a later cool-dark pass. The fixed `--color-cat-*` category
identifier hues were deliberately left as-is (they're not theme-swapped
brand colour — see their comment in `base.css`).

**Dashboard trimmed to "KPIs + graphs", at the user's request.** The
dashboard is now a plain vertical stack: a 4-tile stat strip (**Current
balance · Total debt · Savings · Bills due** — all "right now" values,
no period dependency), the Safe-to-Spend hero, **two charts**, the Inbox,
the privacy line. All the compact preview cards
(right-now/balance/savings/categories/debts/expenses/bills-due-soon/
upcoming-income) and the whole 2-column `.dashboard-grid` / `order` /
1280px machinery are removed — every one of those features is still
reachable from its sidebar view, so nothing was lost.

- **`src/ui/components/charts.js` (new)** — `renderPieChart` (a donut:
  part-to-whole spending by category for the selected period, per-category
  identity colours, top 5 + an "Other" fold, an always-present legend
  carrying label + value + %) and `renderColumnChart` (single accent-hue
  columns: spending bucketed over time). Hand-authored SVG built as a
  **string** (the same technique as `icons.js` — no chart library,
  nothing added to the zero-dep / self-contained build); interactivity is
  a native `<title>` per mark. Built following the `dataviz` skill: one
  hue for the single-series column chart (no legend — the heading names
  it), 3 recessive hairline gridlines, 4px rounded bar tops on a square
  baseline, ≤24px bars, a selective single direct label on the tallest
  bar; 2px surface-colour gaps between donut wedges; text in text tokens,
  never the mark colour; calm empty states.
- **New pure selectors in `src/modules/dashboard/index.js`**:
  `getExpenseBreakdownByCategory` (group `Expense` records by category in
  a range, sorted desc) and `getExpensesOverTime` (bucket them by
  day/week/month — granularity adapts to the span; zero buckets kept so a
  quiet stretch reads as a gap; an unbounded range = last 6 calendar
  months). `Expense` records only (a debt payment is already one; a
  `BillPayment` isn't and stays out).
- **`summary-strip.js` reworked** to the four snapshot KPIs above (was
  Total expenses / Total bills / Bills due / Inbox items + a conditional
  Total debt).
- **`--color-cat-*` re-stepped** (`base.css`, light + both dark blocks)
  — the donut surfaced that the old 7 category hues **hard-failed** the
  data-viz normal-vision floor (worst adjacent ΔE 11.6, gate is 15) and
  the chroma floor (two read as grey). The new light set
  (`#1f9e63,#e08133,#2f7fd6,#d24f9a,#8a5fd0,#d94b3e,#0f9b9b`) clears both
  (normal-vision 15.3, chroma all pass); the remaining colour-blindness
  deltas are warn-band, which the method permits **because the donut
  always ships the legend + per-slice value/% as the identity channel**.
  Seven arbitrary hues can't fully clear CVD on one surface — a known
  limit of the medium, mitigated, not a bug. Also flows to the category
  icon chips app-wide (an improvement there too).
- **Verification**: `npm run build` + all 527 tests pass. Smoke-tested
  the two selectors (grouping/sum/sort; adaptive day/week/month
  bucketing; unbounded = 6 months) and both chart renders (donut path +
  2px gaps + hover titles + legend; accent bars + 3 gridlines + no
  legend; empty states), then the full dashboard (strip + hero + exactly
  two `.viz-card`s + Inbox; no `.dashboard-grid`, no old preview cards);
  palette re-run through the skill's validator. `docs/ARCHITECTURE.md`
  updated in the same change.

**Dashboard reshaped to match a reference the user shared** (superseding
the "KPIs + donut + column" version from the message before — that
donut/`renderPieChart` and the `getExpenseBreakdownByCategory`/
`getExpensesOverTime` selectors are **removed**). It's now, top to
bottom: the **Safe-to-Spend hero**; two headline **stat cards**
(`src/ui/components/stat-card.js` — Total expenses *this month* with a
real month-over-month `±% ↑/↓ from last month` delta chip; Total savings,
no delta since savings has no history); an **"Overview" chart** —
`renderColumnChart` reworked to **grouped 2-series columns**, Money in
(accent) vs Money out (amber `--color-status-caution-text`) per month for
the current calendar year (12 bands, ≤20px sub-bars, 2px surface gap,
3 gridlines, a 2-item legend, `<title>` hover); a compact **Recent
Expenses** list (`renderExpensesSection` `compact` + "View all →"); a
compact **Budget progress** card (`renderCategoryBudgetsSection`
`compact`); the **Inbox** (kept — still the only draft access); the
privacy line. `renderSummaryStrip` / `summary-strip.js` **deleted**
(replaced by the hero + 2 stat cards). New selectors in
`src/modules/dashboard/index.js`: `getMonthlyInVsOut` (12×
`getPeriodSummary`) and `getExpensesMonthOverMonth`. Current Balance /
Total debt / Bills-due are no longer surfaced on the dashboard (all
still on their own views) — the reference struck "Account Balance" and
showed no debt.

**Then a full visual pass on that dashboard against the same reference,
at the user's very detailed request** ("polished SaaS/fintech product").
`src/ui/screens/dashboard.js` now builds a **responsive CSS grid**, not
a stack: `.dashboard__top` = top row [**Safe to Spend** | Total Expenses
| Total Savings] (3-across at ≥1024px via `1.35fr 1fr 1fr`; at
600–1023px Safe-to-Spend spans the row above the two stat cards; 1-col
on phones) → the full-width **Income vs Expenses** chart → `.dashboard__bottom`
= [Budget progress | Recent Expenses] (2-up only at ≥1024px) → Inbox →
privacy. Key styling changes: `.hero` (the Safe-to-Spend card) lost its
loud gradient + `--shadow-md` — prominence now comes from a flat
`--color-accent-muted` tint + the page's largest figure (**new
`--font-size-3xl` = 2.25rem, sans**, dropping the serif) + a full-width
"+ Add expense" button; it's left-aligned and flex-column to sit in a
grid cell. `.dashboard .card` gets `--space-6` padding. `renderColumnChart`
viewBox widened to 560×280 (from 360×200), bigger axis/label type, capped
at `max-height: 320px`. **Recent Expenses is now a real `<table>`**
(`renderExpensesSection` `compact` branch — `renderExpensesTable`,
`.mini-table` in an `overflow-x:auto` wrapper so it never overflows a
phone): Activity (icon + name) / Category / Date / Amount (right-aligned).
`summary-strip.js` stays deleted; `.dashboard__kpis` CSS removed. The
Safe-to-Spend value is still `getSafeToSpend(state).safeToSpendCents`
verbatim — no rename, no new calc; every figure is an existing selector.
`npm run build` + 527 tests pass; smoke-tested grid structure (3 + 2
cells), hero wired to `getSafeToSpend`, stat cards wired, the 12-month
grouped chart with real receipts/expenses, and the mini-table columns;
eyeballed the 560×280 chart SVG for label collisions / overflow (none).
`docs/ARCHITECTURE.md` updated to match.

**Two follow-up dashboard tweaks, at the user's request — layout/CSS
only, no data logic, no schema change, 527 tests still pass.**
- **The Income-vs-Expenses chart moved into the top region** to fill the
  empty space beneath Total Expenses / Total Savings, instead of being
  its own full-width row below. It's now the 4th child of
  `.dashboard__top`; at `>=1024px` `src/styles/responsive.css` places
  Safe-to-Spend in column 1 spanning both rows, the two stat cards
  top-right, and the chart across columns 2–3 on row 2; at `>=600px`
  Safe-to-Spend and the chart each span the full width with the stat
  cards paired between them; mobile stacks all four. Its series colours
  changed from `--color-accent` / `--color-status-caution-text` to two
  new dedicated tokens, `--color-chart-income` (teal) and
  `--color-chart-expense` (coral) in `src/styles/base.css` — a distinct
  dataviz series pair (the `dataviz` skill treats income/expense as two
  categorical series), light `#0f9b9b`/`#d4663f` and dark
  `#1f9d9d`/`#d67854`, each run through the skill's `validate_palette.js`
  (all checks pass, both themes — chroma, CVD ΔE, contrast); the chart
  already ships a legend so identity is never colour-alone.
- **Income / expense / debt log entries now render as individual cards**
  — a hairline `--color-border`, `--shadow-sm` (the existing soft, low-
  opacity token — not a hard drop shadow), `--radius-md`, `--space-4`
  padding, `--space-3` gap between them — instead of divider-separated
  rows. Done with a `.money-list--cards` modifier on the `<ul>`
  (`src/ui/screens/income-view.js`, `src/ui/components/expenses-section.js`
  non-compact list, `src/ui/components/debts-section.js`'s "All debts"
  popup) plus the matching treatment applied directly to `.debt-row`
  (the Debts view's own list uses its own markup, not `.money-item`).
  Container styling only — every row's existing content (amount,
  category, date, actions) is unchanged. Deliberately scoped to these
  three logs; Bills / Categories / Inbox lists (also `.money-item`) keep
  their divider-row style. `docs/ARCHITECTURE.md` dashboard/charts lines
  updated in the same change.

**Dashboard top restructured into two rows, at the user's request —
again layout/CSS only, no data logic, no schema change, 527 tests still
pass.** The Safe-to-Spend hero used to sit in the top grid as a tall
left card spanning two rows, with the chart to its right — which left
dead space under the hero once its content ended.
- **A third stat card, "Total debt to pay"** (`getTotalDebtCents` — the
  already-existing selector summing every debt's `currentBalanceCents`),
  built with the same `renderStatCard` as Total Expenses / Total Savings
  (same icon treatment, no delta chip — like Savings). The dashboard now
  imports `getTotalDebtCents` from `src/modules/debts/index.js`.
- **New layout**: `src/ui/screens/dashboard.js` builds three row
  wrappers — `.dashboard__top` (the three stat cards, `repeat(3, 1fr)`
  at `>=600px`), `.dashboard__mid` (the Safe-to-Spend hero + the
  Income-vs-Expenses chart, `1fr 1.4fr` side by side at `>=1024px`,
  stacked full-width below), `.dashboard__bottom` (unchanged: Budget |
  Recent Expenses). The old explicit `grid-row`/`grid-column` placement
  of the hero + 4 children in `.dashboard__top` is gone.
- **No dead space in `.dashboard__mid`**: it's `align-items: stretch`,
  so the chart's taller natural height drives the row and the hero
  stretches to match; `.hero__cta { margin-top: auto }` (was
  `var(--space-2)`) pins the "+ Add expense" button and the disclaimer
  to the bottom of the hero card instead of leaving them floating
  mid-card. With no free space (mobile / stacked) `auto` collapses to 0
  and the flex `gap` still separates them.
- `docs/ARCHITECTURE.md`'s dashboard + stat-card.js lines updated in the
  same change.

**Income / Expenses / Debts views: dropped the outer container card, at
the user's request ("i don't want a global card that holds all the
cards, just cards") — layout/CSS only, no data logic, 527 tests still
pass.** Those three views used to render their entry cards
(`money-list--cards` rows / `.debt-row`) inside a wrapping
`<section class="card">` with its own section heading — a card holding
cards. Now the entries sit directly on the page in a bare `.view-stack`:
- `src/ui/screens/income-view.js` — no wrapper `section.card`, and the
  redundant "Your income" `sectionHeading` removed (the view header's
  `<h1>Income</h1>` already names the page); `sectionHeading` import
  dropped.
- `src/ui/components/expenses-section.js` — the **non-compact** return
  (Expenses view only) is now `el('div', { class: 'view-stack' },
  [total, list])`, no card, no "Expenses" heading. The `compact`
  (dashboard preview) path is unchanged — still a `.card` with its
  heading + "View all →".
- `src/ui/components/debts-section.js` — split the return by mode: the
  `compact` path still returns the `.card` (API kept even though the
  dashboard no longer renders it); the **non-compact** path is a
  `.view-stack` with the "Manage debts" link in a new trailing-aligned
  `.view-actions` row (its only home now that there's no card header),
  then the bare `.debt-list`, then its popups. "Debt overview" heading
  dropped.
- New `.view-actions` util in `src/styles/components.css` (flex,
  `justify-content: flex-end`), right after `.view-stack`.
- Not touched in that pass: Bills view and Categories view.
  `docs/ARCHITECTURE.md` screens/components lines updated in the same
  change.

**Then the same for the Bills view, at the user's request ("do the same
for bills").** `src/ui/components/bills-due-soon.js`'s return is now
split by mode like `debts-section.js`: `compact` (dashboard summary)
still returns the amber `.card.card--quiet.bills-due-soon` with its
heading + "View all bills →"; the **non-compact** Bills view returns a
`.view-stack` — a `.view-actions` row holding the "Manage bills" link,
then the glance list with a new `.bills-due-soon__list--cards` modifier
(each `.bills-due-soon__row` becomes a `--color-surface` /
`--color-border` / `--shadow-sm` / `--radius-md` card, overriding the
amber hairline-divider rule), then the "Manage bills" popup. The "Bills
due soon" heading and the amber `.bills-due-soon` card tint are gone on
that view (the tint was a whole-card status treatment; individual
surface cards match Income / Expenses / Debts). The capped-at-4
glance-list behaviour and the full CRUD living in the "Manage bills"
popup are unchanged — not in scope. Categories view still untouched
(divider rows, its own "Edit categories" popup).

**Debts view gained a "Still owed" summary card, at the user's request
("add a card on the debt view to give [a] global number") — layout only,
no data logic, 527 tests still pass.** `src/ui/components/stat-card.js`
gained an optional `note` param (a plain supporting line under the
value, used instead of a `delta` chip). `renderDebtsSection`'s
non-`compact` return now leads with `renderStillOwedCard(state)` — a
`renderStatCard({ icon: 'credit-card', label: 'Still owed', value:
formatCents(getTotalDebtCents(state)), note })`, where `note` is "Across
N debt(s)" when anything is owed or "Nothing owed here — add one only if
you want a payoff plan." when not. When there are no debts the card's
own note is the empty state, so the debt list's "No debts tracked yet…"
placeholder is dropped (`debts.length > 0 ? body : null`) to avoid two
empty messages. `getTotalDebtCents` (already existed — sums every debt's
`currentBalanceCents`) is now also imported by `debts-section.js`; the
paid-off count uses the already-imported `getDebtProgress`. New
`.stat-card__note` rule in `src/styles/components.css`.
`docs/ARCHITECTURE.md` stat-card / debts-section lines updated in the
same change.

**Every money view now leads with a tinted summary card, at the user's
request ("do the same for all money tabs, but … different colours than
white") — layout only, no data logic, 527 tests still pass.** Extends
the Debts "Still owed" card from the previous change to all four:
- `src/ui/components/stat-card.js` gained a `tone` param
  ('neutral'|'positive'|'caution'|'attention'); non-neutral adds a
  `.stat-card--<tone>` class that fills the card with the matching
  `--color-status-*-bg` and drops the border (same treatment
  `.upcoming-income` / `.bills-due-soon` already use), and derives the
  icon colour from `--color-status-<tone>-text` unless `iconColor` is
  passed. New `.stat-card--*` rules + a `.view-stack > .card {
  margin-bottom: 0 }` rule (so the card + list spacing is the stack's
  `gap` alone, not doubled) in `src/styles/components.css`.
- **Income** (`src/ui/screens/income-view.js`, new
  `renderIncomeSummaryCard`) — "Received this month", `tone: 'positive'`
  (teal): sum of `IncomeReceipts` dated in the current calendar month
  (`getIncomeReceiptsForPeriod` + `getIncomeReceiptsTotalCents`), note =
  payment count / a "mark income received when it lands" hint / an "add
  one" hint.
- **Expenses** (`src/ui/components/expenses-section.js` non-compact, new
  `summaryCard`) — "Spent · <selected period label>", `tone: 'caution'`
  (amber): `getExpensesTotalCents(allForPeriod)` for the header bar's
  period (`getPeriodLabel` now imported from `period-selector.js`), note
  = expense count. **Replaced** the old plain `.expenses-filter__total`
  "Total: …" line on that view (the class stays — still used by the
  compact/dashboard path).
- **Bills** (`src/ui/components/bills-due-soon.js` non-compact, new
  `renderUnpaidBillsCard`) — "Unpaid bills", `tone: 'attention'` (red):
  `getUpcomingBillsTotalCents` + a count of active unpaid bills.
- **Debts** (`src/ui/components/debts-section.js`) — the existing
  `renderStillOwedCard` just gained `tone: 'attention'`.
- Colour split: Income teal (money in), Expenses amber (money out this
  period), Bills + Debts red (what you owe). `docs/ARCHITECTURE.md`
  stat-card line updated in the same change.

**Summary cards lifted + every money record made edit/delete-consistent
with Income, at the user's request ("make the card look more live with a
shadow" + "for the record of bill, debt, expenses … make them look like
income — a pen to edit, and trash to delete"). Layout only, 527 tests
still pass.**
- **Shadow**: the tinted `.stat-card--positive/caution/attention`
  summary cards now carry `box-shadow: var(--shadow-md)` (was inheriting
  the plain `.card` `--shadow-sm`), so each tab's headline number visibly
  lifts.
- **Expenses rows** (`src/ui/components/expenses-section.js` non-compact):
  the two `btn btn--secondary btn--small` "Edit" / "Delete" text buttons
  → a pencil + trash `iconButton` pair (`tone: 'attention'` on trash),
  matching `incomeViewRow`.
- **Bills view** (`src/ui/components/bills-due-soon.js`): the non-compact
  Bills view no longer shows the capped "due soon" glance list + a
  "Manage bills" popup — it now renders **every** bill (unpaid & soonest-
  due first, `billSortOrder`) as a `manageBillRow` in a
  `money-list--cards`: Mark paid/unpaid + pencil (inline edit) + trash,
  exactly the Income shape. `renderManageBillsPopup` / `billsManageOpen`
  / the `renderPopup` import / the dead `.bills-due-soon__list--cards`
  CSS are deleted. The `compact` branch (glance list + debt-payment
  rows + "View all bills →", currently unrendered — nothing imports
  bills-due-soon.js in compact mode) is untouched. **Consequence worth
  noting**: the "a debt's minimum payment shows as a row in the bills
  list" integration (docs/PRODUCT.md §8) now only exists in that unused
  compact branch — the Bills view is bills-only; debts are managed on
  the Debts view.
- **Debts view** (`src/ui/components/debts-section.js`): each `.debt-row`
  (non-compact) gained a pencil (inline `renderDebtForm`) + trash beside
  its "Make payment" button; `.debt-row__actions` became a
  `flex/wrap/gap` row. `manageDebtRow` / `renderManageDebtsPopup` /
  `debtsManageOpen` and the "Manage debts" `.view-actions` link are
  deleted — editing/deleting is inline per row now.
- All four views are now structurally identical: tinted summary card →
  `.view-stack` of record cards, each with a primary toggle + pencil +
  trash. `docs/ARCHITECTURE.md` updated in the same change.

**"+ Add expense" moved off the Safe-to-Spend hero card to the top of
the dashboard, at the user's request. Layout only, 527 tests still
pass.** `src/ui/components/safe-to-spend-hero.js` is now pure display —
the `.hero__cta` button, its popup, the `expenseFormOpen` flag, and the
`renderExpenseForm` / `renderPopup` / `createExpenseAction` imports are
gone; `renderSafeToSpendHero(result)` takes no options now (was
`(result, { state, dispatch, requestRender })`). `src/ui/screens/
dashboard.js` owns the button + popup instead, passing it as
`renderAppFrame`'s `titleAction` (top-right of the greeting, same
pattern as the Income/Expenses/Bills/Debts views' "+ Add X") with a
module-level `dashboardAddExpenseOpen` flag (the name is prefixed —
`expenses-view.js` already has `addExpenseOpen`, and the bundler shares
one scope; caught by `build.test.js`). CSS: `.hero__cta` / `.hero__cta
.btn` rules deleted; the `margin-top: auto` bottom-pin moved from
`.hero__cta` to `.hero__disclaimer` (now the hero's last child) so the
disclaimer still sits at the card's bottom in the `.dashboard__mid`
matched-height layout. `docs/ARCHITECTURE.md` dashboard line updated.

**Fixed: the global period filter's label was stuck on "This month" on
the Expenses view.** Reported as "the filter is not working across the
whole app". Root cause: `src/ui/components/expenses-section.js` called
`getPeriodLabel(period.period)` — passing the bare period *string* where
`getPeriodLabel` reads `value?.period` off an *object*, so it always hit
the `?? 'This month'` fallback. The underlying data *was* filtering
correctly (list rows + the "Spent" total both tracked the selected
period); only the card's title didn't move, which read as "nothing is
filtering". Fixed the call site to pass the whole `period` object, and
hardened `getPeriodLabel` to accept either the `{period, from, to}`
object *or* a bare string. Verified across `week`/`month`/`lastMonth`/
`all`: Expenses view (label + value + row count) and Budget view (Money
in/out + heading) both track the filter, as does the Dashboard's Recent
Expenses table. The Income / Bills / Debts summary cards are
deliberately *not* period-scoped — "Received this month", "Unpaid
bills", "Still owed" are current snapshots, not time-window lenses.

**The global period filter now drives the summary cards on Income,
Bills and the Dashboard too (it already drove Expenses + Budget), at the
user's request.** Each is now derived from that tab's real dated log,
range-resolved via `resolvePeriodRange(getSelectedPeriod())`:
- **Dashboard** "Total expenses" stat card
  (`src/ui/screens/dashboard.js`): was hard-wired to the current
  calendar month (`getExpensesMonthOverMonth`); now
  `getExpensesTotalCents(getExpensesForPeriod(…, selected period))`,
  label `Total expenses · <period>`. The month-over-month delta chip is
  kept only when the period is "This month" (it compares this vs. last
  calendar month — meaningless for other ranges). "Total savings" /
  "Total debt to pay" stay current-state totals.
- **Income view** (`renderIncomeSummaryCard`): was "Received this month"
  hard-wired to the calendar month; now "Received · <period>" from
  `getIncomeReceiptsForPeriod` over the selected range.
- **Bills view** (`renderUnpaidBillsCard` → renamed
  `renderBillsSummaryCard`): was "Unpaid bills" (a current total); now
  "Bills paid · <period>" from `getBillPaymentsForPeriod`, with the
  still-outstanding total (`getUpcomingBillsTotalCents`) kept visible as
  the card's note. This makes Income/Expenses/Bills a consistent set —
  each = real logged money movement (`IncomeReceipt` / `Expense` /
  `BillPayment`) through that category during the window.
- **Not period-scoped, by design**: the Income and Bills *lists*
  themselves (an income/bill is a forward-looking schedule, not a dated
  event, so "incomes in June" isn't well-defined) and the Debts "Still
  owed" card (an outstanding balance has no time dimension). The
  Dashboard's Income-vs-Expenses chart stays a fixed 12-month calendar-
  year trend.
- Verified across week/month/lastMonth/all that every one of the four
  cards' label + value + note track the selection. `docs/ARCHITECTURE.md`
  stat-card line updated.

**The "Budget" tab was reworked into a "Goals" tab (savings goals), at
the user's explicit and detailed request — schemaVersion bumped 9 → 10.**
Two conflicts were flagged and resolved via `AskUserQuestion` before any
code: (1) `docs/PRODUCT.md` §5 / this file's own scope list literally say
"no goals module" (from the retired ADHD Life Planner) — the user
confirmed these are *savings* goals, a budgeting concept, and the docs
were updated to carve that out (scope line above, `docs/PRODUCT.md`
§4 item 17 / §5); (2) how goals affect Safe-to-Spend — the user chose
**protected, like Savings** (not informational like Debts/Categories).
- **New `src/modules/goals/`** (`actions`/`reducer`/`selectors`/`index`,
  standard list-entity shape via `src/core/list-entity.js`). `Goal` =
  `{ id: 'g…', name, targetCents, savedCents, monthlyPaceCents|null,
  createdAt, updatedAt }`. `getGoalProgress` derives percent / remaining
  / `isReached` / `monthsToGo` (`ceil(remaining / pace)`);
  `getTotalGoalsSavedCents` is the protected sum. Plain generic routing
  in `src/main.js`'s `SLICE_REDUCERS` — **no** cross-slice effect:
  creating a goal never debits Current Balance.
- **Schema v9 → v10** (`migrateV9ToV10` — purely additive `goals: []`;
  added to `ARRAY_COLLECTION_KEYS` + `createEmptyState`). `docs/DATA-MODEL.md`
  ("Goal" entity, root shape, §7). The pre-pivot v2 shape also had a
  `goals` key (life-planning) — v2→v3 still discards that; v9→v10
  re-adds `goals` as the unrelated savings collection. `schema.test.js`'s
  v2→v3 assertion updated to expect `goals: []` (old contents dropped,
  new empty collection present).
- **Safe-to-Spend formula changed**: `sumGoalsSaved(state.goals)` (raw
  read, no import from `src/modules/goals/`, per-item
  `isValidAmountCents` guard) is a new `goalsSavedCents` term folded into
  `totalCommittedCents = plannedExpensesCents + savingsAllocationCents +
  goalsSavedCents`, and returned on the result. `docs/SAFE-TO-SPEND.md`
  §2 / new §3d / §11b / §13 updated. `tests/unit/safe-to-spend.test.js`
  §4b added (subtracted once, stacks with Savings, survives a corrupted
  entry). Savings + Goals are two separate buckets — double-counting if
  the user enters the same dollars in both is their call, explicitly
  accepted.
- **`#budget` route → `#goals`** (`src/ui/router.js` `APP_VIEWS`; a
  `budget → goals` alias so old bookmarks resolve). `src/ui/shell.js`
  `VIEW_RENDERERS`. Sidebar item `{ id:'goals', label:'Goals',
  iconName:'target' }`.
- **New `src/ui/screens/goals-view.js`** (replaces `budget-view.js`,
  deleted). Self-contained like `income-view.js`: `renderGoalForm`
  (Name / Amount needed / Already put away / Pace — buttons "Add this
  goal" + "Cancel", per the spec), a `.goal-list` of `.goal-row` cards
  (same card treatment as `.debt-row`: border, `--shadow-sm`,
  `--radius-md`), each with name, an 8px pill progress bar (hero-styled
  fill on the `--progress-track` token), "$X of $Y", the pace line,
  "Reached 🎉" state, and a pencil (inline edit) + trash — exactly the
  Debts-view row shape. "+ Add a goal" is the view-header `titleAction`.
- **Current Balance + Savings moved to a compact sidebar footer card**
  (`renderSidebarFooter` in `src/ui/components/sidebar.js`): two rows
  ("Current balance $X ✏️", "Savings $Y ✏️"), pushed to the bottom of
  the rail (`margin-top: auto`), hidden on the collapsed icon rail. The
  pencils open a small `renderEditTotalForm` popup (Current Balance:
  `parseBalanceToCents`, negative allowed; Savings: direct set-total).
  `renderSidebar` now takes `state`/`dispatch`/`requestRender` and
  returns `{ nav, scrim, editPopup }` — the popup is returned separately
  (not nested in `<nav>`, which is `transform`ed on the mobile drawer and
  would clip a `position: fixed` backdrop); `app-frame.js` places it at
  the screen root. **Trade-off flagged**: Savings' earlier *additive*
  "+Add contribution" flow is gone with the Budget view — the sidebar
  pencil is a direct set-total only (keeps it compact). Easy to restore
  if wanted. (Footer card restyled right after, per a screenshot: a
  tinted `--color-accent-muted` panel instead of a plain bordered one,
  each figure now label-above / amount-below via `.sidebar__stat` +
  `.sidebar__stat-line`, and the edit pencil is a small borderless
  `.sidebar__stat-edit` (24px) rather than the full 44px `.icon-btn`.)
- **Removed as now-unused**: `src/ui/screens/budget-view.js`,
  `src/ui/components/right-now-section.js` (the "Money in / Money out
  this period" card + Safe-to-Spend line the Budget tab showed — the user
  chose to drop these from the Goals tab; that period info is already on
  the Income "Received" / Expenses "Spent" cards, and the Safe-to-Spend
  number is on the dashboard), and the `.right-now*` CSS. `renderEditTotalForm`
  (same file as the also-now-unused `renderSingleValueSection`) is kept —
  the sidebar uses it.
- 546/546 tests pass (19 new: `goals.test.js`, the `schema.test.js`
  v9→v10 block, `safe-to-spend.test.js` §4b). Build passes.
  `docs/ARCHITECTURE.md` (module tree, screens, sidebar) updated.

**The Safe-to-Spend hero gained a "How is this worked out?" disclosure,
at the user's request.** `src/ui/components/safe-to-spend-hero.js`'s new
`renderBreakdown(result)` — a native collapsed `<details>` under the
committed-vs-available bar — lists Current balance, then each committed
term that's `> 0` (Planned expenses / Savings / Savings goals, each with
a leading "−"), a divider, and "Estimated safe to spend" (the result).
Just the numbers that go into the calc — no explanatory prose (an
earlier draft's "unpaid bills aren't counted" note was removed at the
user's request). **Every figure is read straight off `getSafeToSpend`'s
result** (`currentBalanceCents`, `plannedExpensesCents`,
`savingsAllocationCents`, `goalsSavedCents`, `safeToSpendCents`) — the
"−" is a label, no arithmetic in `src/ui/`
(CLAUDE.md's "the hero never recomputes the math" rule holds). Native
`<details>` (no JS/state) — its open state resets only when the hero
re-renders from a store change, which is fine for a read-only panel.
New `.hero__breakdown*` CSS. 546/546 tests pass (display-only, no logic
touched).

**The Safe-to-Spend hero was reframed around "make this last until the
next paycheck", and unpaid bills due before payday are subtracted again
— a formula change plus a display rework, at the user's explicit request.
Three conflicts with prior decisions were flagged via `AskUserQuestion`
first.**
- **Bills back in the formula (reverses an earlier documented
  decision).** For a stretch (the entries between Debt Tracking and
  Goals above) unpaid bills were display-only — `upcomingBillsCents`
  computed but excluded from `safeToSpendCents`, so a bill only moved the
  number via the "Mark paid" balance debit. The user asked for the
  opposite; confirmed via `AskUserQuestion`. Now
  `totalCommittedCents = upcomingBillsCents + plannedExpensesCents +
  savingsAllocationCents + goalsSavedCents` in
  `src/modules/safe-to-spend/calculation.js`. "Mark paid" still debits
  Current Balance and drops the bill from `upcomingBillsCents` → the
  amount moves from committed to already-spent, **net zero on
  Safe-to-Spend** (this is the original pre-exclusion behaviour). `docs/
  SAFE-TO-SPEND.md` §2 (rewritten, with a history note), §7 (rewritten —
  no longer a "superseded design" section), §11b, §12, §13; `docs/
  PRODUCT.md` §6 (illustrative example redrawn to $750 with bills
  subtracted); `docs/DATA-MODEL.md` §3a; `src/modules/bills/
  balance-effect.js` header — all updated. **~16 tests rewritten** across
  `safe-to-spend.test.js`, `dashboard-integration.test.js`,
  `qa-user-flows.test.js` (the same set that was rewritten the *other*
  way when bills were first excluded — this reverts those). 546/546 pass.
- **Total cushion, not a daily allowance** (the user's other flagged
  choice). The headline stays `safeToSpendCents` — the full amount that
  has to stretch to the next payday; it doesn't tick down per day.
  `daysUntilPayday` / `dailyAllowanceCents` are still computed, unused by
  the hero.
- **Label: "Estimated safe to spend" → "Safe to spend today"** (the user
  picked this over "Estimated safe to spend today"). `SAFE_TO_SPEND_LABEL`
  in `src/modules/safe-to-spend/wording.js`. The "planning estimate, not
  a verified bank figure" framing moved from the label into the new
  subtext + the unchanged `PLANNING_DISCLAIMER`. `docs/SAFE-TO-SPEND.md`
  §12 updated. `SAFE_TO_SPEND_LABEL` is also the breakdown's total-row
  label, so that updated too.
- **New subtext line** under the amount (`src/ui/components/
  safe-to-spend-hero.js`, copy in `wording.js`'s `getSafeToSpendSubtext`):
  *"of today's starting $X · $X has to last until Mon 31 Aug"* — both
  blanks are `safeToSpendCents` (the cushion doesn't decrease per day, so
  "today's starting" === the headline). Payday date from
  `result.nextPaydayDate` via new `formatShortWeekdayDate` in
  `src/core/date.js` (pinned `en-GB`, "Mon 31 Aug"). No payday set → "of
  today's starting $X — add an income date to see how long this needs to
  last".
- **Explanatory paragraph** reworded for payday framing (new
  `SAFE_TO_SPEND_POSITIVE_DESCRIPTION`; the negative/zero
  `getSafeToSpendMessage` copy too).
- **"How is this worked out?" breakdown** (from the previous change)
  gained a "Bills due before payday −$X" row now that bills are a
  committed term.
- **"+ Add expense" stays at the top of the dashboard** (view-header
  `titleAction`), where the user moved it a few messages ago —
  "keep… same placement as before" read as "don't move it again", not
  "put it back on the card".
- New `.hero__subtext` CSS. Kept: icon, disclaimer, progress bar,
  placement of everything.

**Two small follow-ups, at the user's request — layout/CSS only, 549
tests still pass.**
- **Sidebar footer card icons**: the Current Balance and Savings rows in
  `renderSidebarFooter` (`src/ui/components/sidebar.js`) each got a small
  13px icon (wallet / target) beside the label; `.sidebar__stat-label`
  became a flex row for the icon + text.
- **Categories view: one card per category.** `category-budgets-section.js`
  non-`compact` now matches the Bills / Debts / Goals views — no outer
  container card, each category is its own `.category-row` card
  (`.category-list--cards` CSS: border, `--shadow-sm`, `--radius-md`,
  padding) with a pencil (inline edit via `editingId` — the existing
  `renderCategoryBudgetForm`, now exported) + trash. `categories-view.js`
  owns a "+ Add category" view-header `titleAction` opening that form in
  a popup; the old "Edit categories" popup / `renderManagePopup` /
  `manageOpen` are deleted. The `compact` dashboard "Budget progress"
  card is untouched (one `.card`, plain `.category-list`, read-only).
  `docs/ARCHITECTURE.md` updated.
- **Then, per request, the per-card edit/delete buttons moved to the top
  line** on Categories, Goals, and Debts (were stacked at the bottom
  under the progress bar). Each `.category-row` / `.goal-row` /
  `.debt-row` is now a flex row `[.<x>-row__body (flex:1 column) |
  .<x>-row__actions (edit + trash, `flex-shrink: 0`, top-aligned)]`; a
  `.<x>-row--editing { display: block }` modifier keeps the inline edit
  form filling the card. Debts' "Make payment" button stays inside the
  body (bottom of the content column, `.debt-row__pay`) — only the
  edit/trash icons moved.

**Every per-record edit pencil now opens a popup instead of expanding an
inline form, at the user's request — 549 tests still pass.** Income /
Expenses / Bills / Debts / Goals / Categories: the row renderers lost
their `if (id === editing<X>Id) return <inline form>` branch; the
view/section now builds an `editPopup` (`renderPopup` + the same shared
`render<X>Form`, `onCancel`/`onClose` = clear the flag) keyed off
`records.find(editing<X>Id)`, appended to the returned tree — the exact
pattern the "+ Add X" popups and the sidebar balance/savings pencils
already used. `renderPopup` re-imported into `expenses-section.js` /
`bills-due-soon.js` / `category-budgets-section.js` (it had been removed
when their "Manage …" popups went away). Dead `.money-item--editing` /
`.debt-row--editing` / `.goal-row--editing` CSS removed.

**Settings-view polish from screenshots — CSS + one component tweak, 549
tests still pass.**
- **Form `<select>`s got more space**: `select.field__input` now has
  `min-height: calc(--tap-target-min + --space-2)` (~52px) and
  `padding-block: --space-3` — roomier than a text input. Affects the
  Settings currency picker and every form select (debt/income/bill
  frequency & recurrence), consistently.
- **"Your name" card**: the bold `Display name` field label is gone,
  replaced by a `.section-description` comment ("Optional — shown in the
  dashboard greeting, …"), matching the Theme / Currency cards' pattern
  (`src/ui/screens/settings-view.js` `nameSection` — the input is now a
  bare `.money-form` child, no `.field` wrapper). The divider line above
  it (`.money-form`'s `border-top`, which separates a form from a modal
  header elsewhere) is removed in Settings via `.settings-view
  .money-form { padding-top: 0; border-top: 0 }`.
- **Onboarding spacing (from a screenshot)**: `select.field__input` also
  got `padding-inline: --space-4` (was `--space-3`) so a select's value
  isn't jammed against the border / native arrow (the payday step's "How
  often"). And `.screen--onboarding > .card > .btn:last-child` /
  `.link-button:last-child` get `margin-top: --space-4` — on the payday /
  bills steps "Continue" is a bare button rendered as a card sibling
  right after the add-form and was sitting almost flush against the
  form's own "Add another …" button.

**Two Safe-to-Spend reverts, at the user's direct request — 549 tests
still pass.**
- **Unpaid bills no longer reduce Safe-to-Spend** (again). Reverts the
  "bills back in the formula" change from a few messages ago.
  `totalCommittedCents = plannedExpensesCents + savingsAllocationCents +
  goalsSavedCents` — `upcomingBillsCents` is display-only once more. A
  bill only moves the number via the "Mark paid" Current Balance debit
  (`src/modules/bills/balance-effect.js` — now "the only way", again).
  Symmetric with Income. **~14 tests** across `safe-to-spend.test.js` /
  `dashboard-integration.test.js` / `qa-user-flows.test.js` flipped back
  (the same set that has now been flipped three times — bills in → out →
  in → out). The hero's "How is this worked out?" breakdown lost its
  "Bills due before payday" row; `wording.js` copy
  (`getSafeToSpendMessage`, `SAFE_TO_SPEND_POSITIVE_DESCRIPTION`) dropped
  its "bills" mentions. The payday-based label/subtext ("Safe to spend
  today", "$X has to last until Mon 31 Aug") **stays** — it just doesn't
  imply unpaid bills are subtracted. `docs/SAFE-TO-SPEND.md` §2/§7/§11b/
  §13, `docs/PRODUCT.md` §6 (example back to $1,950, bills shown "for
  awareness"), `docs/DATA-MODEL.md` §3a all updated.
- **Onboarding no longer folds savings into Current Balance.**
  `renderBasicsStep` (`src/ui/screens/onboarding.js`) now stores
  `enteredBalance` and `enteredSavings` as-is — dropped the
  `balanceCents + savingsCents` sum that existed so Safe-to-Spend netted
  back to the entered balance. Current Balance is now just the account
  figure everywhere, savings a separate protected term. Hint copy +
  `docs/DATA-MODEL.md` §3a's onboarding-exception paragraph updated (it's
  no longer an exception).

**Safe-to-Spend is now floored at $0, at the user's direct request ("set
the floor to 0") — 550 tests pass.** Reported from a screenshot showing a
`-$10,000.00` headline (balance $1,000, committed $11,000). This reverses
`docs/SAFE-TO-SPEND.md` §10's prior "the engine does not clamp it to
zero" decision.
- `src/modules/safe-to-spend/calculation.js`: `netAfterCommittedCents =
  currentBalanceCents − totalCommittedCents` (raw, can be negative) is a
  new returned field; `safeToSpendCents = Math.max(0,
  netAfterCommittedCents)` — never negative. `dailyAllowanceCents`
  derives from the floored value, so it's now always `>= 0` (was
  documented "can be negative"). `isNegative` **redefined**:
  `netAfterCommittedCents < 0` (i.e. "over-committed / the result was
  floored") instead of `safeToSpendCents < 0`. The hero keys its
  attention styling (`$0.00` in the warning colour, `--negative` progress
  track) off `isNegative`, so no hero style change was needed.
- `src/modules/safe-to-spend/wording.js`: `getSafeToSpendMessage` reads
  `netAfterCommittedCents` (not `safeToSpendCents`) for the
  over-committed branch + its overage amount. `getSafeToSpendSubtext`
  reworded to "`$X of your $Y balance has to last until Mon 31 Aug`",
  where `$Y` is the **raw current balance** — this is the "don't reduce
  the saving from the current balance" ask from the same thread: the
  balance named in the subtext is never itself netted down (it used to
  show `safeToSpendCents` in that slot).
- `src/ui/components/safe-to-spend-hero.js`: `renderBreakdown` — when
  `isNegative`, shows an "After everything committed −$10,000.00" sub-row
  (so the listed subtractions still add up) then a "Shown as (never below
  $0) $0.00" total row; the normal case is unchanged (single "Safe to
  spend today" total row).
- Docs updated in the same change: `docs/SAFE-TO-SPEND.md` §2 (formula
  block now shows `max(0, netAfterCommitted)`), §10 (rewritten — floor +
  the `netAfterCommittedCents`/`isNegative`/message mechanism, with the
  reversal noted), §11 (`dailyAllowanceCents` always `>= 0`), §12
  (subtext copy), §13 (result object — `netAfterCommittedCents` added,
  `safeToSpendCents`/`dailyAllowanceCents`/`isNegative` redescribed);
  `docs/PRODUCT.md` §6 (a "never shows below $0" paragraph).
- Tests: `safe-to-spend.test.js` §12 retitled "over-committed
  Safe-to-Spend (floored at 0)" — asserts `safeToSpendCents: 0` +
  `netAfterCommittedCents: -40000` + `isNegative: true`, plus a new
  "daily allowance never negative" case; §14 decimal test now checks
  `netAfterCommittedCents: -10`. `expenses-persistence.test.js`'s
  "expense larger than balance" test asserts `safeToSpendCents: 0` +
  `netAfterCommittedCents: -4000` (the *balance* itself, `-4000`, is
  still not clamped — that's the test's actual point). 549 → 550 tests.

**The flat Savings figure no longer reduces Safe-to-Spend — it's a
separate-account balance now, and "Add to savings" is a real transfer
that debits Current Balance. At the user's explicit request, confirmed
via `AskUserQuestion`; Goals were deliberately left as a subtraction.
554 tests pass.** Reverses `docs/PRODUCT.md` §4 item 6 / `docs/SAFE-TO-SPEND.md`
§2/§3d's long-standing "Savings is money set aside and excluded from
what's safe to spend" (i.e. subtracted). The user's model: the $12,000
in a savings account was never inside the $1,000 checking balance, so
subtracting it (→ deeply negative, then floored to $0 last turn) is
wrong; only *moving* money into savings should cost anything.
- **`src/modules/safe-to-spend/calculation.js`**: `totalCommittedCents =
  plannedExpensesCents + goalsSavedCents` — `savingsAllocationCents`
  removed. Still returned on the result, now **display-only** (like
  `upcomingBillsCents`). `goalsSavedCents` stays a subtracted term.
- **`src/main.js`**: new cross-slice special case — `budget/add-to-savings`
  now raises `savingsAllocationCents` **and** debits `currentBalanceCents`
  by the same amount, atomically (the 5th use of the documented
  cross-slice-balance exception, alongside Expense / Income mark-received
  / Bill mark-paid / Debt payment). `budget/set` (correcting either
  figure, used by onboarding + the sidebar pencil) has **no** balance
  effect — falls through to generic routing unchanged. `budgetReducer`
  itself is untouched.
- **UI**: `src/ui/components/sidebar.js`'s footer Savings row gained a
  "+" `iconBtn` ("Add to savings") next to the existing edit pencil;
  `renderSidebarEditPopup` handles a new `sidebarEditTarget` value
  `'savings-add'` — a popup using `renderEditTotalForm` with two new
  optional params (`submitLabel`, `startEmpty`) added to that helper so
  the field starts blank and the button reads "Add". New `plus` glyph in
  `icons.js`. Onboarding basics-step hint reworded ("separate savings
  account… won't be subtracted from your safe-to-spend").
- **`src/modules/safe-to-spend/wording.js`**: over-committed / zero
  messages dropped "savings" (now "planned expenses and savings goals");
  `SAFE_TO_SPEND_POSITIVE_DESCRIPTION` likewise. The hero breakdown
  (`safe-to-spend-hero.js` `renderBreakdown`) no longer lists a "Savings"
  −row.
- **Docs**: `docs/SAFE-TO-SPEND.md` §2 (Savings dropped from the formula
  + a "separate account" explainer + history), §3d (goals ≠ savings now),
  §9 (rewritten — "a separate-account balance, not a subtraction";
  set vs. add-to-savings; the transfer's balance debit), §11b, §13
  (`savingsAllocationCents` display-only); `docs/PRODUCT.md` §3/§4 item 6/
  §6 (example → $2,150, savings shown as a separate "NOT subtracted"
  line); `docs/DATA-MODEL.md` Budget entity + §3a (add-to-savings is the
  4th auto-balance effect; the "Current Balance and Savings are
  independent inputs" paragraph rewritten — savings is no longer a
  subtracted bucket); `docs/ARCHITECTURE.md` §6 tree + §7 (now "five
  times").
- **Tests**: `safe-to-spend.test.js` §4 retitled "savings figure
  (display-only — NOT subtracted)" + §4b / §14 / §16a / the PRODUCT.md §6
  cross-check ($1,950 → $2,150) rewritten; `dashboard-integration.test.js`
  — "changing savings allocation reduces the result" split into
  "correcting the figure does NOT" + "addToSavingsAction DOES (debits
  balance)", "every area combined" expected recomputed; 3 new
  `main.test.js` rootReducer tests for `budget/add-to-savings` (transfer,
  vs. `budget/set` no-op, rejected-amount no-op). 551 → 554.

**Hero copy trimmed, "How is this worked out?" expanded, and an
onboarding debts step added — all at the user's request. 554 tests pass
(no logic touched — display + onboarding composition only).**
- **Removed** the standing positive-case sentence
  (`SAFE_TO_SPEND_POSITIVE_DESCRIPTION`, "This is what's left to last
  until your next payday…"). `src/modules/safe-to-spend/wording.js` no
  longer exports it; `index.js` re-export dropped;
  `safe-to-spend-hero.js` renders the `.hero__description` paragraph only
  when `getSafeToSpendMessage(result)` is non-null (i.e. the
  negative/zero cases still get their copy — a positive result now has no
  paragraph).
- **Expanded `renderBreakdown`** (`safe-to-spend-hero.js`) to "include
  everything": the calculation rows now always render (even at $0) —
  Current balance − Planned expenses − Savings goals = result — followed
  by a new **"Shown for context — not part of the calculation"** group
  (new `.hero__breakdown-group` CSS) listing Savings account balance,
  Bills due before payday, Income due before payday, **Debt owed**, and
  the Next payday date/countdown. All read off `result` except debt:
  `renderSafeToSpendHero(result, { totalDebtCents })` gained that second
  arg, passed `getTotalDebtCents(state)` from `dashboard.js` (an existing
  selector's output — no arithmetic added to `src/ui/`, CLAUDE.md rule
  intact). Over-committed still shows the "After everything committed
  −$X" → "Shown as (never below $0) $0.00" pair.
  `formatShortWeekdayDate` now imported by the hero.
- **Onboarding gained a Debts step** (`src/ui/screens/onboarding.js`,
  new `renderDebtsStep`, 5th step) — a direct structural copy of
  `renderBillsStep`: reuses the real `renderDebtForm`
  (`src/ui/components/debts-section.js`), multi-entry with an
  "added so far" list + a Continue button, entirely optional. New
  imports: `renderDebtForm`, `createDebtAction`/`getAllDebts`. Copy notes
  it "doesn't change your Safe-to-Spend" (docs/SAFE-TO-SPEND.md §3c).
- Docs updated same change: `docs/SAFE-TO-SPEND.md` §12 (positive result
  = no paragraph; the expanded breakdown described), `docs/PRODUCT.md`
  §4 item 12 (onboarding step list now includes debts),
  `docs/ARCHITECTURE.md` (onboarding.js screen description).
- Verified via DOM-shim smoke test: positive result renders no
  `.hero__description`; the breakdown shows all 4 calc rows + the 5
  context rows (incl. "Debt owed — tracked separately, never subtracted
  here $3,200.00" and "Next payday Tue 1 Sept · 3 days"); over-committed
  shows the sub-total + floored pair and still keeps its message
  paragraph. Then discarded per docs/TEST-PLAN.md.

**"How is this worked out?" rewritten to be an exact mirror of the
calculation, and the "Shown for context" section removed — at the user's
request. 554 tests pass (display-only; no calculation, action, or
selector touched).** The user asked for the breakdown to fully explain
the formula, dynamically from real state, with a single source of truth
and no double-counting, AND to delete the context section added the
message before.
- **Inspected the actual calc first** (`src/modules/safe-to-spend/calculation.js`):
  `safeToSpendCents = max(0, currentBalanceCents − plannedExpensesCents −
  goalsSavedCents)`. Those are the ONLY two deductions
  (`totalCommittedCents = plannedExpensesCents + goalsSavedCents`).
  Everything the user's example formula listed separately — logged
  expenses, paid bills, debt payments, savings transfers — has **already
  reduced `currentBalanceCents`** via the cross-slice balance effects
  (docs/DATA-MODEL.md §3a); unpaid bills / debt balances / the flat
  Savings figure / upcoming income are excluded by design (§2/§3/§9).
- **`src/ui/components/safe-to-spend-hero.js` `renderBreakdown(result)`**
  (dropped its `totalDebtCents` param — `renderSafeToSpendHero` is back to
  taking just `result`; `dashboard.js` call reverted; `formatShortWeekdayDate`
  import removed): now renders a plain-language intro sentence
  ("Your Safe to Spend is the money left after setting aside everything
  you've already spent, committed, or chosen to reserve. Anything you've
  logged as spent, paid on a bill, put toward a debt, or moved into
  savings has already come out of your current balance.") then exactly
  three rows — `Current balance` − `Planned expenses` − `Savings goals` =
  `Safe to spend today` — every figure straight off `result`, both
  deduction rows shown even at $0. Reconciles to the headline **by
  construction**. Over-committed still shows "After everything set aside
  −$X" then the floored "Safe to spend today (never below $0) $0.00".
- **Removed entirely**: the "Shown for context — not part of the
  calculation" group and its rows (Savings account balance / unpaid bills
  / upcoming income / debt owed / next payday). No replacement disclaimer.
- CSS: `.hero__breakdown-group` → `.hero__breakdown-intro` (small margin,
  1.5 line-height). No colour/spacing/typography tokens changed.
- Docs: `docs/SAFE-TO-SPEND.md` §12 breakdown bullet rewritten.
- Verified via DOM-shim smoke test across 8 scenarios (nothing / expenses
  only / unpaid bills only / planned+goals / separate savings figure /
  over-committed / everything at once / add-an-expense): the three rows
  always reconcile to `netAfterCommittedCents`, the final row always
  equals `safeToSpendCents`, zero context rows, intro always present;
  adding a $50 expense drops Current balance $1,000→$950 and STS by
  exactly $50. Discarded per docs/TEST-PLAN.md.

**"How is this worked out?" now shows this month's spending as visible
deductions — at the user's request ("I logged an expense but it doesn't
show"), chosen via `AskUserQuestion` (option: "start from a 'before
spending' figure"). 557 tests pass. No calculation/action/selector
behaviour changed — one new composition selector + display.**
The problem: a logged `Expense` debits `currentBalanceCents` directly
(Phase 5), so it never appeared as its own line in the breakdown — it
was silently inside "Current balance". Adding a literal "− Expenses"
line would double-count and not reconcile.
- **New `getSafeToSpendBreakdown(state, {now})`** in
  `src/modules/dashboard/index.js` (the module allowed to compose many
  selectors — docs/ARCHITECTURE.md §7): returns `getSafeToSpend`'s result
  **spread** plus a `period` block —
  `{ balanceBeforeSpendingCents, spentThisMonthCents,
  billsPaidThisMonthCents, incomeReceivedThisMonthCents, hasActivity }`.
  This-month sums via `resolvePeriodRange('month')` + the same
  `getExpensesForPeriod` / `getBillPaymentsForPeriod` /
  `getIncomeReceiptsForPeriod` logs `getPeriodSummary` already reads.
  `balanceBeforeSpendingCents` is **defined** as `currentBalanceCents +
  spent + billsPaid − incomeReceived` so section 1 reconciles by
  construction; savings transfers / manual balance edits (no dated log)
  are absorbed into that opening figure. `spentThisMonthCents` is every
  `Expense` dated this month → debt-payment expenses counted once, inside
  it, never a separate line.
- **`src/ui/components/safe-to-spend-hero.js` `renderBreakdown`**: when
  `period.hasActivity`, renders a first section — `Balance at the start
  of this month` − `Spent this month` − `Bills paid this month` +
  `Income received this month` = `Current balance` (a new
  `.hero__breakdown-row--subtotal` CSS — ruled, medium weight; $0
  movement rows hidden) — then the unchanged second section (`Current
  balance` − `Planned expenses` − `Savings goals` = `Safe to spend
  today`). No activity → first section skipped, identical to before.
  Over-committed unchanged. Intro trimmed to one sentence
  ("Your Safe to Spend is the money left after setting aside everything
  you've already spent, committed, or chosen to reserve."). Hero still
  does no arithmetic — "−"/"+" are labels; all figures off the object.
- `src/ui/screens/dashboard.js`: `result = getSafeToSpendBreakdown(...)`
  (was `getSafeToSpend`; it's a superset so nothing else changed), unused
  `getSafeToSpend` import removed.
- Tests: 3 new in `dashboard.test.js` (no-activity inert; reconcile
  section 1; debt-payment counted once). Verified end-to-end through the
  real store + real actions (createExpense / mark bill paid / mark income
  received / add goal / over-commit): both sections reconcile in every
  scenario, adding a $50 expense moves "Spent this month" by $50 and STS
  by $50. Docs: SAFE-TO-SPEND.md §12, ARCHITECTURE.md dashboard line.

**"How is this worked out?" reworked to a fixed 5-row flow matching a
mockup the user supplied, and unpaid bills are back in the Safe-to-Spend
formula (flip #5) — confirmed via `AskUserQuestion`. 557 tests pass.**
The mockup: `In checking / + Arrived after that balance / − Bills still
to land / − Paid and spent after that balance / − Already set aside / =
Safe until payday`, and its total reflects the "Bills still to land"
subtraction — so matching it required folding `upcomingBillsCents` back
into the formula.
- **`src/modules/safe-to-spend/calculation.js`**: `totalCommittedCents =
  upcomingBillsCents + plannedExpensesCents + goalsSavedCents` (bills
  added). `upcomingBillsCents` JSDoc/comments flipped from "display-only"
  to "SUBTRACTED". **Marking a bill paid is now net zero on
  Safe-to-Spend** — it leaves `upcomingBillsCents` (bill is `paid`) and
  debits Current Balance by the same amount at the same instant
  (`bills/balance-effect.js`, unchanged mechanically; its header comment
  rewritten to "net zero"). The flat Savings figure (§9) is still NOT
  subtracted.
- **`src/modules/dashboard/index.js` `getSafeToSpendBreakdown`**: `period`
  block reshaped for the mockup rows — `{ inCheckingCents,
  arrivedAfterBalanceCents, paidAndSpentAfterBalanceCents, setAsideCents }`.
  `inCheckingCents` = `currentBalanceCents + spentThisMonth + billsPaidThisMonth
  − incomeReceivedThisMonth` (the old `balanceBeforeSpendingCents`, renamed).
  `paidAndSpentAfterBalanceCents` = this month's Expenses (debt-payment
  expenses included, once) + BillPayments. `setAsideCents` =
  `plannedExpensesCents + goalsSavedCents` (NOT bills — those are their
  own row). Reconciles by construction:
  `inChecking + arrived − upcomingBills − paidAndSpent − setAside ===
  netAfterCommittedCents` → floored → `safeToSpendCents`.
- **`src/ui/components/safe-to-spend-hero.js` `renderBreakdown`**: fixed
  5 rows always rendered (even at $0 — "+ $0.00" etc., matching the
  mockup), signs shown as `+ `/`− ` with a space. Total row label is
  "Safe until payday" (not `SAFE_TO_SPEND_LABEL`; the `<h2>` headline
  still says "Safe to spend today"). Over-committed: "After everything
  −$X" then "Safe until payday (never below $0) $0.00". Dropped the
  conditional first-section / `hasActivity` / `--subtotal` CSS from the
  previous version.
- **Verified** the mockup reproduces exactly (In checking $2,500 /
  + $0 / − $29 / − $1,780 / − $307 / = $384; rows sum === safeToSpendCents
  === netAfterCommittedCents) and that adding a $50 expense moves "Paid
  and spent" +$50 and "Safe until payday" −$50.
- **~13 tests flipped** back to "bills subtracted" across
  `safe-to-spend.test.js` (§2, §8, §10, §16, §16a, unbounded-horizon,
  PRODUCT.md §6 cross-check → $950), `dashboard-integration.test.js`
  (adding a bill reduces; mark paid/unpaid net zero; every-area-combined
  → $150,000), `qa-user-flows.test.js` (FLOW A → $540, C → $930, D →
  difference), plus the 3 `getSafeToSpendBreakdown` tests updated to the
  new field names. `wording.js` negative/zero copy now names bills.
- Docs: `SAFE-TO-SPEND.md` §2 (formula + 5-flip history note), §7
  (rewritten — "net zero", not "only via Mark paid"), §3c, §11b, §12
  (the 5-row table), §13; `PRODUCT.md` §6 (example → the flow, $384);
  `DATA-MODEL.md` §3a (bill-paid = net zero).

**Current phase: Phase 9 — Data Backup / Import / Export**, not started.
See `docs/ROADMAP.md` for full detail; do not jump ahead to later phases
without the user explicitly moving the project into them.
