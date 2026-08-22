# Safe-to-Spend Calculation

This document defines the Safe-to-Spend formula precisely, before-the-fact
of any UI displaying it, per `docs/ROADMAP.md` Phase 3. It is binding: the
implementation (`src/modules/safe-to-spend/`) follows this document, and
any change to the formula updates this document in the same change (see
`CLAUDE.md`).

Safe-to-Spend is the product's primary feature (`docs/PRODUCT.md` §4).
Because a wrong or misleading number here directly risks a user's real
money decisions, every choice below is deliberate and stated explicitly —
nothing here is "the obvious default," everything is a decision.

## 1. The core distinction

- **Current Balance** — money currently held, as entered by the user
  (`budget.currentBalanceCents`). A plain fact, not a calculation. As of
  Phase 5 it's a checkpoint automatically adjusted by logged Expenses,
  and **can be negative** — see `docs/DATA-MODEL.md` §3a. `getSafeToSpend`
  reads it with `isValidBalanceCents` (any-sign integer), not the
  non-negative `isValidAmountCents` every other field here uses — using
  the wrong guard would silently zero out a real negative balance,
  exactly the "never lie about the number" failure §10 already warns
  against for the output side of this calculation.
- **Safe-to-Spend** — an *estimate* of what's left for discretionary
  spending after everything already committed or protected is set aside.
  A derived answer, never stored (`docs/DATA-MODEL.md` §4).

## 2. What is included

Safe-to-Spend subtracts two things from Current Balance:

1. **Planned expenses** — known future spends due on or before the
   horizon (or undated — see §6).
2. **Savings allocation** — the flat amount the user has set aside,
   always subtracted in full (not date-bound).

```
Safe-to-Spend = Current Balance
              − Planned Expenses (within horizon)
              − Savings Allocation
```

**Bills are deliberately not a term in this formula, at the user's
explicit request** (superseding an earlier version of this document — see
the note below). An unpaid bill has **zero** effect on Safe-to-Spend, no
matter how soon it's due or how overdue it is; the only thing that moves
the number is `toggleBillPaidAction` ("Mark paid"), which debits Current
Balance directly (`src/modules/bills/balance-effect.js`,
`docs/DATA-MODEL.md` §3a) — the same mechanism an Expense already uses.
Once that happens, the bill's amount is already gone from
`currentBalanceCents`, so it flows into `safeToSpendCents` the same way
any other dollar in the checkpoint does, with no separate "upcoming
bills" term needed. See §7 for the full account.

`getSafeToSpend` still computes `upcomingBillsCents` (the sum of active,
unpaid bills due on or before the horizon) exactly as before, and still
returns it — but purely as **display-only** information, the same
treatment `upcomingIncomeCents` already gets (§11a). It is never part of
`totalCommittedCents` or `safeToSpendCents`.

This differs from `docs/PRODUCT.md` §6's illustrative breakdown, which
still shows an "Upcoming bills" line subtracted — that illustration
predates this change and is explicitly marked non-final in that document;
it is not re-drawn here since `docs/PRODUCT.md` §6 already carries its own
caveat. The implementation is verified against a version of that example
with the bills line adjusted to reflect this section — see
`tests/unit/safe-to-spend.test.js`'s "cross-check against docs/PRODUCT.md
§6" test. A fourth term, **Safety Buffer**, was part of this formula
through Phase 9 and was removed at the user's explicit request — see §9
for what changed and why no migration was needed.

**Why the change:** bills used to be treated as a committed, date-bound
subtraction the moment they were created (mirroring Planned Expenses) —
see the version of this section that shipped through the "'Money out'
now means..." era of `CLAUDE.md`'s running log. The user asked, explicitly
and directly, for bills to never reduce Safe-to-Spend until "Mark paid" is
actually clicked — i.e. to be treated the same way Income already is
(§3): informational until confirmed, real only once confirmed. This is a
narrower, more conservative interpretation of "safe to spend right now"
in one specific sense (a bill sitting unpaid no longer protects money
against it in advance) and a stricter one in another (nothing is ever
subtracted on the strength of a schedule alone, only on a real, dated,
user-confirmed event) — consistent with §3's existing income-side
reasoning, now applied symmetrically to the other side of the ledger.

## 3. What is excluded — upcoming income is never added

**Upcoming income is not added to the Current Balance figure**, even
income arriving very soon. This is a deliberate, load-bearing decision:

- Safe-to-Spend answers "what can I spend *right now*," and money that
  hasn't arrived yet isn't available right now, regardless of how
  confident the schedule looks.
- Counting unlanded income would make the number's trustworthiness depend
  on a paycheck actually arriving on time and at the expected amount —
  a risk the product shouldn't ask the user to carry silently.
- `docs/PRODUCT.md` §6's own worked example has no income line item at
  all — only Current Balance minus commitments — which corroborates this
  reading of the intended model.

Income sources are used for exactly one purpose: **determining the next
payday date**, which in turn bounds the horizon (§4) and drives the daily
allowance (§7). Their dollar amounts never enter the arithmetic.

If a later phase wants an "income-inclusive" view, that's a distinct,
separately-named calculation (e.g. a projected/forward-looking figure) —
it should not silently change what "Safe-to-Spend" means, since the
current, conservative meaning is the one the product promises
("know what you can safely spend").

**This section's principle is what "Mark received" (docs/DATA-MODEL.md
§3a) actually implements, not an exception to it.** Confirming an income
received doesn't add a special income-shaped term to this formula —
it credits `budget.currentBalanceCents` directly, through the same
cross-slice effect Expenses already use, so it flows into
`safeToSpendCents` by already being part of `currentBalanceCents`, the
same as any other dollar in the checkpoint. Until that confirmation
happens, the income stays exactly what this section says: informational
only, via `upcomingIncomeCents`/the payday horizon, never added.

## 3b. Category budgets (Phase 6) never affect Safe-to-Spend

Per Phase 6's explicit requirement — "determine whether category budgets
should affect Safe-to-Spend, define exactly how if they do, do not
accidentally subtract the same money twice, this is critical" — the
decision here is: **Category Budgets do not enter the Safe-to-Spend
arithmetic at all, in either direction.** `getSafeToSpend` does not read
`state.categoryBudgets`.

**Why not treat unspent budget headroom like a Planned Expense (money
that's "earmarked" and should be protected)?** Because a category budget
is a self-imposed spending *ceiling*, not a known future expense the way
a Bill or PlannedExpense is. The user might not spend the remainder of a
Groceries budget at all, or might spend it on something else — it's a
guideline for the user to self-monitor against, not a commitment the app
has any basis to protect money for. Treating it as a commitment would
make Safe-to-Spend *less* accurate (artificially lower than what's really
available), which is the opposite of what a "trustworthy number" needs.

**Why this is the only choice that can't double-subtract, by
construction:** every dollar a Category Budget's "spent" figure counts is
a dollar from an `Expense` record (`docs/DATA-MODEL.md` §3a) that
**already** decremented `budget.currentBalanceCents` the moment it was
logged — Current Balance already reflects it once. If Safe-to-Spend also
subtracted a category budget's spent-or-remaining figure, that same
dollar would be removed from the available total *twice*: once via the
balance it's already missing from, and again via the budget figure. There
is no version of "category budgets partially affect Safe-to-Spend" that
avoids this without re-deriving Current Balance to exclude
budget-tracked spending first — a much more complex, error-prone design
for a feature whose own stated purpose is to stay simple
("not a complex accounting application," Phase 6).

**What Category Budgets are, instead:** a planning/visibility layer
*over* the same Expense data Safe-to-Spend already consumes indirectly
(via Current Balance) — answering "am I on track within this category
this month," a different question from "how much can I spend right now."
`src/modules/category-budgets/selectors.js` is read-only with respect to
`safe-to-spend/` — no import in either direction, verified by
`tests/unit/category-budgets-safe-to-spend.test.js`, which proves both
that creating/editing/deleting a category budget changes the
Safe-to-Spend result by exactly `$0`, and that logging an expense against
a budgeted category moves it by exactly its own amount — never twice.

## 4. Date boundaries — the horizon

The **horizon** is the next payday date: the earliest upcoming occurrence
across all *active* income sources (§5). Only bills and planned expenses
due on or before the horizon count against Safe-to-Spend — the
reasoning: once the next paycheck arrives, the user will cover
later-dated commitments with that fresh money, not today's balance.

**If there is no determinable next payday** (no active income sources, or
none with a resolvable upcoming date), **the horizon is unbounded**: every
currently-known active, unpaid bill and every planned expense counts,
regardless of date. This is a deliberate conservative default — without a
payday to anchor against, over-protecting money is safer than
under-protecting it.

An overdue bill (due date already in the past) always counts if unpaid —
overdue debt doesn't stop being debt. See §5 for why this differs from
how a past *income* date is treated.

## 5. How recurring income is handled

Each Income record (`docs/DATA-MODEL.md` §3) has a `frequency` and a
`nextDate`. To find the next payday:

- Only **active** incomes are considered (`active: false` is excluded
  entirely — same as if it didn't exist).
- **`'one-time'`**: if `nextDate` is on or after today, it's a candidate
  payday. If `nextDate` has already passed, it's excluded — a past
  one-time income is presumed already received (its money is presumed
  already reflected in Current Balance), so it can't be a *future*
  payday.
- **`'weekly'` / `'biweekly'` / `'monthly'`**: the date is rolled forward
  in whole periods until it lands on or after today. A stale recurring
  date isn't treated as gone — for a low-maintenance budgeting tool, the
  common case is the user simply hasn't touched the record since the
  last time it fired, not that the income stopped. (`monthly` rolling
  clamps to the last day of a shorter month, e.g. Jan 31 → Feb 28, not
  "March 3".)

The horizon is the **earliest** resolved date across all active income
sources. Every income source's dollar amount is irrelevant to the
arithmetic (§3) — only the earliest date matters.

## 6. How recurring bills are handled

Each Bill record has a `recurrence` and a `dueDate`.

- Only **active** bills are considered.
- **`'one-time'`**: the bill's own `dueDate` is used as-is — including if
  it's in the past (still owed if unpaid; see §4).
- **`'weekly'` / `'monthly'`**: rolled forward the same way as recurring
  income (§5), to find the bill's *current* cycle's due date.
- A bill with **no `dueDate` at all** is conservatively always included
  (counts regardless of horizon) — the user has flagged it as owed, and
  without a date there's no basis to exclude it.

## 7. How already-paid bills are handled

A bill with `paid: true` is **excluded entirely** from the calculation,
regardless of its due date. The presumption is that the money has already
left the account (and Current Balance has already been updated to
reflect that), so including it again would double-subtract it.

**That presumption is now actually enforced, not just assumed.** Marking
a bill paid (`toggleBillPaidAction`) automatically debits Current Balance
by its amount in the same state transition — see `docs/DATA-MODEL.md`
§3a and `src/modules/bills/balance-effect.js`. This closed a real
reported bug: before that effect existed, excluding a paid bill here
(reducing `upcomingBillsCents`) with nothing ever actually leaving
`currentBalanceCents` meant `safeToSpendCents` visibly *increased* the
moment a bill was marked paid — the amount appeared to "come back"
instead of having been spent. Now the two changes cancel out by
construction: `upcomingBillsCents` drops by the bill's amount at exactly
the moment `currentBalanceCents` drops by the same amount, so
`safeToSpendCents` itself doesn't move when a bill is marked paid — which
is the entire point of this section's "excluded entirely" rule.

**Known limitation:** the data model tracks `paid` as a single flat
boolean, not per-cycle. For a recurring bill, marking it paid excludes it
from *every* future calculation until the user manually marks it unpaid
again — there's no way for the app to know "last month's rent was paid,
but this month's isn't yet." This was a deliberate simplification in
`docs/ROADMAP.md` Phase 2 ("do not build advanced forecasting yet") and
is called out here rather than silently worked around, per this
document's "state every decision explicitly" standard. A future phase
could address this by tracking paid status per occurrence rather than per
record — a schema change, not a formula change.

## 8. How planned expenses are handled

Planned expenses have no `active` flag (unlike Income/Bills — see
`docs/DATA-MODEL.md`) and no recurrence — they're inherently one-off. A
planned expense counts against Safe-to-Spend if:

- its `plannedDate` is on or before the horizon, **or**
- it has **no `plannedDate` at all** — treated the same as a dateless
  bill (§6): conservatively always included, since there's no date to
  exclude it by.

## 9. What the savings allocation does (and what safety buffer used to do)

`savingsAllocationCents` (`docs/DATA-MODEL.md` "Budget") is a flat,
always-on subtraction — not tied to any date or horizon. It represents
money the user has decided is *never* part of "safe to spend," full stop,
regardless of how far away the next payday is. This is what makes it
different from bills/planned expenses: those are time-bound commitments
that stop counting once the next paycheck arrives; the savings allocation
is a standing floor that never lifts on its own (the user changes it
explicitly).

**Safety Buffer removed (user request, after Phase 9):** through Phase 9,
`budget.safetyBufferCents` was a second flat, always-on subtraction of
exactly this kind — a cushion the user never wanted counted as spendable,
on top of Savings. It was removed at the user's explicit request:
`setSafetyBufferAction`/`getSafetyBufferCents` and the `safetyBufferCents`
term in this formula are gone (`src/modules/budget/`,
`src/modules/safe-to-spend/calculation.js`), and `createEmptyState()`
(`src/core/schema.js`) no longer includes the field for new installs.

**No schema version bump or migration was needed** — a genuine exception
to `docs/DATA-MODEL.md` §6's usual rule, worth stating explicitly rather
than silently deviating from it: removing a *reader* of a field is not a
shape change existing stored data needs reconciling against, unlike
Phases 5/6's additive migrations (which had to backfill a *new* field
older data didn't have, or downstream code would crash reading
`undefined`). Here the reverse risk doesn't exist — no code path reads
`safetyBufferCents` anymore, so its presence or absence in a given user's
stored JSON is simply irrelevant. A returning user who already had a
non-zero `safetyBufferCents` keeps that value sitting inertly in their
`localStorage` indefinitely (the reducer's `budget/set` spreads existing
fields forward on every future save) — harmless, but worth knowing if
ever inspecting real stored data going forward.

## 10. What happens when the result is negative

A negative Safe-to-Spend is a **valid, meaningful result** — it means the
user's currently-known commitments exceed what they currently have. The
engine does not clamp it to zero; `safeToSpendCents` reports the true
(possibly negative) number, and `isNegative: true` flags the case
explicitly so the UI never has to re-derive it from a sign check.

Per this phase's explicit requirement: **the UI must never present a
negative result as spendable money, and must never phrase it as a
personal failing.** `getSafeToSpendMessage(result)`
(`src/modules/safe-to-spend/wording.js`) returns ready-made, neutral copy
for the negative case (stating the overage amount and framing it as "a
sign to review what's committed," not a judgment) and for the exact-zero
case (nothing is available, stated plainly). For an ordinary positive
result it returns `null` — the number speaks for itself.

## 11. Payday awareness — days until payday and daily allowance

- **`daysUntilPayday`** = whole local days from today to the horizon date
  (`core/date.js`'s `daysBetween`), or `null` if there's no determinable
  payday. `0` means payday is today (see below).
- **`dailyAllowanceCents`** = `safeToSpendCents` divided by
  `max(daysUntilPayday, 1)`, rounded to the nearest cent, or `null` if
  `daysUntilPayday` is `null`. The `max(..., 1)` guards against dividing
  by zero on a same-day payday — that case is treated as "this amount
  needs to last through today," a one-day window, rather than being
  undefined. The result can be negative (mirroring a negative
  Safe-to-Spend) — the raw number is still returned; the UI decides how
  to phrase a negative daily rate.

## 11a. Upcoming income (display-only, Phase 4 addition)

`upcomingIncomeCents` — the sum of active income landing exactly on the
horizon date (i.e. the income(s) that *are* the next payday). Added in
Phase 4 so a dashboard can show "upcoming income" as context, per
`docs/PRODUCT.md`'s "know what's coming in" framing.

**This value is never added to `safeToSpendCents`** — §3's reasoning
still holds. It's informational only: if a UI shows it in a breakdown
alongside the subtracted figures, it must not visually imply it's part of
the arithmetic (e.g. no `+` sign folded into a running total). It's `0`
whenever there's no determinable horizon.

## 11b. Total committed (display-only, added for a "committed vs. available"
progress visual)

`totalCommittedCents` — the exact sum already computed in §2's formula
(`upcomingBillsCents + plannedExpensesCents + savingsAllocationCents`),
also returned on the result object. This is not a new
calculation — it's the same intermediate value the engine already produces
on its way to `safeToSpendCents`, just no longer kept private. Added so a
UI can show "$X committed of $Y available" (e.g. a progress bar under the
hero) without recomputing that sum itself in `src/ui/` — see CLAUDE.md's
rule that money arithmetic belongs in this module, never the UI layer.

## 12. Language and framing

Per this phase's explicit requirement, product copy for this feature
(centralized in `src/modules/safe-to-spend/wording.js`, not scattered
across UI code) follows these rules:

- Always **"Estimated safe to spend"**, never an unqualified "You can
  spend $X" or "You can afford this" — it's a planning estimate derived
  from what the user entered, not a live, verified bank balance.
- A standing disclaimer (`PLANNING_DISCLAIMER`) states plainly that the
  app doesn't connect to or verify bank accounts — this is a planning
  tool over user-entered data, not a financial data aggregator.
- The negative/zero-case message (§10) is neutral and non-judgmental —
  it describes the situation, never the user.
- No medical/diagnostic language of any kind — unrelated to this feature,
  but restated here because it's a project-wide, non-negotiable rule
  (`docs/PRODUCT.md` §7, `CLAUDE.md`).

## 13. Result object

`getSafeToSpend(state, { now })` (`src/modules/safe-to-spend/calculation.js`)
returns:

```jsonc
{
  "currentBalanceCents": "number — echoes budget.currentBalanceCents",
  "upcomingIncomeCents": "number — display-only, see §11a; never part of the arithmetic",
  "upcomingBillsCents": "number — sum of bills counted, see §4/§6",
  "plannedExpensesCents": "number — sum of planned expenses counted, see §4/§8",
  "savingsAllocationCents": "number — echoes budget.savingsAllocationCents",
  "totalCommittedCents": "number — sum of the three subtracted figures above, see §11b",
  "safeToSpendCents": "number — can be negative, see §10",
  "nextPaydayDate": "YYYY-MM-DD | null — the horizon, see §4/§5",
  "daysUntilPayday": "number | null — see §11",
  "dailyAllowanceCents": "number | null — see §11, can be negative",
  "isNegative": "boolean — safeToSpendCents < 0"
}
```

Field names use the project-wide `XCents` integer-cents convention
(`docs/DATA-MODEL.md` §2) rather than the unsuffixed names sketched in
early planning notes — kept consistent with every other monetary field in
this codebase rather than introducing a one-off naming style.

`getSpendingAllowance(state, options)` is a thin convenience wrapper
returning just `dailyAllowanceCents`, matching the interface name already
documented in `docs/ARCHITECTURE.md` §7 — it calls `getSafeToSpend`
internally rather than recomputing anything.

## 14. Non-goals for this phase

Per `docs/ROADMAP.md` Phase 3's scope: this is the calculation engine
only. Not included here: any UI displaying these numbers (Phase 4), actual
expense tracking reducing the balance in real time (Phase 5), or the
daily/weekly allowance appearing anywhere in the interface (Phase 6).
`getSafeToSpend`/`getSpendingAllowance` are pure functions, fully
unit-tested, with no caller anywhere in `src/ui/` yet.
