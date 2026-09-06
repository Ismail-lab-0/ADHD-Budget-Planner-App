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
    budget/          # Current Balance + the Savings figure (single-value; Safety Buffer removed, see docs/SAFE-TO-SPEND.md). `budget/add-to-savings` is a Current Balance cross-slice effect (a real transfer — debits the balance, raises savings; src/main.js's rootReducer); `budget/set` (correcting either figure) is not. The Savings figure is display-only w.r.t. safe-to-spend/ (docs/SAFE-TO-SPEND.md §9)
    incomes/          # Income + Paydays; also owns the Current Balance cross-slice effect for confirmed-received income (balance-effect.js — see docs/DATA-MODEL.md §3a), mirroring expenses/'s pattern below
    bills/              # Upcoming Bills; also owns the Current Balance cross-slice effect for a bill marked paid/unpaid (balance-effect.js — see docs/DATA-MODEL.md §3a), same pattern as incomes/ and expenses/ below
    planned-expenses/     # Planned Expenses
    expenses/               # logged spending; also owns the Current Balance cross-slice effect (balance-effect.js — see docs/DATA-MODEL.md §3a)
    category-budgets/        # optional monthly spending limits — read-only w.r.t. safe-to-spend/, see docs/SAFE-TO-SPEND.md §3b
    income-receipts/            # automatic historical log of confirmed income (docs/DATA-MODEL.md "IncomeReceipt") — no CRUD of its own, created by incomes/'s "Mark received" via src/main.js's rootReducer, read by dashboard/'s getPeriodSummary
    bill-payments/               # the Bill-side counterpart to income-receipts/ (docs/DATA-MODEL.md "BillPayment") — created/un-created by bills/'s "Mark paid"/"Mark unpaid" via src/main.js's rootReducer, read by dashboard/'s getPeriodSummary
    expense-drafts/                # "Brain dump" quick-capture data (docs/DATA-MODEL.md "ExpenseDraft") — plain generic slice routing (not a cross-slice effect like incomes/bills/expenses above); never read by safe-to-spend/, same exclusion as category-budgets/
    debts/                           # Debt Tracking (docs/DATA-MODEL.md "Debt"/"DebtPayment") — CRUD routes generically; `debts/record-payment` is a cross-slice effect (payment-effect.js) touching debts + expenses + budget + debtPayments at once (src/main.js's rootReducer). Never read by safe-to-spend/ — a payment reaches Safe-to-Spend only via the ordinary Expense it logs (docs/SAFE-TO-SPEND.md §3c), same exclusion as category-budgets/
    goals/                           # Savings goals (docs/DATA-MODEL.md "Goal") — the Budget tab reworked into a Goals tab. Plain generic slice routing, no cross-slice effect. UNLIKE the trackers above, a goal's savedCents DOES reduce Safe-to-Spend — protected/committed money — via safe-to-spend/calculation.js reading `state.goals` raw (`sumGoalsSaved`), not an import (docs/SAFE-TO-SPEND.md §3d). (The flat Savings figure used to work the same way; it no longer subtracts — §9.)
    safe-to-spend/              # getSafeToSpend/getSpendingAllowance — pure calc, see docs/SAFE-TO-SPEND.md; consumed by the dashboard
    dashboard/                    # getUpcomingCommitments/getUpcomingBills/getUpcomingIncome/getPeriodSummary + getMonthlyInVsOut (12× getPeriodSummary — the Dashboard's Income-vs-Expenses chart) + getExpensesMonthOverMonth (this month vs last, the Total-Expenses delta) + getSafeToSpendBreakdown (getSafeToSpend's result + a `period` block of this-month Expense/BillPayment/IncomeReceipt sums, so the hero's "How is this worked out?" panel can show spending as visible deductions — reconciles by construction, no re-derivation of the STS arithmetic) — composition/selection only, no money arithmetic that isn't a plain sum
    settings/                       # onboardingCompletedAt (completeOnboardingAction/hasCompletedOnboarding), theme (setThemeAction/getTheme — see src/ui/components/theme-toggle.js), and currency (setCurrencyAction/getCurrency — see src/ui/components/currency-selector.js, src/core/money.js)
    # not yet built: backup/ — see docs/ROADMAP.md
  /ui
    router.js         # tiny hash-based view router (getCurrentView/navigateToView/initViewRouter) — no framework; the whole contract is "read a view id from location.hash" + "set it" + "re-render on hashchange". Application state is completely independent of the hash: switching views, refresh, and Back/Forward never touch data
    shell.js          # mounts the CURRENT view (VIEW_RENDERERS keyed by router.getCurrentView()) into <main>; re-renders on every store change AND on hashchange (+ scroll to top on route change — docs/PRODUCT.md §15/§17); gates on hasCompletedOnboarding (onboarding ignores the route); toggles a `.theme-dark`/`.theme-light` class on <html> from the stored theme preference on every render (docs/DATA-MODEL.md "Settings"), plus `has-sidebar`/`sidebar-collapsed`/`sidebar-drawer-open` classes on <body> that the sidebar CSS keys off. Owns the single global `keydown` listener (attached once, at mount time) for the "N" quick-capture shortcut, guarded against firing during onboarding. **The app is a real multi-view application** — each sidebar item is a dedicated screen, not a scroll anchor
    dom.js             # tiny createElement/appendChild helper (`el()`)
    demo-gate.js       # the demo-build gate — `DEMO_MODE` flag (rewritten by build/build.js --demo), `DEMO_LIMIT` (25), and the single `canAddExpense(state)` guard every expense-creation path runs through (the Add expense modal on the dashboard + Expenses view, and the Brain Dump Inbox "Convert to expense" flow). Also owns `renderDemoNotice(state)` (the quiet "N of 25 demo expenses left" line under the dashboard, from count 20) and `showDemoLimit()` (a calm in-app modal reusing the shared `.modal` styling, appended to `<body>`, linking to `ETSY_URL`). Imported first from main.js so the flag lands near the top of the bundle. Every export is a no-op / null when `DEMO_MODE` is false — the full build has nothing demo-related reachable

    components/        # small shared render helpers (not a component framework); more-options.js is the shared "+ More options" progressive-disclosure wrapper; icons.js is the inline SVG icon set (icon/iconChip/sectionHeading/categoryIconChip/categoryEmojiBadge) — no CDN, hand-authored, see CLAUDE.md's no-network-request rule; popup.js is the shared centered modal, period-selector.js a lighter anchored-dropdown variant of the same open/close pattern; brain-dump.js owns the "+ Brain dump" header button + its stays-open-after-save capture popup (opened by either the button or shell.js's "N" shortcut); inbox-section.js is the Inbox card reading expense-drafts/, including its own "Convert to expense" popup (reuses expenses-section.js's renderExpenseForm via its new initialDescription prefill option); stat-card.js is a headline stat card (icon + label + big value + optional "±X% ↑ from last month" delta chip, or a plain supporting `note` line; optional `tone` — 'positive'/'caution'/'attention' — tints the whole card a `--color-status-*-bg` instead of white) — the Dashboard's neutral top row of three (Total Expenses this month with delta, Total Savings, Total debt to pay via `getTotalDebtCents`, above the Safe-to-Spend card), and the one tinted per-tab summary card leading each money view, all but Debts scoped to the header bar's global period filter (`getSelectedPeriod` + `resolvePeriodRange`, label from `getPeriodLabel`): Income "Received · <period>" (positive, `getIncomeReceiptsForPeriod`), Expenses "Spent · <period>" (caution, `getExpensesForPeriod` — replaced the old plain "Total: …" line), Bills "Bills paid · <period>" (attention, `getBillPaymentsForPeriod`, with the still-outstanding total as its note), Debts "Still owed" (attention, `getTotalDebtCents` — a current-state figure, deliberately *not* period-scoped). The Dashboard's own "Total expenses · <period>" stat card follows the filter the same way (month-over-month delta chip only when the period is "This month"); charts.js has the Dashboard's "Income vs Expenses" chart — renderColumnChart, grouped 2-series columns (Income teal / Expenses coral, the `--color-chart-income`/`--color-chart-expense` tokens — a distinct dataviz series pair, validated for both themes) per month, hand-authored SVG built as a string (same technique as icons.js, no chart library), a legend + native `<title>` per mark for hover; single-value-section.js exports `renderEditTotalForm` (a small "set this money value directly" popup form) — used by the sidebar footer's Current Balance / Savings pencils; its `renderSingleValueSection` card is currently unused (kept — its shape has been reused repeatedly as the layout evolved). right-now-section.js was DELETED when the Budget tab became the Goals tab — its "Money in / Money out this period" card + Safe-to-Spend line were dropped from that view at the user's choice (that period info now lives on the Income "Received" / Expenses "Spent" cards; the Safe-to-Spend number is on the dashboard). currency-selector.js is the currency picker — an icon button showing the active currency's sign (getCurrencySymbol), in the header bar's right-side controls group alongside the period selector and theme toggle — a display preference only, see money.js's own entry above and docs/DATA-MODEL.md "Settings"; debts-section.js is the "Debt overview" card (a "Still owed" `renderStatCard` summary on the Debts view — total across every debt via `getTotalDebtCents` — then per-debt progress bar, % paid, paid-off state; in `compact` mode a summary + "View all debts →", otherwise each debt row gets payoff estimate + a "Make payment" popup + a pencil (opens an edit popup) + a trash — no separate "Manage debts" popup; used by debts-view.js), reading modules/debts/; the other list-shaped cards (bills-due-soon.js, upcoming-income.js, category-budgets-section.js, expenses-section.js) follow the same `compact` convention — one implementation, dashboard-summary vs full-management by a flag. category-budgets-section.js non-`compact` (the Categories view) now matches Bills/Debts/Goals: no outer card, each category is its own `.category-row` card (`.category-list--cards`) with a pencil (opens an edit popup) + trash; "+ Add category" is categories-view.js's view-header `titleAction`, the old "Edit categories" popup is gone. The `compact` dashboard "Budget progress" card is unchanged (one card, plain `.category-list`, read-only). sidebar.js is the left navigation for the multi-view app — each item is a hash route (router.js), the main content swaps completely between views, the sidebar + header bar are the persistent shell. It's a fixed collapsible rail at >=1024px and an off-canvas hamburger drawer below that; the collapsed/drawer flags are ephemeral module state (nothing persisted), the active item is driven by the current route passed in as `activeView`. It also renders a **compact footer card** (Current Balance + Savings, each with a small icon — wallet / target — a read-out, and a pencil that opens a `renderEditTotalForm` popup) — these moved here from the former Budget tab; a tinted panel pushed to the bottom of the rail, hidden when collapsed. `renderSidebar` takes `state`/`dispatch`/`requestRender` for that footer and returns `{ nav, scrim, editPopup }` — the popup is returned separately (not nested in `<nav>`, whose mobile-drawer `transform` would clip a `position: fixed` backdrop) and placed at the screen root by app-frame.js. app-frame.js is that persistent shell (renderAppFrame): sidebar + mobile scrim + the sidebar's editPopup + header bar wrapping each view's `body`, wiring navigation/collapse/drawer/the global period selector once for every screen
    screens/            # one file per view: dashboard.js (the overview, laid out after a fintech-dashboard reference — a stack of responsive row grids: `.dashboard__top` three even stat cards (Total Expenses this month / Total Savings / Total debt to pay, all `renderStatCard`), `.dashboard__mid` the emphasised accent-tinted Safe-to-Spend card (pure display — no buttons) beside the Income-vs-Expenses monthly chart at matched height (chart-driven — the hero's disclaimer pinned to the card's bottom via `.hero__disclaimer { margin-top: auto }`), `.dashboard__bottom` a 2-up row [Budget progress | Recent Expenses table]; then the Inbox + privacy line. The "+ Add expense" action is the dashboard's view-header `titleAction` (top of the page, next to the greeting), opening `renderExpenseForm` in a `renderPopup` — the same pattern the other views use for their "+ Add X". Each grid collapses to fewer columns on tablet and one on mobile), income-view.js, expenses-view.js, bills-view.js, debts-view.js, goals-view.js, categories-view.js, settings-view.js, and onboarding.js (a one-question-at-a-time wizard — name / balance+savings / income(s) / bills / debts, each step optional; the income/bills/debts steps reuse the real `renderIncomeForm`/`renderBillForm`/`renderDebtForm` and allow multiple entries). **goals-view.js** (route `#goals`, alias from `#budget`) replaced budget-view.js: savings goals as `.goal-row` cards (same treatment as `.debt-row` — border, soft shadow, rounded), each with a progress bar toward its target (8px pill, hero-styled positive fill), "$X of $Y", an optional "~$X/month · about N months to go" line, a "Reached 🎉" state, and a pencil (opens an edit popup) + trash; "+ Add a goal" is the view-header `titleAction`. A goal's savedCents is protected money (docs/SAFE-TO-SPEND.md §3d). Every view screen wraps its content in `renderAppFrame` (components/app-frame.js). The dedicated views reuse the same section components the dashboard used to summarise — those still take a `compact` flag (used elsewhere), but the dashboard itself no longer renders them. On the Income / Expenses / Bills / Debts views the non-`compact` render has **no outer container card** — each record is its own card (`.money-list--cards` rows / `.debt-row`) sitting directly on the page inside a bare `.view-stack`, led by that tab's tinted summary stat card; the redundant section heading is dropped (the view header's `<h1>` already names the page). Every record row (Income / Expenses / Bills / Debts / Goals / Categories) carries the **same actions**: its primary toggle where relevant (Mark received / Mark paid/unpaid / Make payment) plus a pencil `iconButton` that opens the shared add/edit form in a `renderPopup` (a module-level `editing<X>Id` flag; the view/section builds an `editPopup` when it's set, keyed off `records.find(id)`) and a trash `iconButton` (`tone: 'attention'`, `window.confirm`). The pencil used to expand an inline form in place (`.<x>-row--editing` / `.money-item--editing` — all now removed); it's a popup everywhere, matching the "+ Add X" popups and the sidebar's balance/savings pencils. The old per-view "Manage bills" / "Manage debts" / "Edit categories" popups and the "Edit"/"Delete" text buttons on Expenses are gone
  /styles
    base.css
    components.css
    responsive.css
  main.js              # dev entry point, wires core + modules + shell
index.html             # dev entry HTML (loads main.js as an ES module)
/build
  build.js             # inlines src/* into one self-contained HTML file; `--demo` -> dist/index.html (gated public demo, DEMO_MODE flipped to true), no flag -> dist/app-x7k2m9/index.html (full/paid build). The ONLY difference between the two IN THE HTML is the DEMO_MODE flag rewrite — see src/ui/demo-gate.js. The paid build keeps the index.html filename (buyers' Add to Home Screen / offline install needs it) but sits in an unguessable dir so it isn't at a predictable public URL; that dir name is only in build.js, never bundled into the demo. For the paid build only, build.js also splices the PWA <head> tags + a service-worker registration snippet into the HTML and calls build/pwa.js to write the sidecar files
  pwa.js               # PWA sidecars for the paid build ONLY (never the demo): writes manifest.json, sw.js (one versioned cache, filled on install, pruned on activate — cache-first, so the single-file shell opens fully offline), and three icon PNGs (192 / 512 / 180 apple-touch-icon) rasterised at build time from icons.js's `brand` glyph on a solid #1F3D2B field via a tiny self-contained PNG encoder (built-in zlib + inline CRC-32 — no image dependency, no network). Exports pwaHeadTags()/pwaRegisterScript()/writePwaAssets(); nothing here is reachable from a --demo build
  serve.js             # zero-dependency local static server for dev (serves .png / .webmanifest too, for local PWA checks)
/dist
  index.html                     # generated — the gated public demo build (npm run build:demo); a single self-contained file, nothing PWA-related
  app-x7k2m9/index.html          # generated — the full/paid build, no limits (npm run build:full); tracked, so buyers can host it for offline install
  app-x7k2m9/manifest.json       # generated — PWA manifest (name/short_name/display standalone/theme+background colour/start_url/192+512 icons)
  app-x7k2m9/sw.js               # generated — service worker (cache `budget-planner-v1`)
  app-x7k2m9/icon-192.png        # generated — maskable app icon
  app-x7k2m9/icon-512.png        # generated — maskable app icon
  app-x7k2m9/apple-touch-icon.png # generated — 180px iOS home-screen icon
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
- **One narrow, documented exception (now used five times, three of them
  three-slice-or-more):** a genuinely atomic cross-slice state transition
  — Expenses affecting `budget.currentBalanceCents` (two slices);
  confirming an Income received touching `incomes`,
  `budget.currentBalanceCents`, **and** `incomeReceipts`
  (docs/DATA-MODEL.md "IncomeReceipt"); marking a Bill paid/unpaid
  touching `bills`, `budget.currentBalanceCents`, **and** `billPayments`
  the same way (docs/DATA-MODEL.md "BillPayment"); recording a Debt
  payment touching `debts`, `expenses`, `budget.currentBalanceCents`,
  **and** `debtPayments` (docs/DATA-MODEL.md "Debt"/"DebtPayment"); and
  moving money into Savings (`budget/add-to-savings`) touching
  `budget.savingsAllocationCents` **and** `budget.currentBalanceCents`
  (two slices — a real transfer; docs/SAFE-TO-SPEND.md §9) — is
  *not* routed through the event bus, because the affected slices must
  update together in one state transition, not several separate
  dispatches that could leave them briefly inconsistent. The owning
  module(s) (`src/modules/expenses/balance-effect.js`; `src/modules/
  incomes/balance-effect.js` + `src/modules/income-receipts/
  create-receipt.js`; `src/modules/bills/balance-effect.js` + `src/
  modules/bill-payments/create-payment.js`; `src/modules/debts/
  payment-effect.js`; `src/modules/budget/reducer.js`'s
  `budget/add-to-savings` case) stay self-contained (each a
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
