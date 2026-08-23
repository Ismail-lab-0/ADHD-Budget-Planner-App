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

**Current phase: Phase 9 — Data Backup / Import / Export**, not started.
See `docs/ROADMAP.md` for full detail; do not jump ahead to later phases
without the user explicitly moving the project into them.
