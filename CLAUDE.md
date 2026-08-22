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
  calendar, routines, general life planning, goals, a weekly productivity
  review, a task recommendation engine, or a focus timer — these were part
  of an earlier, retired product direction ("ADHD Life Planner") and are
  explicitly out of scope now. This applies even though working code for
  some of them (Tasks, Next Action) still exists in the repo — see
  "Current status" below.

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

**Current phase: Phase 9 — Data Backup / Import / Export**, not started.
See `docs/ROADMAP.md` for full detail; do not jump ahead to later phases
without the user explicitly moving the project into them.
