# ADHD Life Planner

> Your planner shouldn't become another thing you have to manage.

A low-friction personal life-management web application, initially
positioned for people with ADHD-related organizational challenges. It
helps with capturing, organizing, prioritizing, and reviewing daily life —
tasks, calendar, routines, money, and goals — while trying to minimize the
effort that normally goes into *running* a planning system.

## Status

**Specification phase.** This repository currently contains product and
technical documentation only — no application code yet. See
`docs/ROADMAP.md` for what's planned and in what order.

## Why this exists

Most planners, spreadsheets, and productivity systems require the user to
continuously organize, prioritize, update, and maintain the system itself.
That maintenance becomes its own source of friction — often the exact
friction people who struggle with executive function can least afford.
This project's core bet is that a planner should do more of that work
itself: capture things with minimal effort, and then tell the user what
matters right now, instead of just displaying everything and leaving the
prioritizing to them.

See `docs/PRODUCT.md` for the full product vision and principles.

## Documentation

- [`docs/PRODUCT.md`](docs/PRODUCT.md) — product vision, target problem,
  UX principles, and module descriptions
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — technical architecture,
  state management, and module boundaries
- [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) — data model and localStorage
  strategy
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — development roadmap and current
  phase
- [`docs/TEST-PLAN.md`](docs/TEST-PLAN.md) — testing strategy
- [`CLAUDE.md`](CLAUDE.md) — rules for AI-assisted development sessions in
  this repository

## Technical direction

- Plain HTML, CSS, and JavaScript — no framework
- `localStorage` only — no backend, no login, no accounts
- No external AI API calls, no API keys, no analytics or telemetry
- Fully offline-capable
- Developed as multiple modules/files; the shipped product is eventually
  built into a single self-contained HTML file

## Getting started

There is no build yet — application code hasn't been written. Once
scaffolding lands (see `docs/ROADMAP.md`, Phase 0), this section will be
updated with real run/build/test instructions.

## Contributing / AI-assisted development

If you're working in this repo with Claude Code (or another AI coding
agent), read [`CLAUDE.md`](CLAUDE.md) first — it lays out the constraints
and process rules the project depends on (no backend, no medical claims,
phase ordering, module boundaries, etc.).

## License

Not yet decided.
