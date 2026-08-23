# Architecture

This document defines the technical architecture for ADHD Budget Planner
(formerly a broader "ADHD Life Planner" — see `docs/PRODUCT.md` §9 for what
the product pivot means for existing code). It is binding: implementation
should follow it, and any deviation should update this document in the
same change (see `CLAUDE.md`). The constraints, technology choices, state
architecture, and storage strategy below are unchanged by the product
pivot — only the feature module list (§6) and its worked examples (§7)
change.

## 1. Constraints that shape everything

- No backend, no server-rendered anything, no login.
- No network calls in normal operation (no external AI API, no analytics,
  no CDN dependency at runtime).
- Persistence is `localStorage` only.
- Must work fully offline.
- Must eventually be distributable as **one self-contained HTML file**
  (inline CSS and JS, no external `<script src>`/`<link>` at distribution
  time).
- Developed as multiple modules/files, not as one giant file — the
  single-file output is a *build artifact*, not the development format.

These constraints rule out frameworks that assume a build-and-deploy web
service, server components, or a runtime package fetch. They point toward
plain HTML/CSS/JS using native ES modules during development, assembled
into one file for distribution.

## 2. Technology choices

- **Language:** plain JavaScript (ES2020+ features are fine; no
  TypeScript compiler dependency — if type-checking is wanted later, it
  should be via JSDoc + a dev-only checker, never a required build step to
  *run* the app in dev).
- **UI:** no framework (no React/Vue/Svelte/etc). DOM APIs directly, with
  small hand-written helper utilities for rendering if repetitive patterns
  emerge. This keeps the dependency count at zero and keeps the
  single-file build trivial (no bundler-specific runtime needed).
- **Styling:** plain CSS, organized into per-module files during
  development, concatenated at build time. No CSS-in-JS, no preprocessor
  dependency (if a preprocessor is ever wanted, it must not be required to
  run the app in dev — plain CSS is the baseline).
- **Persistence:** `localStorage`, accessed only through the storage
  adapter (§5).
- **Build tooling:** a small, dependency-free (or near-zero-dependency)
  Node script that inlines JS modules and CSS into a single HTML file for
  distribution. Not introduced until Phase 0 scaffolding explicitly calls
  for it (see `docs/ROADMAP.md`) — no bundler like Webpack/Vite/Rollup
  unless a concrete need arises that a plain script can't reasonably
  solve; if that happens, it's a decision to raise with the user first,
  per `CLAUDE.md`.
- **Testing:** Node's built-in test runner (`node:test`) and `assert` for
  logic unit tests — zero added dependencies. See `docs/TEST-PLAN.md`.

## 3. High-level shape

```
┌─────────────────────────────────────────────────────────────┐
│                           UI Shell                           │
│   navigation, layout, screen mounting                        │
└───────────────┬─────────────────────────────────┬────────────┘
                │                                 │
     ┌──────────▼──────────┐            ┌─────────▼──────────┐
     │   Feature Modules    │            │  Dashboard Engine   │
     │ accounts / income /  │◄──────────►│ (aggregates feature │
     │ bills / expenses /   │  read via  │  module outputs into │
     │ savings / safe-to-   │  selectors │  the Safe-to-Spend   │
     │ spend / onboarding / │            │  dashboard view)     │
     │ backup                │            └─────────┬───────────┘
     └──────────┬───────────┘                      │
                │  dispatch actions / read state     │
     ┌──────────▼─────────────────────────────────────▼───────┐
     │                      App State Store                    │
     │   single in-memory state tree, event bus for change     │
     │   notification, pure reducer-style update functions     │
     └──────────┬───────────────────────────────────────────────┘
                │  load/save (debounced), migrate
     ┌──────────▼───────────┐
     │   Storage Adapter      │
     │  localStorage only,    │
     │  versioned schema,     │
     │  migrations, JSON I/O  │
     └─────────────────────────┘
```

Feature modules never touch `localStorage` directly and never import each
other's internals. Everything flows through the state store and the
storage adapter.

## 4. Application state architecture

- **Single source of truth:** one in-memory state tree per app session,
  owned by the state store. No feature module keeps its own parallel copy
  of persisted data.
- **Unidirectional flow:** UI triggers an *action* (a plain description of
  intent, e.g. `{ type: 'expenses/create', expense }`) → the store applies
  a pure update function to produce new state → the store persists the
  relevant slice via the storage adapter → the store publishes a change
  notification → subscribed UI re-renders from the new state.
- **Event bus:** a minimal pub/sub (`on(event, handler)`, `emit(event,
  payload)`, `off(...)`) used for state-change notifications and for
  cross-module signals that aren't full state (e.g. "an expense was just
  logged," which the Dashboard may want to react to without owning expense
  state). No framework needed — this is ~30 lines of code.
- **Derived state is computed, not stored.** Safe-to-Spend, the daily/
  weekly spending allowance, and the Dashboard's aggregated view are all
  *derived* from stored entities at read time (memoized if it becomes a
  real performance need). They are never separately persisted, which
  avoids them going stale or out of sync with their source data. See
  `docs/DATA-MODEL.md` §"Derived vs. stored data."
- **No global mutable singletons reached via import.** Modules receive the
  store/bus/adapter they need through explicit initialization (simple
  dependency passing), not by importing a shared mutable global from
  anywhere. This keeps module boundaries real and keeps logic testable
  without a DOM.

## 5. LocalStorage strategy

- **Single namespaced root key** for the whole app's data (e.g.
  `adhd-planner:v1`), holding one JSON blob with the full state tree,
  rather than scattering many ad-hoc keys. One key means one migration
  path, one export/import shape, and no risk of partial/inconsistent
  reads across keys.
- **All reads/writes go through the storage adapter module**, which is
  the only code allowed to call `localStorage.getItem` /
  `localStorage.setItem`. Its responsibilities:
  - Serialize/deserialize JSON safely (never let a `JSON.parse` throw
    take down the app — fall back to a safe empty state and surface a
    non-alarming recovery message).
  - Own the **schema version** field and run migrations on load when the
    stored version is older than the current one (see
    `docs/DATA-MODEL.md`).
  - Debounce writes (state changes are batched and flushed on a short
    delay, plus on page hide/unload) so rapid interactions don't hammer
    `localStorage` synchronously.
  - Enforce a soft size check and warn (via the UI, not a silent failure)
    if the app is approaching typical browser storage limits, well before
    hitting `QuotaExceededError`.
- **Export/Import is a thin wrapper over the same schema**: export reads
  the current state tree and offers it as a downloadable JSON file; import
  parses a provided JSON file, validates/migrates it, and replaces state
  after user confirmation. No separate "backup format" to maintain.
- **No other client storage mechanism** (no IndexedDB, no cookies, no
  cache API) unless a specific, documented need arises later — keeping to
  one mechanism keeps the storage adapter's contract simple.

## 6. Directory layout

The Tasks/Next-Action/Today-for-tasks modules from the retired product
direction (`docs/PRODUCT.md` §9) have been removed as of Phase 2 — this
reflects what's actually in the repo, not a future target.

```
/src
  /core
    store.js               # state store: get/dispatch/subscribe
    events.js               # minimal pub/sub event bus
    storage.js                # the storage adapter (only module touching localStorage)
    schema.js                  # schema version + migrations
    id.js                        # id generation helper
    date.js                        # date/time utilities (single source of "today", timezone handling)
    money.js                         # integer-cents money parsing/formatting (see docs/DATA-MODEL.md §2); formatCents is multi-currency-*display*-aware (SUPPORTED_CURRENCIES, setActiveCurrency/getActiveCurrency — a module-level "active currency" set once per render by shell.js, mirroring the theme mechanism, not threaded as a prop through every caller) — no conversion, no exchange rates, one stored number rendered in whichever currency is picked
    list-entity.js                     # generic create/update/delete/toggle reducer factory for id-keyed lists
  /modules
    budget/          # Current Balance, Savings allocation (single-value figures; Safety Buffer removed, see docs/SAFE-TO-SPEND.md)
    incomes/          # Income + Paydays; also owns the Current Balance cross-slice effect for confirmed-received income (balance-effect.js — see docs/DATA-MODEL.md §3a), mirroring expenses/'s pattern below
    bills/              # Upcoming Bills; also owns the Current Balance cross-slice effect for a bill marked paid/unpaid (balance-effect.js — see docs/DATA-MODEL.md §3a), same pattern as incomes/ and expenses/ below
    planned-expenses/     # Planned Expenses
    expenses/               # logged spending; also owns the Current Balance cross-slice effect (balance-effect.js — see docs/DATA-MODEL.md §3a)
    category-budgets/        # optional monthly spending limits — read-only w.r.t. safe-to-spend/, see docs/SAFE-TO-SPEND.md §3b
    income-receipts/            # automatic historical log of confirmed income (docs/DATA-MODEL.md "IncomeReceipt") — no CRUD of its own, created by incomes/'s "Mark received" via src/main.js's rootReducer, read by dashboard/'s getPeriodSummary
    bill-payments/               # the Bill-side counterpart to income-receipts/ (docs/DATA-MODEL.md "BillPayment") — created/un-created by bills/'s "Mark paid"/"Mark unpaid" via src/main.js's rootReducer, read by dashboard/'s getPeriodSummary
    expense-drafts/                # "Brain dump" quick-capture data (docs/DATA-MODEL.md "ExpenseDraft") — plain generic slice routing (not a cross-slice effect like incomes/bills/expenses above); never read by safe-to-spend/, same exclusion as category-budgets/
    safe-to-spend/              # getSafeToSpend/getSpendingAllowance — pure calc, see docs/SAFE-TO-SPEND.md; consumed by the dashboard
    dashboard/                    # getUpcomingCommitments/getUpcomingBills/getUpcomingIncome/getPeriodSummary — composition/selection only, no money arithmetic of its own (getPeriodSummary composes other modules' selectors for the header bar's global period selector — see CLAUDE.md "Current status")
    settings/                       # onboardingCompletedAt (completeOnboardingAction/hasCompletedOnboarding), theme (setThemeAction/getTheme — see src/ui/components/theme-toggle.js), and currency (setCurrencyAction/getCurrency — see src/ui/components/currency-selector.js, src/core/money.js)
    # not yet built: backup/ — see docs/ROADMAP.md
  /ui
    shell.js          # mounts the single Dashboard screen; gates on hasCompletedOnboarding; toggles a `.theme-dark`/`.theme-light` class on <html> from the stored theme preference on every render (docs/DATA-MODEL.md "Settings"). No nav/routing beyond the dashboard's own header bar (src/ui/components/header-bar.js — a brand mark + "+ Brain dump" + the global period selector + theme toggle, deliberately not a multi-module nav) — see CLAUDE.md's "Current status" for the running account of what's been added/removed and why. Also owns the single global `keydown` listener (attached once, at mount time, not inside render()) for the "N" quick-capture shortcut, guarded against typing in a field and against firing during onboarding
    dom.js             # tiny createElement/appendChild helper (`el()`)
    components/        # small shared render helpers (not a component framework); more-options.js is the shared "+ More options" progressive-disclosure wrapper; icons.js is the inline SVG icon set (icon/iconChip/sectionHeading/categoryIconChip/categoryEmojiBadge) — no CDN, hand-authored, see CLAUDE.md's no-network-request rule; popup.js is the shared centered modal, period-selector.js a lighter anchored-dropdown variant of the same open/close pattern; brain-dump.js owns the "+ Brain dump" header button + its stays-open-after-save capture popup (opened by either the button or shell.js's "N" shortcut); inbox-section.js is the Inbox card reading expense-drafts/, including its own "Convert to expense" popup (reuses expenses-section.js's renderExpenseForm via its new initialDescription prefill option); summary-strip.js is the top-of-dashboard glance row of stat tiles — composition only, every figure it shows is read from getSafeToSpend/getUpcomingBills/getAllExpenseDrafts, nothing recomputed; right-now-section.js is the period card (Money in/out, titled with the header bar's selected period — period-selector.js's getPeriodLabel — reading dashboard/index.js's getPeriodSummary); Current Balance is single-value-section.js again, its own standalone card (like Savings) directly below the period card — the two briefly lived merged into one "Right now" card before being split back apart at the user's request (period-summary.js, the original separate "This Period" card, stays deleted — this file replaced it); Current Balance also uses single-value-section.js's `editOnly` mode (no inline field/Save button, just a pencil-icon popup — the same "hidden until asked for" affordance Savings' own edit-total pencil already had, now generalized to be the *only* way to edit rather than a secondary one); currency-selector.js is the currency picker — an icon button showing the active currency's sign (getCurrencySymbol), in the header bar's right-side controls group alongside the period selector and theme toggle — a display preference only, see money.js's own entry above and docs/DATA-MODEL.md "Settings"
    screens/            # dashboard.js (the only screen — a 2-column grid at desktop width, src/styles/responsive.css `.dashboard-grid`) and onboarding.js
  /styles
    base.css
    components.css
    responsive.css
  main.js              # dev entry point, wires core + modules + shell
index.html             # dev entry HTML (loads main.js as an ES module)
/build
  build.js             # inlines src/* into one dist/index.html
  serve.js             # zero-dependency local static server for dev
/dist
  index.html           # generated, self-contained distributable
/tests
  unit/                # node:test files, one per logic module
docs/
CLAUDE.md
README.md
```

`src/core/list-entity.js` is a small factory (`createListReducer`) that
builds the common create/update/delete/toggle reducer shape shared by
Incomes/Bills/Planned Expenses, so that boilerplate isn't triplicated —
each module still owns its own validation (`validateNew`/
`sanitizeChanges`), only the array-manipulation mechanics are shared.

Each `/modules/<name>/` directory is expected to contain the module's
state slice/reducer, its derived-data/selector functions, and its UI
rendering, but *not* other modules' internals.

## 7. Module boundaries

- A feature module may depend on: `/core` (store, events, storage, id,
  date utils) and generic `/ui` helpers.
- A feature module may **not** import another feature module's internal
  files directly. If the Dashboard needs data derived from Bills, it calls
  a selector function that the Bills module exports as its public
  interface (e.g. `bills/index.js` exporting `getBillsDueBefore(state,
  date)`), not reach into `bills/store.js`.
- Cross-module reactions (e.g. "logging an expense should be reflected on
  the Dashboard immediately") go through the event bus or through the
  Dashboard re-deriving from state on the next state-change notification —
  never through a module directly calling into another module's update
  functions.
- The **Dashboard module is the only module allowed to depend on many
  other modules' public selectors at once** (that's its job —
  composition). All other modules should be able to function with only
  `/core` as a dependency, so they stay independently understandable and
  testable.
- The **Safe-to-Spend and Daily/Weekly Allowance engines** are themselves
  treated as modules with a narrow public interface (`getSafeToSpend(state)`,
  `getSpendingAllowance(state)`), not folded directly into Accounts/Bills,
  so their logic can be unit-tested and reasoned about in isolation — see
  `docs/PRODUCT.md` §6 on why the exact formula needs to be nailed down
  before this module is written.
- **One narrow, documented exception (now used three times, two of them
  three-way):** a genuinely atomic cross-slice state transition — Expenses
  affecting `budget.currentBalanceCents` (two slices); confirming an
  Income received touching `incomes`, `budget.currentBalanceCents`,
  **and** `incomeReceipts` (docs/DATA-MODEL.md "IncomeReceipt"); and
  marking a Bill paid/unpaid touching `bills`, `budget.currentBalanceCents`,
  **and** `billPayments` the same way (docs/DATA-MODEL.md "BillPayment")
  — is *not* routed through the event bus, because the affected slices
  must update together in one state transition, not several separate
  dispatches that could leave them briefly inconsistent. The owning
  module(s) (`src/modules/expenses/balance-effect.js`; `src/modules/
  incomes/balance-effect.js` + `src/modules/income-receipts/
  create-receipt.js`; `src/modules/bills/balance-effect.js` + `src/
  modules/bill-payments/create-payment.js`) stay self-contained (each a
  pure function computing *what changed*, with no knowledge of the other
  slices' internals); only `src/main.js`'s
  `rootReducer` — the one place with full-state visibility — applies the
  effect(s) across every slice a given action touches. Reach for this
  pattern only when slices genuinely must change atomically; anything
  that can tolerate a render in between should
  still use the event bus or re-derivation.

## 8. Offline & resilience

- The dev version loads via native ES modules over `file://` or a static
  file server — no dev server framework required, though a trivial static
  server may be used for convenience.
- The distributable single-file build has zero external requests, so it
  is offline by construction; no service worker is required for the
  single-file artifact. (A service worker could be considered later only
  if the app is ever also hosted online as multiple files — not in
  current scope.)
- The app must degrade gracefully if `localStorage` is unavailable
  (private browsing edge cases, storage disabled): detect at startup, and
  show a clear, calm message rather than a blank/broken screen. Data just
  won't persist across reloads in that case.
- Corrupted/unparseable stored data must never crash the app on load; the
  storage adapter catches this, preserves the raw corrupted value under a
  recovery key for possible manual inspection, and starts from a fresh
  empty state.

## 9. Accessibility & performance

- Semantic HTML first; ARIA only to fill real gaps.
- Keyboard operability is required for all primary actions (capture,
  complete, navigate) — many users of this app benefit from not needing a
  mouse for fast capture.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`.
- Given the vanilla-JS/no-framework approach and small expected data
  volumes (personal use, single user), performance risk is low; no
  virtualization or heavy optimization is expected to be necessary. Revisit
  only if real usage shows a problem.

## 10. Versioning

- The **data schema version** (stored in the state blob) and the **app
  build/release version** are tracked separately — a code release can ship
  without a schema change, and vice versa should not happen (a schema
  change always ships with a code release that can migrate it).
- See `docs/DATA-MODEL.md` for schema versioning and migration mechanics.
