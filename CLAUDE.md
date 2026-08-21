# CLAUDE.md

Instructions for any Claude Code session (or other AI agent) working in this
repository. Read this file first. Then read, in this order:

1. `docs/PRODUCT.md` — what we're building and why
2. `docs/ARCHITECTURE.md` — how it's built
3. `docs/DATA-MODEL.md` — how data is shaped and stored
4. `docs/ROADMAP.md` — what phase we're in right now
5. `docs/TEST-PLAN.md` — how changes get validated

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

## Product discipline

- The **Today screen is the center of the product.** Every new feature must
  answer "how does this show up on Today?" before it's considered done. A
  feature that only lives on its own screen and never surfaces on Today is
  incomplete.
- **Answer questions, don't dump data.** Every screen should be evaluated
  against: "Could this instead tell the user what to do?" (see
  `docs/PRODUCT.md` for the canonical examples). Raw lists are a fallback,
  not the default.
- **Reducing user effort beats adding features.** When in doubt, cut scope
  rather than add a setting, a field, or a screen. Do not add features
  beyond the 11 modules listed in `docs/PRODUCT.md` without an explicit
  user decision.
- **Progressive disclosure.** Default views stay minimal; power/detail
  views are opt-in, never the first thing shown.

## Process discipline

- **Follow the roadmap phase order** in `docs/ROADMAP.md`. Do not start
  Tasks, Money, or any other feature module ahead of its phase unless the
  user explicitly asks for it in those words.
- **This repository intentionally starts from zero code.** Do not port,
  copy, or reference implementation from any prior ADHD planner prototype.
  Prior work (if ever mentioned) is concept validation only, not a
  technical foundation.
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

As of this writing, the repository contains **specification only**: this
file, `README.md`, and `docs/`. No application code, no UI, no build
tooling, and no `package.json` exist yet. `docs/ROADMAP.md` defines Phase 0
as the current phase — do not jump ahead to feature implementation without
the user explicitly moving the project into a later phase.
