# Test Plan

This document defines how correctness is validated in this project, given
there is no backend and no hosted deployment to test against. Testing
strategy scales up with the roadmap phases in `docs/ROADMAP.md`.

## 1. Philosophy

> **Product pivot note:** this document's Phase numbers now follow the
> revised `docs/ROADMAP.md` (ADHD Budget Planner). Phase 1's Tasks/Next
> Action test coverage (below) tests code that is now out of scope and
> slated for removal — it's left in place as an accurate record of what
> exists on disk today, not as ongoing guidance.

- **Test the logic, not the framework.** Since there's no UI framework
  and no backend, the highest-value tests are pure-function unit tests
  against `/core` and each module's selector/derivation logic
  (Safe-to-Spend, spending allowance, Dashboard aggregation, migrations).
  These are cheap, fast, and don't need a browser or DOM.
- **Zero added test dependencies.** Use Node's built-in `node:test` and
  `assert` modules. No Jest/Vitest/Mocha unless a concrete limitation of
  the built-in runner is hit — if so, that's a decision to raise with the
  user first (see `CLAUDE.md`).
- **DOM/UI testing stays manual** for now, via the checklists in §3. The
  project's small scope and single-user nature make heavy UI test
  automation (Playwright etc.) a cost that isn't justified until real
  breakage patterns show it's needed. Revisit this if manual QA starts
  missing regressions.
- **Data integrity is the highest-stakes category.** There's no server
  backup — the user's only copy of their data is in their browser's
  `localStorage` (plus whatever they've exported). Migration and
  import/export correctness get the most rigorous testing of anything in
  the app.

## 2. Automated unit tests

Location: `/tests/unit`, one file per tested module, run via `node
--test`.

Required coverage by the time each phase is "done" (see
`docs/ROADMAP.md` for phase definitions):

- **Phase 0 — Core:**
  - State store: `dispatch` produces correct new state, `subscribe`
    fires on change and not on no-op updates, unsubscribe works.
  - Event bus: `on`/`emit`/`off` behave correctly, including multiple
    handlers and handler removal mid-emit.
  - Date utilities: local-day boundary calculation, "is today/overdue"
    logic, timezone edge cases (e.g. behavior right at midnight).
  - Id generator: uniqueness across many rapid calls.
  - Storage adapter: save-then-load round-trip; corrupted JSON falls back
    to empty state without throwing; write debouncing doesn't drop the
    final write; a stale `schemaVersion` triggers migrations in the
    correct order.
  - Build script (`tests/unit/build.test.js`): runs the real
    `build/build.js` as a subprocess (not a re-implementation of its
    logic) and asserts the bundled JS preserves a literal `"$"` immediately
    before a `${...}` interpolation — regression coverage for a real bug
    where `html.replace(pattern, stringValue)` treated `$`-prefixed
    sequences anywhere in the *entire bundled application source* as
    special substitution patterns, silently deleting the dollar sign from
    every formatted money amount in every build (fixed with a function
    replacer instead — see `build/build.js`). This bug was invisible to
    every other test in this suite, because they all import source modules
    directly and never exercise the actual string-replace bundling step —
    "the source is correct" and "the shipped build is correct" turned out
    to be different claims, which is exactly why this test runs the real
    build rather than trusting source-level tests to stand in for it.

- **Phase 1 — Tasks / Next Action:** removed in Phase 2 along with the
  code it tested (`docs/ROADMAP.md`) — no longer applicable.

- **Phase 2 — Budgeting Engine:** ✅ implemented — `tests/unit/money.test.js`,
  `tests/unit/incomes.test.js`, `tests/unit/bills.test.js`,
  `tests/unit/planned-expenses.test.js`, `tests/unit/budget.test.js`,
  `tests/unit/budget-persistence.test.js`, plus the v2→v3 migration case
  in `tests/unit/schema.test.js` (all deterministic: a fixed `now` is
  injected rather than reading the real clock).
  - Money representation: `parseAmountToCents` handles whole/decimal
    amounts, currency symbols/thousands separators, rejects negative and
    non-numeric input, rejects (rather than silently rounds) more than 2
    fractional digits; a cents-integer round-trip proves no float drift
    (e.g. `0.1 + 0.2 === 0.3` in cents, unlike in raw floats).
  - Schema v3 migration: a v2 (task-oriented) state migrates to the v3
    (budget-oriented) shape without throwing; the old task-era collections
    are gone; new collections default to empty/zero; existing `settings`
    fields that still apply carry over.
  - Current balance / savings allocation / safety buffer: set updates the
    value; setting to the same value is a no-op; a negative or non-integer
    amount is rejected; each persists independently.
  - Income creation/editing/deletion: name + amount required (empty name
    or invalid amount refused); defaults (frequency `'one-time'`, `active:
    true`, `nextDate` today); an update can't touch `id`/`active`/
    `createdAt` or blank the name or apply an invalid amount; activate/
    deactivate toggles and reverses.
  - Bill creation/editing/deletion: same shape as Income, plus mark
    paid/unpaid toggles independently of active/deactivate.
  - Planned expense creation/editing/deletion: name + amount required;
    optional plannedDate/category/notes default to `null`.
  - Persistence (integration, through the real store + storage adapter):
    current balance, savings, safety buffer, and create/edit/delete for
    each of Income/Bills/Planned Expenses all survive a simulated reload,
    individually and all together in one session.

- **Phase 3 — Safe-to-Spend formula:** ✅ implemented —
  `tests/unit/safe-to-spend.test.js` (32 assertions across 21 named
  scenarios, all against a fixed `now`, never the real clock),
  `tests/unit/safe-to-spend-recurrence.test.js`, plus `addDays`/
  `addMonths`/`daysBetween` coverage added to `tests/unit/date.test.js`.
  See `docs/SAFE-TO-SPEND.md` for the formula these verify.
  - No commitments, bills only, planned expenses only, savings only,
    safety buffer only — each isolated in its own scenario.
  - Income before/after payday: the earliest active income sets the
    horizon; income amounts never add to Safe-to-Spend (see
    `docs/SAFE-TO-SPEND.md` §3); a later income source doesn't affect the
    horizon.
  - Multiple upcoming bills, multiple income sources, multiple planned
    expenses: each sums correctly.
  - Recurring income and recurring bills: a stale (past) recurring date
    rolls forward to its current occurrence; one rolled outside the
    horizon is correctly excluded.
  - A paid bill (and an inactive bill) is excluded entirely, regardless
    of due date.
  - Negative Safe-to-Spend: reported as a true negative, not clamped to
    zero; `getSafeToSpendMessage` returns neutral, non-judgmental copy
    stating the overage amount.
  - Zero Safe-to-Spend: reported precisely, not misclassified as
    negative.
  - Decimal amounts: cent-level arithmetic verified exact against
    hand-calculated expectations (no floating-point drift).
  - Same-day payday: `daysUntilPayday` is `0`; the daily allowance is the
    full remaining amount rather than a division-by-zero.
  - Missing optional values: an empty state object, and bills/planned
    expenses with no date, don't throw and resolve to the documented
    conservative defaults (see `docs/SAFE-TO-SPEND.md` §4/§6/§8).
  - No active income at all: the horizon is unbounded — every unpaid
    bill/planned expense counts regardless of date.
  - Cross-checked against `docs/PRODUCT.md` §6's illustrative example:
    reproduces the documented $600 exactly from the same inputs.
  - `upcomingIncomeCents` (Phase 4 addition, display-only): reports
    income landing on the horizon date, sums correctly when multiple
    sources tie for earliest, is `0` with no determinable payday, and
    never affects `safeToSpendCents`.

- **Phase 4 — Safe-to-Spend dashboard:** ✅ implemented —
  `tests/unit/dashboard.test.js` (selection/sorting logic for the
  Upcoming Commitments list — no money arithmetic),
  `tests/unit/dashboard-integration.test.js` (dispatches real changes
  through the real store across all six budget-affecting areas — current
  balance, income, bills, planned expenses, savings, safety buffer — and
  confirms `getSafeToSpend(store.getState())` updates correctly each
  time, cross-checked against a hand-built expectation independent of the
  engine's internal helpers). DOM rendering itself stays manual (§1); a
  throwaway Node DOM shim (not part of the repo) was used ad hoc during
  development to execute the actual render/submit/click code paths and
  catch construction bugs before manual QA, per this phase's emphasis on
  verifying the dashboard truly consumes the engine rather than
  duplicating its math.

- **Phase 5 — Expense tracking:** ✅ implemented —
  `tests/unit/expenses.test.js` (creation/defaults/editing/deletion/
  categories), `tests/unit/expenses-balance-effect.test.js` (the pure
  balance-delta logic in isolation), `tests/unit/expenses-persistence.test.js`
  (integration through the real store), plus a v3→v4 migration case in
  `tests/unit/schema.test.js` and `parseBalanceToCents`/
  `isValidBalanceCents` coverage in `tests/unit/money.test.js`.
  - Add expense: amount alone produces a valid Expense; an invalid/
    negative/non-integer amount is refused.
  - Defaults: description/category/notes `null`, date defaults to today.
  - Category: a default-list category and a fully custom one are both
    accepted (categories are suggestions via `<datalist>`, not a locked
    enum).
  - Dates: an explicit date is stored and editable; editing never
    clobbers it with an accidental blank (same pattern as Bills/Income).
  - Decimal amounts: verified exact in cents, no float drift (e.g.
    `$19.99` stores as `1999`, not `1998.9999...`).
  - Edit expense: fields apply, `updatedAt` advances, `id`/`createdAt`
    can't be changed via update, an invalid amount is dropped not
    applied.
  - Delete expense: removes it; deleting a nonexistent id is a no-op.
  - Current Balance model (`docs/DATA-MODEL.md` §3a): creating an expense
    decrements the balance by exactly its amount; editing to a larger/
    smaller amount further deducts/refunds the difference; deleting
    refunds the full amount; an expense larger than the balance is
    allowed to take it negative — never silently clamped to zero.
  - Safe-to-Spend updates: `getSafeToSpend(state)` reflects the new
    balance immediately after an expense is logged, with no separate
    step — proven by dispatching through the real store, not by calling
    the engine directly with hand-built state.
  - Persistence: create/edit/delete each survive a simulated reload,
    including the resulting balance adjustment.
  - Mobile input: amount fields use `inputmode="decimal"` (see
    `src/ui/components/amount-field.js`) so mobile keyboards default to
    a numeric layout — verified by inspection/manual check (§3 checklist
    below), not automated (no mobile browser in the test environment).

- **Phase 7 — Budget Planning (Category Budgets):** ✅ implemented —
  `tests/unit/category-budgets.test.js` (CRUD, spending calculation,
  status, monthly period handling) and
  `tests/unit/category-budgets-safe-to-spend.test.js` (the **critical**
  no-double-subtraction requirement), plus a v4→v5 migration case in
  `tests/unit/schema.test.js`.
  - Category budget creation: category + limit produces a valid record;
    an empty category or invalid/negative/non-integer limit is refused.
  - Editing: fields apply, `updatedAt` advances, `id`/`createdAt` can't
    be changed via update, an invalid limit is dropped not applied.
  - Deletion: removes it; deleting a nonexistent id is a no-op.
  - Spending against a category: sums only same-category expenses within
    the current month; a different category, an unbudgeted category, or
    an uncategorized expense never counts against a budget it doesn't
    match.
  - Exceeded budget: spending past the limit reports `status: 'exceeded'`
    and a negative `remainingCents` — plain arithmetic, no special
    "shame" value or altered calculation for the exceeded case.
  - Approaching limit: spending at/above 80% of the limit (but not over)
    reports `status: 'approaching'`.
  - Monthly reset/period handling: an expense dated in a previous or
    future month never counts toward the current month's spent figure;
    the same underlying data produces a different (correctly zeroed)
    result once `now` rolls into a new month — proving the "reset" is
    automatic, derived, and needs no explicit action.
  - **Safe-to-Spend interaction (critical) / duplicate-subtraction
    prevention:** creating, editing, or deleting a category budget
    changes the Safe-to-Spend result by exactly `$0`; logging an expense
    against a budgeted category (including one that pushes it over the
    limit) moves Safe-to-Spend by exactly that expense's own amount —
    proven through the real store, plus a direct check that
    `getSafeToSpend` produces the same result regardless of what
    `categoryBudgets` contains, confirming it's never read by the
    formula at all.

- **Phase 8 — Onboarding & Product Polish:** ✅ implemented —
  `tests/unit/settings.test.js` (the settings reducer),
  `tests/unit/onboarding-integration.test.js` (through the real store).
  - `completeOnboardingAction`/`settingsReducer`: sets
    `onboardingCompletedAt`; is a no-op (same reference) if already
    completed, so it can't be overwritten by a later duplicate dispatch;
    leaves other settings fields untouched.
  - A brand-new install has not completed onboarding.
  - **Backfill for returning users:** a state with any pre-existing
    budget data (non-zero balance, or any income/bill/planned expense/
    expense/category budget) is treated as onboarding-complete
    automatically — the flow is never shown to someone who already set
    things up before Phase 8 existed. A genuinely empty returning state
    is still shown onboarding.
  - Onboarding completion persists across a simulated reload.
  - DOM smoke-tested (render every step, click every button including
    Skip and Finish, submit every form with blank required fields —
    confirms validation without a false dispatch — and expand
    "+ More options" inside the embedded Bill form) and the full
    `mountShell` gating (nav hidden while onboarding is incomplete,
    visible immediately after `completeOnboardingAction`).

- **Full Testing & Validation pass (between Phase 8 and Phase 9 — no new
  product functionality; see `docs/QA-REPORT.md` for the complete
  narrative record of what was tested, what failed, and what was fixed):**
  ✅ implemented — `tests/unit/qa-user-flows.test.js`,
  `tests/unit/qa-date-scenarios.test.js`, `tests/unit/qa-data-safety.test.js`,
  plus regression tests added to `tests/unit/expenses-balance-effect.test.js`
  and `tests/unit/category-budgets.test.js` for the two bugs this pass
  found and fixed (see below). Every scenario runs against a fixed `now`,
  never the real clock.
  - **User flows, end-to-end through the real store** (`qa-user-flows.test.js`):
    open app → enter balance → add payday → add bills → view
    Safe-to-Spend; add expense → Safe-to-Spend updates; add bill →
    Safe-to-Spend updates; edit a bill's amount → Safe-to-Spend updates by
    exactly the delta; edit a bill's due date across the payday horizon →
    it drops out of the result with no stale double-count; delete an
    expense → the balance and Safe-to-Spend are refunded exactly; a full
    session across every module survives a simulated refresh with an
    identical Safe-to-Spend result before and after.
  - **Fixed-date scenarios** (`qa-date-scenarios.test.js`): today, tomorrow,
    payday today (daily allowance = the full amount, no divide-by-zero),
    payday tomorrow, payday next month (correct day count across the month
    boundary), end of month (including viewed *from* the last day of the
    month), beginning of month, a stale recurring monthly bill rolling
    forward to its current on/after-today cycle, a monthly bill anchored on
    the 31st clamping correctly through short months without drifting back
    up, a recurring bill excluded once its rolled-forward date passes the
    payday horizon, and an overdue one-time bill (counts in full until
    marked paid).
  - **Data safety** (`qa-data-safety.test.js`), at the full
    `initAppState`/`getSafeToSpend`/`getCategoryBudgetProgress` level, not
    just the storage adapter in isolation: unparseable JSON, a
    wrong-shape-but-valid JSON value, a future `schemaVersion`, missing
    top-level collections, a completely empty state object, non-array
    collections (corrupted to `null`/an object), invalid `amountCents`
    values (string/negative/`NaN`) on bills and expenses, a non-integer
    `currentBalanceCents`, a genuinely fresh install, and pre-v1/totally
    unrecognized garbage migrating all the way to the current shape — none
    of these throw anywhere in the pipeline.
  - **Two real bugs found and fixed** (see `docs/QA-REPORT.md` for full
    detail): (1) `category-budgets/selectors.js` and
    `expenses/balance-effect.js` summed `amountCents` without validating
    it first, unlike `safe-to-spend/calculation.js`'s established pattern
    — a corrupted stored expense could NaN-poison a category budget's
    "spent" figure or the Current Balance delta; both now skip invalid
    values, matching the existing convention. (2) `x ?? []` only guards
    against a *missing* collection, not one that's *present but the wrong
    type* (e.g. corrupted to an object or a string) — `for...of` on that
    throws; fixed with `Array.isArray(x) ? x : []` at every read site in
    `safe-to-spend/calculation.js` and `category-budgets/selectors.js`,
    plus a centralized normalization step in `schema.js`'s `migrate()` (the
    one place all persisted state passes through) so every reducer built
    on `createListReducer` can also trust these are always real arrays.
  - Manual UX review (desktop + mobile viewport): no browser tool is
    available in this environment (see `docs/QA-REPORT.md` §6 for the
    substitute methodology used — CSS/copy code review plus a throwaway
    DOM-shim render smoke test across the Dashboard, Money, and Onboarding
    screens with edge-case data). A real-browser pass remains a §3 manual
    checklist item, unchanged.

- **Debt Tracking (out of phase order, at the user's request — see
  `docs/PRODUCT.md` §4 item 16):** ✅ implemented —
  `tests/unit/debts.test.js` (the reducer + pure selectors) and
  `tests/unit/debts-integration.test.js` (the `rootReducer` cross-slice
  transition), plus a `v8 -> v9` block in `tests/unit/schema.test.js`.
  - **Reducer:** required-field validation (name, the three amounts, the
    1–31 due day); `interestRate` optional (`null` accepted, `0`
    accepted as distinct, negative rejected); `paymentFrequency` defaults
    to monthly and rejects unknowns; `recordDebtPaymentAction` reduces
    `currentBalanceCents` and **clamps at 0** (over-payment can't go
    negative); a $0/invalid payment or a payment against an already-$0
    debt is a no-op (same array reference).
  - **Selectors:** `getTotalDebtCents` (sum, corrupt-value-safe);
    `getDebtProgress` (clamped 0–100%, no divide-by-zero on a $0
    original, `isPaidOff` at `<= 0`); `getNextDebtDueDateKey` (rolls to
    next month once the day passes, clamps a "31st" to a short month's
    last day); `estimatePayoff` (`null` with no APR / no balance / no
    payment, simple division at 0% APR, a real month count + date for a
    normal APR, `coversInterest: false` when the payment can't cover one
    month's interest); `getUpcomingDebtPayments` (one row per
    balance-bearing debt, `alreadyPaidThisPeriod` true once a
    same-month `DebtPayment` exists).
  - **Cross-slice (`debts/record-payment` through `rootReducer`):** one
    dispatch reduces the debt balance, appends a linked `Expense`
    (category `"Debt Payment"`, `debtId` back-reference), debits Current
    Balance by that expense amount, and appends a `DebtPayment` — all in
    one transition. **Safe-to-Spend drops by exactly the payment amount,
    not twice** (the key no-double-count property, `docs/SAFE-TO-SPEND.md`
    §3c). Over-payment clamps the debt at $0 but still debits the full
    amount actually paid. Deleting a debt leaves its past payment
    `Expense`s in history (`docs/PRODUCT.md` §6). An unknown debt id is a
    total no-op.
  - **Migration:** `v8 -> v9` adds empty `debts` / `debtPayments`, purely
    additive, no existing collection touched; a v1 blob migrates all the
    way to v9 with both present and empty.
  - **DOM/UI:** manual per §1 policy — smoke-tested this session via a
    throwaway DOM-shim render (empty state, debt rows with progress +
    payoff line, `Paid off 🎉` state, the conditional "Total debt"
    summary tile, "Bills due soon" merging real bills with debt
    minimum-payment rows, a paid debt leaving that list), then discarded.

- **Phase 9 — Backup / Import / Export:**
  - Export-then-import round-trip produces equivalent state.
  - Import of a file with an older `schemaVersion` runs migrations
    correctly.
  - Import of malformed/non-JSON input is rejected with a clear error,
    without mutating current state.

- **Ongoing, every phase:** any bug fix should come with a regression
  test that fails before the fix and passes after.

## 3. Manual test checklists

Run before considering a phase's exit criteria met, and again before any
Phase 10 release-polish pass. Each module gets a short checklist rather
than a generic "click around" pass.

### Navigation checklist (the multi-view sidebar — see `CLAUDE.md` "Current status")

- [ ] Every sidebar item opens its own dedicated view; only one view is
      visible at a time (not a scroll to a Dashboard section).
- [ ] The active sidebar item is highlighted and matches the current
      view / URL hash.
- [ ] Adding/editing an expense, income, bill, or debt, or making a debt
      payment, from its dedicated view is immediately reflected on the
      Dashboard summary, Safe-to-Spend, and Current Balance — one shared
      store, no per-view data.
- [ ] URL hash updates per view (`#expenses`, `#debts`, …); browser
      Back/Forward move between visited views; a refresh reopens the same
      view; no application data is lost by any of this.
- [ ] Desktop: the sidebar is a persistent rail and collapses/expands;
      collapsed shows icons with tooltips and keeps the active highlight.
- [ ] Mobile: the hamburger opens a drawer; selecting an item closes the
      drawer and shows the new view from the top; no horizontal overflow.
- [ ] `#index` or an unknown hash lands on the Dashboard rather than a
      blank screen.

### Capture-friction checklist (expense entry, bill entry, and any future capture point)

- [ ] Can a new expense be captured with just description + amount, in a
      single visible step, without a forced modal chain?
- [ ] Does pressing Enter (or the equivalent primary action) from the
      capture field save the entry without extra clicks?
- [ ] Is optional detail (date, category, etc.) reachable but not
      required?
- [ ] Entering a negative amount, non-numeric text, or an amount with more
      than 2 decimal places shows a clear, calm error rather than saving
      garbage or crashing?
- [ ] Entering a decimal amount (e.g. `19.99`) saves and displays exactly
      right — no floating-point drift (see `docs/DATA-MODEL.md` §2)?
- [ ] On a real mobile device (or browser dev-tools device emulation),
      tapping an amount field brings up a numeric keypad, not the full
      alphabetic keyboard (Phase 5 — `inputmode="decimal"`)?

### Safe-to-Spend dashboard checklist

- [ ] Does the dashboard load to something useful (not blank, not an
      empty state that offers no next step) for a user with a current
      balance, one bill, and one logged expense?
- [ ] Is the Safe-to-Spend number visually the most prominent thing on
      the screen?
- [ ] Does the screen stay calm/uncluttered as data volume grows (many
      bills, many logged expenses) — progressive disclosure holding up
      rather than the screen turning into a financial analytics
      dashboard (`docs/PRODUCT.md` §5)?

### Safe-to-Spend checklist

- [ ] Does the number shown match a hand-calculated expectation for a
      known test scenario?
- [ ] Is the answer framed as "you can safely spend $X," not as a raw
      transaction list?
- [ ] Does it update immediately after logging an expense or adding a
      bill?

### Data integrity checklist

- [ ] Reload the app after normal use — nothing is lost.
- [ ] Export, clear storage (simulate a fresh browser), import — state is
      restored fully and correctly.
- [ ] Manually corrupt the stored JSON (e.g. truncate it) and reload —
      the app recovers to a usable empty state instead of a blank/broken
      screen.
- [ ] Simulate an old `schemaVersion` in stored data and reload — data
      migrates without loss.

### Offline checklist

- [ ] Open the built `docs/index.html` directly from disk (`file://`),
      with network access disabled — the app fully works.
- [ ] No requests appear in the browser's network panel during normal
      use.

### PWA checklist (full/paid build only — `docs/app-x7k2m9/`)

Serve the folder over `http://localhost` or HTTPS (a service worker won't
register from `file://`) — e.g. `npm start` then open
`/docs/app-x7k2m9/`. On the live GitHub Pages site (Settings → Pages →
Deploy from a branch: `main` `/docs`) this is `/app-x7k2m9/`.

- [ ] iOS Safari → Share → Add to Home Screen shows the real green
      checkbox icon (the `apple-touch-icon.png`), not a screenshot of the
      page, and the name reads "Budget".
- [ ] Launching that home-screen icon opens the app full-screen with no
      Safari address bar / toolbar (`display: standalone` +
      `apple-mobile-web-app-capable`).
- [ ] After one online visit (so the service worker installs), enable
      airplane mode and relaunch — the app loads from cache.
- [ ] Chrome/Android → the install prompt appears; installed app matches
      the manifest name/colours; DevTools → Application → Service Workers
      shows `budget-planner-v1` active, and Cache Storage holds the shell.
- [ ] The **demo** build (`docs/index.html`) has none of this — no
      manifest link, no service worker, no `apple-mobile-web-app` meta,
      and `docs/` has no top-level `manifest.json` / `sw.js` / icon files.
      (`tests/unit/build.test.js` asserts this automatically.)

### Accessibility checklist (rigorous pass in Phase 11, spot-checked
earlier)

- [ ] Every primary action (capture an expense/bill, navigate between
      screens) is reachable and operable via keyboard alone.
- [ ] Visible focus indicator at every interactive element.
- [ ] Color is never the only signal (e.g. a bill due soon isn't
      red-only — also labeled).
- [ ] `prefers-reduced-motion` is respected (no motion-heavy transitions
      when set).
- [ ] `prefers-color-scheme` is respected, and the in-app theme override
      in Settings works both ways.
- [ ] A quick screen-reader pass (e.g. VoiceOver/NVDA) on the dashboard
      and the expense-capture flow confirms sensible reading order and
      labels.

### ADHD-claims / tone checklist (content review, any phase touching
copy)

- [ ] No clinical/diagnostic/treatment language anywhere in new copy
      (see `docs/PRODUCT.md` §7).
- [ ] No guilt/shame-framed messaging for overspending, low balances, or
      missed bills (see `docs/PRODUCT.md` §3 — calm, not alarming).
- [ ] An exceeded category budget reads as a plain fact ("$10 over"), not
      a judgment — and isn't signaled by color alone (Phase 6).

## 4. Definition of done (per feature)

A feature/module is considered done for its phase when:

1. It has unit test coverage for its non-trivial logic (selectors,
   derivations, migrations) per §2.
2. The relevant manual checklist(s) in §3 pass.
3. It integrates with the Safe-to-Spend dashboard per `CLAUDE.md`'s "every
   feature must answer how it affects Safe-to-Spend" rule, unless
   explicitly scoped not to (state that exception in the PR/commit
   description if so).
4. `docs/DATA-MODEL.md` and `docs/ARCHITECTURE.md` are updated if the
   feature changed the schema or module boundaries.
5. No new runtime dependency was added without prior confirmation.

## 5. Non-goals for testing (for now)

- No automated cross-browser test matrix — manual spot checks in at
  least one Chromium-based and one non-Chromium browser before releases
  is sufficient at this project's scale.
- No performance/load testing — data volumes are inherently small
  (single user, personal use).
- No automated visual regression testing — revisit only if manual QA
  proves insufficient.
