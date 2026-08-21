# Test Plan

This document defines how correctness is validated in this project, given
there is no backend and no hosted deployment to test against. Testing
strategy scales up with the roadmap phases in `docs/ROADMAP.md`.

## 1. Philosophy

- **Test the logic, not the framework.** Since there's no UI framework
  and no backend, the highest-value tests are pure-function unit tests
  against `/core` and each module's selector/derivation logic (Next
  Action, Safe-to-Spend, Today aggregation, migrations). These are cheap,
  fast, and don't need a browser or DOM.
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

- **Phase 1 — Tasks / Next Action:**
  - Task capture with only a title produces a valid Task.
  - Next Action selector: deterministic given a fixed state and fixed
    "now" (inject the current time rather than reading the real clock,
    so tests are deterministic); covers due-today, overdue, no-due-date,
    and empty-task-list cases.

- **Phase 2 — Calendar / Routines:**
  - Routine instance generation for "today" from a template, idempotent
    if called twice for the same day.
  - Calendar event queries for "today"/"upcoming."

- **Phase 3 — Money / Safe-to-Spend:**
  - Safe-to-Spend calculation against hand-built fixtures: known balance,
    known obligations before next income date, verifying the arithmetic
    directly (this is the module most likely to be trusted blindly by
    users, so its test fixtures should cover at least: no obligations,
    one obligation before payday, obligations that exceed balance,
    multiple accounts).

- **Phase 4 — Goals:**
  - Creating a goal produces a linked next-action Task; completing that
    Task updates the goal's `nextActionTaskId` appropriately (per however
    the "generate the next one" behavior is specified when implemented).

- **Phase 5 — Weekly Review:**
  - Stale-task detection logic against fixtures.

- **Phase 7 — Backup / Import / Export:**
  - Export-then-import round-trip produces equivalent state.
  - Import of a file with an older `schemaVersion` runs migrations
    correctly.
  - Import of malformed/non-JSON input is rejected with a clear error,
    without mutating current state.

- **Ongoing, every phase:** any bug fix should come with a regression
  test that fails before the fix and passes after.

## 3. Manual test checklists

Run before considering a phase's exit criteria met, and again before any
Phase 8 release-polish pass. Each module gets a short checklist rather
than a generic "click around" pass.

### Capture-friction checklist (Tasks, and any future capture point)

- [ ] Can a new item be captured with a single required field, in a
      single visible step, without a forced modal chain?
- [ ] Does pressing Enter (or the equivalent primary action) from the
      capture field save the item without extra clicks?
- [ ] Is optional detail (due date, effort, etc.) reachable but not
      required?

### Today screen checklist

- [ ] Does Today load to something useful (not blank, not an empty
      state that offers no next step) for a user with at least one task,
      one event, and one routine?
- [ ] Is the primary Next Action visually the most prominent thing on
      the screen?
- [ ] Does the screen stay calm/uncluttered as data volume grows (e.g.
      20+ tasks, several events) — progressive disclosure holding up
      rather than the screen turning into a dashboard dump?

### Safe-to-Spend checklist

- [ ] Does the number shown match a hand-calculated expectation for a
      known test scenario?
- [ ] Is the answer framed as "you can safely spend $X," not as a raw
      transaction list?
- [ ] Does it update immediately after adding a transaction or
      obligation?

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

- [ ] Open the built `dist/index.html` directly from disk (`file://`),
      with network access disabled — the app fully works.
- [ ] No requests appear in the browser's network panel during normal
      use.

### Accessibility checklist (rigorous pass in Phase 9, spot-checked
earlier)

- [ ] Every primary action (capture, complete, navigate between screens)
      is reachable and operable via keyboard alone.
- [ ] Visible focus indicator at every interactive element.
- [ ] Color is never the only signal (e.g. overdue isn't red-only —
      also labeled).
- [ ] `prefers-reduced-motion` is respected (no motion-heavy transitions
      when set).
- [ ] `prefers-color-scheme` is respected, and the in-app theme override
      in Settings works both ways.
- [ ] A quick screen-reader pass (e.g. VoiceOver/NVDA) on Today and the
      capture flow confirms sensible reading order and labels.

### ADHD-claims / tone checklist (content review, any phase touching
copy)

- [ ] No clinical/diagnostic/treatment language anywhere in new copy
      (see `docs/PRODUCT.md` §7).
- [ ] No guilt/shame-framed messaging for overdue items, broken streaks,
      or unreviewed backlogs (see `docs/PRODUCT.md` §6).

## 4. Definition of done (per feature)

A feature/module is considered done for its phase when:

1. It has unit test coverage for its non-trivial logic (selectors,
   derivations, migrations) per §2.
2. The relevant manual checklist(s) in §3 pass.
3. It integrates with Today per `CLAUDE.md`'s "every feature must answer
   how it shows up on Today" rule, unless explicitly scoped not to
   (state that exception in the PR/commit description if so).
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
