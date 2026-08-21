# Roadmap

This roadmap sequences the work. Phases are meant to be done in order —
later phases assume earlier ones exist. Per `CLAUDE.md`, do not start a
module ahead of its phase without the user explicitly asking for it.

**Current phase: Phase 0, not yet started (specification only).** This
repository currently contains only `CLAUDE.md`, `README.md`, and `docs/`.

## Phase 0 — Foundation (scaffolding, no features)

Goal: a minimal, boring, well-tested core that every future module builds
on. No task list, no calendar, no UI screens beyond an empty shell.

- Project scaffolding: `/src` directory layout as described in
  `docs/ARCHITECTURE.md`, dev `index.html` + `main.js` entry point.
- Core services: state store (`get`/`dispatch`/`subscribe`), event bus,
  date utilities, id generator.
- Storage adapter: load/save against `localStorage`, schema version field,
  migration runner (with zero migrations needed yet, but the mechanism in
  place), corrupted-data recovery path.
- Minimal UI shell: navigation between placeholder screens, nothing
  module-specific yet.
- Build script that inlines `/src` and `/styles` into a single
  `dist/index.html`, proven against the empty shell (so the "must be
  buildable to one file" constraint is validated early, not discovered
  late).
- Unit test setup using `node:test`, with tests for the store, event bus,
  date utils, id generator, and storage adapter (including the
  corrupted-data and migration-runner paths).

Exit criteria: an empty app that opens, persists an empty state, survives
a reload, and builds to a working single HTML file — before any feature
logic exists.

## Phase 1 — Today + Tasks + Next Action

The smallest slice that makes the core loop (Capture → Organize →
Prioritize → Act) real.

- Tasks module: capture (title-only required), list, complete, edit
  optional fields.
- Next Action engine: `getNextAction(state)` selector implementing the
  "what should I do next" logic (due date, staleness, effort/energy if
  provided).
- Today screen: shows the Next Action prominently, plus a short list of
  what else is due today. This is the first real version of the product's
  center screen.

Exit criteria: a user can capture a task in one step, and Today tells
them what to do next without them having to sort or prioritize anything
themselves.

## Phase 2 — Calendar + Routines

- Calendar module: create/view time-anchored events, optional prep note.
- Routines module: define a routine template, generate/track today's
  instance, "what's left in your routine" view.
- Today screen updated to include today's events and routine progress.

Exit criteria: Today reflects a full day's shape (tasks, events, routine
progress), not just tasks.

## Phase 3 — Money + Safe-to-Spend

- Money module: accounts, transactions (manual entry only — no bank
  sync), known upcoming obligations.
- Safe-to-Spend engine: `getSafeToSpend(state)` derived answer.
- Today screen updated to include the Safe-to-Spend answer.

Exit criteria: the user gets a direct spendable-amount answer, never a
raw transaction ledger, as the primary Money-related surface on Today.

## Phase 4 — Goals

- Goals module: create a goal, generate/attach its current next-action
  Task.
- Today/Next Action updated to be goal-aware (a goal's next action can
  surface like any other task).

Exit criteria: a goal always has a visible, current next action without
the user maintaining it manually.

## Phase 5 — Weekly Review

- A short guided review flow: app pre-surfaces stale tasks, completed
  work, and goal progress candidates; user confirms/adjusts rather than
  auditing everything from scratch.
- Stores a lightweight `WeeklyReviewSnapshot`.

Exit criteria: a full review takes a few minutes and requires the app to
have done most of the noticing.

## Phase 6 — Onboarding

- First-run flow capturing the minimum needed to make Today, Next Action,
  and Safe-to-Spend useful immediately (not full setup of every module).
- Progressive disclosure applied to onboarding itself: advanced/optional
  setup deferred to in-context prompts later, not front-loaded.

Exit criteria: a new user reaches a useful Today screen in well under a
few minutes.

## Phase 7 — Data Backup / Import / Export

- Export current state as a downloadable JSON file.
- Import a previously exported file, with validation, migration, and
  explicit confirmation before overwrite.
- Basic "storage getting large" warning surfaced through the UI, not
  silent failure.

Exit criteria: a user can move their data to a new browser/device
confidently, and recover from accidental data loss if they exported
recently.

## Phase 8 — Single-file packaging & release polish

- Harden the build script (asset inlining, minification if warranted,
  reproducible output).
- Final QA pass of the distributable single HTML file across target
  browsers, verifying full offline operation from a local file.

Exit criteria: `dist/index.html` is the real, shippable product artifact.

## Phase 9 — Accessibility & hardening pass

- Full keyboard-operability audit, `prefers-reduced-motion` /
  `prefers-color-scheme` verification, screen-reader spot checks.
- Data-integrity hardening: fuzz/edge-case tests on migrations and
  import/export round-tripping.

Exit criteria: see `docs/TEST-PLAN.md` for the concrete checklist this
phase must clear.

## Explicitly out of scope for now

- Any backend, sync, or multi-device real-time story beyond manual
  export/import.
- Any AI-assisted feature that requires an external API/key.
- Any module not listed in `docs/PRODUCT.md` §4's 11 modules, without an
  explicit user decision to expand scope.
