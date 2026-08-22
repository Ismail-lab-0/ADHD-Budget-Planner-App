# ADHD Budget Planner

> Know what you can safely spend — without doing the math.

A low-friction, browser-based personal budgeting application, initially
positioned for people with ADHD-related organizational challenges around
money. It answers one question — "how much can I safely spend right now
while still covering my upcoming financial commitments?" — instead of
requiring the user to maintain a spreadsheet's worth of formulas
themselves.

> **Note:** this project originally started as a broader "ADHD Life
> Planner" (tasks, calendar, routines, goals). That direction has been
> retired in favor of the focused budgeting product described above — see
> `docs/PRODUCT.md` §9 for what that pivot means for the code in this
> repo.

## Status

**Phases 0–8 complete:** the application shell, the budgeting engine
(Current Balance, Income, Bills, Planned Expenses, Savings, and Safety
Buffer — all in `localStorage`, money as integer cents), the
Safe-to-Spend calculation (`docs/SAFE-TO-SPEND.md` for the exact
formula), the Safe-to-Spend Dashboard (the app's home screen — estimated
safe-to-spend, days until payday, approximate daily allowance, a money
breakdown, quick actions, upcoming commitments), real expense tracking
(fast entry, only amount required, customizable categories, and a
formally documented Current Balance model — `docs/DATA-MODEL.md` §3a: a
user-set checkpoint, automatically adjusted as you log spending, that can
go negative rather than silently lying about your balance), **optional
category budgets** — simple monthly spending limits with progress
indicators, deliberately kept from ever double-counting against
Safe-to-Spend (`docs/SAFE-TO-SPEND.md` §3b), and **onboarding and product
polish** — a short, skippable setup flow for first-time use (balance,
next payday, upcoming bills, safety buffer, optional savings target),
automatically skipped for anyone who already has data, progressive
disclosure on the Add Expense/Add Bill/Add Income forms so only the
essential fields show by default, plain-language empty states, and a
mobile-usability and language pass. The Tasks/Next Action code built
under the retired product direction has been removed. See
`docs/ROADMAP.md` for what's planned and in what order.

## Why this exists

Budgeting systems — spreadsheets, apps, envelopes — tend to require the
user to continuously collect financial information, categorize
transactions, calculate what's available, remember upcoming bills, and
account for savings, just to answer "can I afford this?" That maintenance
becomes its own source of friction. This project's core bet is that the
app should carry that burden instead: the user enters what changed, and
the app tells them, plainly, what's safe to spend — instead of leaving the
arithmetic to them.

See `docs/PRODUCT.md` for the full product vision and principles.

## Documentation

- [`docs/PRODUCT.md`](docs/PRODUCT.md) — product vision, target problem,
  UX principles, and module descriptions
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — technical architecture,
  state management, and module boundaries
- [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) — data model and localStorage
  strategy
- [`docs/SAFE-TO-SPEND.md`](docs/SAFE-TO-SPEND.md) — the exact
  Safe-to-Spend formula and the reasoning behind it
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

No dependencies to install — everything here is plain HTML/CSS/JS plus
Node's built-in tooling.

### Run the app locally

Browsers (Chrome in particular) block ES modules from loading over
`file://`, so serve the dev version over `http://localhost` with the
included zero-dependency static server:

```
npm start
```

Then open the printed URL (defaults to <http://localhost:5173>).

### Build the single-file distributable

```
npm run build
```

This inlines `/src` and `/src/styles` into one self-contained
`dist/index.html`. Once built, that file can be opened directly from disk
(`file://`) with no server and no network access — it's the real shippable
artifact (see `docs/ARCHITECTURE.md`).

### Run the tests

```
npm test
```

This runs Node's built-in test runner (`node --test`) against
`tests/unit/`.

## Contributing / AI-assisted development

If you're working in this repo with Claude Code (or another AI coding
agent), read [`CLAUDE.md`](CLAUDE.md) first — it lays out the constraints
and process rules the project depends on (no backend, no medical claims,
phase ordering, module boundaries, etc.).

## License

Not yet decided.
