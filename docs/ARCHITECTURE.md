# Architecture

This document defines the technical architecture for ADHD Life Planner. It
is binding: implementation should follow it, and any deviation should
update this document in the same change (see `CLAUDE.md`).

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
     │   Feature Modules    │            │   Today Engine      │
     │ tasks / calendar /   │◄──────────►│ (aggregates feature │
     │ routines / money /   │  read via  │  module outputs into │
     │ goals / review /     │  selectors │  the Today view)     │
     │ onboarding / backup  │            └─────────┬───────────┘
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
  intent, e.g. `{ type: 'task/complete', id }`) → the store applies a pure
  update function to produce new state → the store persists the relevant
  slice via the storage adapter → the store publishes a change
  notification → subscribed UI re-renders from the new state.
- **Event bus:** a minimal pub/sub (`on(event, handler)`, `emit(event,
  payload)`, `off(...)`) used for state-change notifications and for
  cross-module signals that aren't full state (e.g. "a routine instance
  finished," which Today may want to react to without owning routine
  state). No framework needed — this is ~30 lines of code.
- **Derived state is computed, not stored.** Safe-to-Spend, "what should I
  do next," and Today's aggregated view are all *derived* from stored
  entities at read time (memoized if it becomes a real performance need).
  They are never separately persisted, which avoids them going stale or
  out of sync with their source data. See `docs/DATA-MODEL.md` §"Derived
  vs. stored data."
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

## 6. Directory layout (planned)

Not created until Phase 0 scaffolding begins (see `docs/ROADMAP.md`).
Documented here so structure is agreed on before code exists.

```
/src
  /core
    store.js         # state store: get/dispatch/subscribe
    events.js        # minimal pub/sub event bus
    storage.js        # the storage adapter (only module touching localStorage)
    schema.js         # schema version + migrations
    id.js              # id generation helper
    date.js            # date/time utilities (single source of "today", timezone handling)
  /modules
    today/
    tasks/
    next-action/
    calendar/
    routines/
    money/
    safe-to-spend/
    goals/
    weekly-review/
    onboarding/
    backup/
  /ui
    shell.js          # navigation + screen mounting
    components/        # small shared render helpers (not a component framework)
  /styles
    base.css
    <module>.css
  main.js              # dev entry point, wires core + modules + shell
index.html             # dev entry HTML (loads main.js as an ES module)
/build
  build.js             # inlines src/* into one dist/index.html
/dist
  index.html           # generated, self-contained distributable (not committed until it exists for real)
/tests
  unit/                # node:test files, one per logic module
docs/
CLAUDE.md
README.md
```

Each `/modules/<name>/` directory is expected to contain the module's
state slice/reducer, its derived-data/selector functions, and its UI
rendering, but *not* other modules' internals.

## 7. Module boundaries

- A feature module may depend on: `/core` (store, events, storage, id,
  date utils) and generic `/ui` helpers.
- A feature module may **not** import another feature module's internal
  files directly. If Today needs data derived from Tasks, it calls a
  selector function that the Tasks module exports as its public interface
  (e.g. `tasks/index.js` exporting `getTasksDueToday(state)`), not reach
  into `tasks/store.js`.
- Cross-module reactions (e.g. "completing a routine step should be
  reflected on Today immediately") go through the event bus or through
  Today re-deriving from state on the next state-change notification —
  never through a module directly calling into another module's update
  functions.
- The **Today module is the only module allowed to depend on many other
  modules' public selectors at once** (that's its job — composition). All
  other modules should be able to function with only `/core` as a
  dependency, so they stay independently understandable and testable.
- The **Safe-to-Spend and "What should I do next" engines** are themselves
  treated as modules with a narrow public interface (`getSafeToSpend(state)`,
  `getNextAction(state)`), not folded directly into Money/Tasks, so their
  logic can be unit-tested and reasoned about in isolation.

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
