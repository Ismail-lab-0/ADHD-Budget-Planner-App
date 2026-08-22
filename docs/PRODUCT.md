# Product Specification

> **Status: this supersedes an earlier, broader "ADHD Life Planner" concept**
> (general task management, calendar, routines, goals, weekly review). That
> direction has been retired. See §8 for what that means for existing code.

## 1. Product vision

ADHD Budget Planner is a simple, browser-based personal budgeting
application designed around low cognitive load. It answers one question,
clearly, at all times:

> **"How much money can I safely spend right now while still covering my
> upcoming financial commitments?"**

The core promise:

> **Know what you can safely spend — without doing the math.**

It is initially positioned for people with ADHD-related executive-function
challenges around money (the maintenance burden of budgeting is often
harder than the underlying spending decisions), but the underlying design
principle is broadly useful: budgeting should feel simpler than maintaining
a spreadsheet.

## 2. Target problem

The problem is not "people need another budget spreadsheet." Budgeting
systems already exist in abundance. The actual problem is that using one
well requires the user to repeatedly:

- collect financial information from multiple places,
- categorize transactions,
- calculate what's actually available,
- remember upcoming bills,
- account for savings they don't want to touch,
- estimate what's genuinely safe to spend, and
- keep doing all of the above, continuously, or the numbers go stale.

That maintenance overhead is the product's target, not the arithmetic
itself. The app's job is to carry as much of the collecting, calculating,
and remembering as it reasonably can, so the user mostly has to do two
things: **enter** what changed, and **read** one clear number.

This is a personal budgeting and organization tool. It does not diagnose,
treat, or make any medical claim about ADHD or any other condition — see
§7.

## 3. Core user experience

Opening the app should let the user quickly understand, in this order:

1. How much money they currently have.
2. What money is already committed (bills, planned expenses, savings).
3. What's left after those commitments.
4. How much they can safely spend right now.
5. How long that money needs to last (until the next payday).

### Design principles

1. **Safe-to-Spend is the primary feature.** Every other piece of data in
   the product exists to make that one number useful and accurate. See §4.
2. **One clear answer, not a dashboard.** The app is not a financial
   analytics tool. Avoid excessive charts, statistics, tables, categories,
   configuration, or navigation — see §5.
3. **Answer questions, don't just display data.** Same interaction
   principle as any well-designed tool in this space: interpret raw
   entries into a direct answer.

   | Instead of showing... | ...answer this question |
   |---|---|
   | "Here are your transactions." | "Here's how much you can safely spend." |
   | "Here is your account balance." | "Here's what's actually available after your commitments." |
   | "Here are your bills." | "Here's what's already spoken for before your next payday." |
   | "Here's your spending history." | "Here's your daily/weekly allowance until payday." |

4. **Minimal required inputs.** Every entry point (expense, bill, income)
   asks for as little as possible up front; detail is optional and
   reachable, never a gate.
5. **Progressive disclosure.** Default views stay minimal; detail is
   opt-in, never the first thing shown.
6. **One primary action at a time.** Screens are built around a single
   clear next step (log an expense, check Safe-to-Spend), not a menu of
   equally-weighted options.
7. **Calm, not "accounting software."** Simple language, clear visual
   hierarchy, helpful empty states, no red alarm-style warnings for normal
   use.
8. **No medical, diagnostic, or treatment claims about ADHD**, ever, in any
   surface of the product.

## 4. Core features

The primary feature is **Safe-to-Spend**. Everything below exists to make
that number possible, accurate, or easier to act on — nothing is scoped in
beyond what serves it.

1. **Current Balance** — what the user actually has right now, across one
   or more accounts.
2. **Income** — income the user expects (amount + schedule).
3. **Upcoming Bills** — known recurring/committed obligations (rent,
   utilities, subscriptions) with due dates.
4. **Planned Expenses** — known one-off future spends the user wants
   accounted for (not recurring, not yet spent).
5. **Expense Tracking** — fast logging of money actually spent, so the
   running numbers stay current.
6. **Savings** — money the user wants set aside and excluded from what's
   "safe to spend."
7. **Paydays** — when the user's next income is expected; drives "how long
   this needs to last."
8. **Safe-to-Spend** *(primary)* — the single derived answer: current
   balance minus everything committed between now and the next payday. See
   §6 for the calculation.
9. **Daily/Weekly Spending Allowance** — Safe-to-Spend divided across the
   days remaining until the next payday, as an easier-to-act-on pacing
   number.
10. **Budget Categories** — a light, optional tag on expenses/bills (not a
    full chart-of-accounts) — for context, not for building reports.
11. **Simple Dashboard** — the one home screen: Safe-to-Spend front and
    center, with just enough supporting context to trust the number (see
    §5).
12. **Onboarding** — a brief first-run flow that captures just enough
    (starting balance, one income source, known bills) to make Safe-to-Spend
    useful immediately.
13. **Data persistence** — `localStorage` only, same mechanism as today
    (see `docs/ARCHITECTURE.md`).
14. **Import/Export** — the user's only durability guarantee, since there's
    no backend or account (see `docs/DATA-MODEL.md`).
15. **Final standalone HTML distribution** — the shipped artifact is one
    self-contained `dist/index.html` (see `docs/ARCHITECTURE.md`).

Items 13–15 are infrastructure, already established by the existing
foundation (Phase 0/1) and largely reusable as-is — see §8.

> **Safety Buffer was removed** (a later user decision, after this feature
> list and phase order were originally written) — a flat, always-on
> cushion amount subtracted from Safe-to-Spend alongside Savings. See
> `docs/SAFE-TO-SPEND.md` §9 for where it used to fit in the formula and
> why removing it needed no data migration.

## 5. Non-goals

To keep the product from drifting back into a general life-management
tool:

- **Not general task management.** No to-do lists, no task capture/
  completion as a standalone feature.
- **Not a calendar app.** No time-anchored events unrelated to money.
- **Not a routines/habit tool.** No checklist sequences, no streaks.
- **Not general life planning.** No goals module, no weekly productivity
  review.
- **No task recommendation engine** ("what should I do next?" for
  non-financial tasks).
- **No focus timer.**
- **Not a general ADHD life-management app.** The scope is money, and
  specifically the Safe-to-Spend question.
- **Not a full accounting/double-entry bookkeeping system.**
- **Not a financial analytics dashboard.** No investment tracking, no net
  worth trends, no spending-category pie charts as a primary surface.
- **Not a social or multi-user product.** Single user, single device (with
  export/import as the portability mechanism).
- **Not a medical, diagnostic, or therapeutic product.**

All of the above were explicitly part of an earlier, broader product
direction ("ADHD Life Planner") and are now out of scope. See §8.

## 6. Safe-to-Spend concept

The product must clearly distinguish **Current Balance** (what's in the
account right now) from **Safe-to-Spend** (what's actually free to use
without jeopardizing upcoming commitments).

Illustrative shape (**not final** — see the note below):

```
Current balance:        $2,450
Upcoming bills:         -$1,200
Planned expenses:         -$300
Savings:                  -$200
─────────────────────────────────
Safe to spend:             $750
```

**This example is not the final formula.** Before any Safe-to-Spend code is
written, the exact calculation must be formally defined — what "upcoming"
means (a fixed window? everything due before the next payday? something
else), how multiple accounts combine, how a negative result is handled,
how recurring vs. one-off bills are treated — and covered by test fixtures
per `docs/TEST-PLAN.md` (at minimum: no obligations, one obligation before
payday, obligations that exceed balance, multiple accounts). This
definition work is the first substantive task of the next implementation
phase, not something to assume from the illustration above. See
`docs/ROADMAP.md`.

## 7. ADHD claims policy

Unchanged from the original product direction — this is a general
budgeting tool that happens to be designed with ADHD-related
executive-function challenges in mind. It must never:

- Claim to diagnose ADHD or any condition.
- Claim to treat, manage, or improve symptoms of ADHD or any condition.
- Use clinical/medical language (e.g. "symptom," "treatment," "therapy,"
  "clinically proven") anywhere in the UI, marketing copy, or docs.
- Imply the app is a substitute for medical or professional advice.

## 8. Market context

Existing ADHD-oriented budget planners (e.g. static spreadsheet templates
sold on marketplaces like Etsy) demonstrate real demand for this kind of
tool — they are market research, not a template to copy. This product's
differentiation is being an interactive, browser-based application rather
than a static spreadsheet: automatic calculation (no manual formulas to
maintain or break), a live Safe-to-Spend answer, payday-aware pacing, a
daily/weekly allowance, and fast expense entry — all without the user
maintaining the underlying math themselves.

## 9. What this means for existing code

Phase 0 (state store, event bus, storage adapter, schema/migrations, id/
date utilities) and Phase 1's application shell (navigation, design system,
responsive layout, error handling) were built as general-purpose
foundation and remain valid — see `docs/ARCHITECTURE.md`.

Phase 1's Tasks module, Next Action ("what should I do next?") engine, and
the Today screen's task integration were built under the retired product
direction and are now out of scope per §5. That code is **retained in the
repository for now, not deleted**, and must not be extended. Its removal
is a deliberate step planned for the next implementation phase (see
`docs/ROADMAP.md`), not an implicit side effect of this document update.
