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

Safe-to-Spend subtracts, from Current Balance, only what the user has
already committed with a real, dated action or a deliberate set-aside:

1. **Upcoming bills** — active, unpaid bills due on or before the payday
   horizon (or undated — see §6). "Bills still to land" in the hero
   breakdown. See §7 for how "Mark paid" interacts with this (net zero).
2. **Planned expenses** — known one-off future spends due on or before
   the horizon (or undated — see §6).
3. **Savings goals** — the sum of every `Goal.savedCents`, protected
   money, always subtracted in full (see §3d — added with the Goals tab).

```
netAfterCommitted = Current Balance
                  − Upcoming Bills (unpaid, within horizon)
                  − Planned Expenses (within horizon)
                  − Savings Goals (Σ savedCents)

Safe-to-Spend     = max(0, netAfterCommitted)   ← floored at 0, see §10
```

**The flat Savings figure (`budget.savingsAllocationCents`) is NOT a
term.** It is a *separate account balance* the user records for
reference — money that was never inside Current Balance to begin with —
so subtracting it would misrepresent a real checking balance (a $1,000
balance shouldn't read as −$11,000 just because $12,000 sits in a
savings account). `getSafeToSpend` still returns `savingsAllocationCents`
for display, but it never enters the arithmetic. Moving money *into*
savings is a real transfer (`budget/add-to-savings`, `src/main.js`) that
debits `currentBalanceCents` directly — so it reaches Safe-to-Spend that
way, once, exactly like an Expense or a paid Bill. See §9. **History:**
through the Goals-tab work and earlier, the Savings figure *was* a flat
always-on subtraction (paired with `goalsSavedCents` in §3d); it was
removed as a term at the user's explicit request ("don't reduce the
saving from the current balance… it's a separate account… when using the
button to log, you can subtract"). Goals were kept as a subtraction (§3d)
— the user chose to leave those protected.

**Unpaid bills ARE a term** ("Bills still to land"). `getSafeToSpend`
computes `upcomingBillsCents` (active, unpaid bills due on/before the
next payday, undated ones always) and folds it into `totalCommittedCents`.
Marking a bill paid removes it from that sum *and* debits
`budget.currentBalanceCents` by its amount
(`src/modules/bills/balance-effect.js`, `docs/DATA-MODEL.md` §3a) — the
amount just moves from "committed" to "already gone from the balance",
**net zero on Safe-to-Spend** (§7). Un-marking reverses both. Unlike
Income (§3), which is only ever informational, a scheduled unpaid bill
*does* reduce the number.

`docs/PRODUCT.md` §6's illustrative breakdown shows the "Upcoming bills"
line subtracted. A separate term, **Safety Buffer**, was part of this
formula through Phase 9 and was removed at the user's explicit request —
see §9.

**History (flip-flop, for the record).** Bills were originally a
committed, date-bound subtraction. Then made display-only at the user's
explicit request (`AskUserQuestion`). Then re-added as committed when the
hero adopted the payday-based framing. Then removed again ("don't
subtract bills till it's marked paid"). Then **re-added — the current
state — at the user's request** when the breakdown was reworked to the
"In checking / Bills still to land / Paid and spent / Already set aside /
Safe until payday" layout (`AskUserQuestion` confirmed the headline
should drop by the unpaid-bills amount). That's five flips; this note is
the running record.

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

## 3c. Debts never affect Safe-to-Spend directly

Debt Tracking (`docs/DATA-MODEL.md` "Debt", added ahead of
`docs/ROADMAP.md`'s phase order at the user's explicit request) follows
**exactly the same rule as Category Budgets (§3b), for the same
anti-double-count reason.** `getSafeToSpend` does not read `state.debts`
or `state.debtPayments`; `src/modules/debts/` has no import relationship
with `src/modules/safe-to-spend/` in either direction.

- A `Debt` record's `currentBalanceCents` is **informational only** — it
  tells the user how much they still owe and drives the per-debt progress
  bar and payoff estimate, nothing more. Merely owing a debt balance
  does not reduce Safe-to-Spend (unlike a scheduled unpaid *Bill*, §2,
  which does — a debt has no due-date schedule the calc could anchor to,
  and its payments already flow through the Expense path below).
- The **only** thing that moves Safe-to-Spend because of a debt is a
  **payment**. `recordDebtPaymentAction` logs a real `Expense`
  (`src/modules/debts/payment-effect.js`) — so the money is debited from
  `budget.currentBalanceCents` once, through the ordinary Expense pathway
  (`docs/DATA-MODEL.md` §3a), and flows into `safeToSpendCents` the same
  way any other logged spend does. The debt's own balance dropping is a
  *separate* bookkeeping fact the calculation never sees, so the same
  dollar is never subtracted twice.
- `tests/unit/debts-integration.test.js` proves a payment reduces
  Safe-to-Spend by exactly its own amount, not twice that.

## 3d. Savings goals DO affect Safe-to-Spend (protected)

Savings goals (`docs/DATA-MODEL.md` "Goal", added when the Budget tab was
reworked into a Goals tab, at the user's explicit request — and after
confirming with `AskUserQuestion` that this should change the core
number, not just a card) are the **one** set-aside tracker that reduces
Safe-to-Spend by simply *existing*. A goal is money the user has
deliberately earmarked, so it is subtracted from Safe-to-Spend as
committed money:

```
totalCommittedCents = plannedExpensesCents + goalsSavedCents
```

where `goalsSavedCents` is the sum of every `Goal.savedCents` (skipping a
corrupted value rather than NaN-poisoning the total — `sumGoalsSaved` in
`src/modules/safe-to-spend/calculation.js`, a raw `state.goals` read, no
import from `src/modules/goals/`).

- **Only `savedCents` counts** — `targetCents` (the amount still *needed*)
  and `monthlyPaceCents` never enter the arithmetic. Owing yourself a
  goal is not the same as having funded it.
- **No cross-slice effect, no balance debit.** Creating a goal does not
  touch `budget.currentBalanceCents`. The money moves in Safe-to-Spend
  purely because the formula re-reads `state.goals` every time.
- **Goals ≠ the flat Savings figure.** They used to get identical
  treatment (both flat subtractions). They diverged when the user asked
  for the Savings figure to become a separate-account reference (§9): a
  goal's `savedCents` is still subtracted here; `savingsAllocationCents`
  is not. If the user's goal money overlaps money they *also* recorded in
  "Savings", nothing double-counts anymore — only the goal side
  subtracts.
- `tests/unit/safe-to-spend.test.js` §4b proves each goal's `savedCents`
  is subtracted once, that the flat Savings figure alongside it does
  *not* subtract, and that a corrupted entry is skipped.

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

## 7. How a bill affects Safe-to-Spend

An unpaid bill due on/before the horizon is **subtracted** as
`upcomingBillsCents` (§2). Marking one paid (`toggleBillPaidAction`)
does two things in the same state transition
(`src/modules/bills/balance-effect.js`, `docs/DATA-MODEL.md` §3a): it
debits `budget.currentBalanceCents` by the bill's amount, and the
now-`paid` bill drops out of `upcomingBillsCents`. **These cancel:**
Safe-to-Spend loses the "committed" subtraction but the balance it's
computed from is lower by the same amount — **net zero**. Un-marking
reverses both, also net zero. So a bill reduces Safe-to-Spend once, when
it's created/becomes due (as an upcoming bill), and "Mark paid" is
purely a bookkeeping move of that same amount from "committed" to "spent
from the balance" — it never changes the headline.

This net-zero design is deliberate: without the balance debit, "Mark
paid" would remove the bill from the subtracted total and `safeToSpendCents`
would visibly *increase*, as if the money had "come back" (a real
reported bug from an earlier build). With it, paying a bill you've
already accounted for is a no-op on the number, which is what a user
expects.

**Scoping limitation:** editing or deleting an already-paid bill does not
retroactively re-sync the balance, and marking a bill paid *and*
separately logging a matching Expense both would double-deduct — Bills
and Expenses aren't linked. Use one or the other per real payment.

**Known limitation, unchanged by this history:** the data model tracks
`paid` as a single flat boolean, not per-cycle. For a recurring bill,
marking it paid doesn't reset for the next cycle on its own — the user
has to manually mark it unpaid again — there's no way for the app to know
"last month's rent was paid, but this month's isn't yet." This was a
deliberate simplification in `docs/ROADMAP.md` Phase 2 ("do not build
advanced forecasting yet") and is called out here rather than silently
worked around, per this document's "state every decision explicitly"
standard. A future phase could address this by tracking paid status per
occurrence rather than per record — a schema change, not a formula
change.

## 8. How planned expenses are handled

Planned expenses have no `active` flag (unlike Income/Bills — see
`docs/DATA-MODEL.md`) and no recurrence — they're inherently one-off. A
planned expense counts against Safe-to-Spend if:

- its `plannedDate` is on or before the horizon, **or**
- it has **no `plannedDate` at all** — treated the same as a dateless
  bill (§6): conservatively always included, since there's no date to
  exclude it by.

## 9. What the savings figure does (a separate-account balance, not a subtraction)

`savingsAllocationCents` (`docs/DATA-MODEL.md` "Budget") is a number the
user records for reference — how much is sitting in a *separate savings
account*. It is **not** subtracted from Safe-to-Spend, and it is not
folded into Current Balance either: the two are independent inputs, in
onboarding included. `getSafeToSpend` returns it on the result so a UI
can display it, but nothing in the formula reads it.

**Two ways it changes, with different consequences:**

- **Correcting the figure** — `setSavingsAllocationAction`
  (`'budget/set'`), used by onboarding's savings step and the sidebar
  footer's pencil. A plain record edit: it sets `savingsAllocationCents`
  and touches nothing else. Safe-to-Spend and Current Balance are
  unaffected — you're just fixing the recorded number to match reality.
- **Moving money into savings** — `addToSavingsAction`
  (`'budget/add-to-savings'`), the sidebar footer's "+" button. A real
  transfer: `src/main.js`'s `rootReducer` special-cases it to raise
  `savingsAllocationCents` **and** debit `currentBalanceCents` by the
  same amount, atomically — the fifth use of the documented cross-slice
  balance exception (`docs/ARCHITECTURE.md` §7), alongside Expenses,
  Income "mark received", Bills "mark paid", and Debt payments. So the
  money leaves "safe to spend" exactly once, via the reduced balance.

**History:** through the Goals-tab work and earlier, `savingsAllocationCents`
*was* a flat, always-on subtraction (§2/§3d) — money the user had decided
was never part of "safe to spend." The user changed this deliberately:
the mental model is a separate savings account, not an earmarked slice of
checking, so a $12,000 savings balance shouldn't drag a $1,000 checking
balance to −$11,000. Savings goals (§3d) kept the old subtraction
behaviour — the user chose to leave those protected.

**Safety Buffer removed (user request, after Phase 9):** through Phase 9,
`budget.safetyBufferCents` was a second flat, always-on subtraction of
exactly this kind — a cushion the user never wanted counted as spendable,
on top of Savings. It was removed at the user's explicit request:
`setSafetyBufferAction`/`getSafetyBufferCents` and the `safetyBufferCents`
term in this formula are gone (`src/modules/budget/`,
`src/modules/safe-to-spend/calculation.js`), and `createEmptyState()`
(`src/core/schema.js`) no longer includes the field for new installs.

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

## 10. What happens when commitments exceed the balance

`safeToSpendCents` is **floored at 0** — `Math.max(0, netAfterCommittedCents)`.
A negative "safe to spend" isn't a spendable amount, and showing one (e.g.
`-$10,000.00` as the dashboard headline) read as broken rather than
informative. This was changed at the user's explicit request ("set the
floor to 0"); through the Goals-tab work and earlier it was *not* floored
— the engine reported the true negative and `isNegative` meant
`safeToSpendCents < 0`.

Over-commitment is still fully surfaced, just not via a negative headline:

- **`netAfterCommittedCents`** — the raw `currentBalance − totalCommitted`,
  returned on the result *un*-floored (can be negative). This is where the
  true position lives now.
- **`isNegative`** — now means `netAfterCommittedCents < 0`, i.e. "the
  result was floored / the user is over-committed." The UI keys its
  attention styling (the `$0.00` shown in the warning colour, the
  `--negative` progress track) off this, so no UI change was needed.
- **`getSafeToSpendMessage(result)`** (`src/modules/safe-to-spend/wording.js`)
  reads `netAfterCommittedCents` for the over-committed branch — neutral
  copy stating the overage amount ("…add up to $X more than your current
  balance… a sign to review what's committed," never a judgment). The
  exact-zero branch (`safeToSpendCents === 0` with `netAfterCommittedCents
  === 0`) states plainly that nothing is available. An ordinary positive
  result returns `null` — the number speaks for itself.

Per this phase's standing requirement: the UI must never present the
result as spendable money when it isn't, and must never phrase it as a
personal failing.

## 11. Payday awareness — days until payday and daily allowance

- **`daysUntilPayday`** = whole local days from today to the horizon date
  (`core/date.js`'s `daysBetween`), or `null` if there's no determinable
  payday. `0` means payday is today (see below).
- **`dailyAllowanceCents`** = `safeToSpendCents` divided by
  `max(daysUntilPayday, 1)`, rounded to the nearest cent, or `null` if
  `daysUntilPayday` is `null`. The `max(..., 1)` guards against dividing
  by zero on a same-day payday — that case is treated as "this amount
  needs to last through today," a one-day window, rather than being
  undefined. Since `safeToSpendCents` is floored at 0 (§10), this is
  always `>= 0`.

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

## 11b. Total committed (added for a "committed vs. available"
progress visual)

`totalCommittedCents` — the exact sum computed in §2's formula
(`upcomingBillsCents + plannedExpensesCents + goalsSavedCents` — **the
flat Savings figure (§9) is the only money-ish term NOT in this**) —
also returned on the result object, alongside `goalsSavedCents` itself.
This is not a new calculation — it's the same intermediate value the
engine already produces on its way to `safeToSpendCents`, just no longer
kept private.
Added so a UI can show "$X committed of $Y available" (e.g. a progress
bar under the hero) without recomputing that sum itself in `src/ui/` —
see CLAUDE.md's rule that money arithmetic belongs in this module, never
the UI layer.

## 12. Language and framing

Per this phase's explicit requirement, product copy for this feature
(centralized in `src/modules/safe-to-spend/wording.js`, not scattered
across UI code) follows these rules:

- The headline label is **"Safe to spend today"** (`SAFE_TO_SPEND_LABEL`),
  reworded from the earlier **"Estimated safe to spend"** when the card
  moved to a payday-based framing at the user's request. The
  "planning estimate, not a verified bank figure" caveat did not go
  away — it moved from the label into the subtext
  (`getSafeToSpendSubtext` — "$X of your $Y balance has to last until
  Mon 31 Aug", where `$Y` is the raw current balance, not the
  savings/goals-reduced figure — the user asked specifically that the
  balance named here isn't itself netted down) and the standing
  disclaimer below. Never an unqualified "You can spend $X" / "You can
  afford this".
- A standing disclaimer (`PLANNING_DISCLAIMER`) states plainly that the
  app doesn't connect to or verify bank accounts — this is a planning
  tool over user-entered data, not a financial data aggregator.
- The framing is "you have this total cushion, make it last until the
  next paycheck" — **not** a per-day allowance. The number does not tick
  down through the day. (`daysUntilPayday` / `dailyAllowanceCents` are
  still computed and available for a future per-day view if ever wanted,
  but the hero shows the total.)
- The negative/zero-case message (§10) is neutral and non-judgmental —
  it describes the situation, never the user. An ordinary **positive**
  result gets **no explanatory paragraph at all** (`getSafeToSpendMessage`
  returns `null`) — the number, the subtext line, and the "How is this
  worked out?" breakdown carry the meaning. An earlier build had a
  standing positive-case sentence (`SAFE_TO_SPEND_POSITIVE_DESCRIPTION`);
  it was removed at the user's request.
- The hero's **"How is this worked out?"** disclosure
  (`src/ui/components/safe-to-spend-hero.js`, `renderBreakdown`) shows
  the **exact** figures behind the headline and nothing else — a
  plain-language intro sentence, then a fixed five-row flow to the total.
  There is no second calculation: every number comes from
  `getSafeToSpendBreakdown` (`src/modules/dashboard/index.js` —
  `getSafeToSpend`'s result plus a `period` block), and by construction
  the rows reconcile to `netAfterCommittedCents` (then floored →
  `safeToSpendCents`, §10):

  | row | value |
  |---|---|
  | **In checking** | `period.inCheckingCents` — `currentBalanceCents` with this month's logged movements added back (`+ spent + billsPaid − incomeReceived`), so the flow reconciles; anything with no dated log (a savings transfer, a manual balance edit) is absorbed here |
  | **+ Arrived after that balance** | `period.arrivedAfterBalanceCents` — this month's `IncomeReceipt`s |
  | **− Bills still to land** | `result.upcomingBillsCents` — active unpaid bills due before payday (§2/§7) |
  | **− Paid and spent after that balance** | `period.paidAndSpentAfterBalanceCents` — this month's `Expense`s (debt-payment expenses included, once) + `BillPayment`s |
  | **− Already set aside** | `period.setAsideCents` — `plannedExpensesCents + goalsSavedCents` (NOT bills — those are their own row) |
  | **= Safe until payday** | `result.safeToSpendCents` |

  Every row always renders, even at $0 (the mockup this matches shows
  "+ $0.00" etc. explicitly). Over-committed: an **After everything** row
  shows the true negative `netAfterCommittedCents`, then the total row
  reads "Safe until payday (never below $0) $0.00". There is **no**
  "shown for context" section (an earlier build had one; removed at the
  user's request).
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
  "upcomingBillsCents": "number — active unpaid bills due on/before the horizon; SUBTRACTED (see §2/§7)",
  "plannedExpensesCents": "number — sum of planned expenses counted, see §4/§8",
  "savingsAllocationCents": "number — echoes budget.savingsAllocationCents; display-only, a separate-account figure, NOT part of the arithmetic (see §9)",
  "goalsSavedCents": "number — sum of every Goal.savedCents, a committed term (see §3d)",
  "totalCommittedCents": "number — sum of the subtracted figures (upcoming bills + planned expenses + goals; NOT the Savings figure), see §11b",
  "netAfterCommittedCents": "number — currentBalance − totalCommitted, un-floored; can be negative, see §10",
  "safeToSpendCents": "number — max(0, netAfterCommittedCents); floored at 0, never negative, see §10",
  "nextPaydayDate": "YYYY-MM-DD | null — the horizon, see §4/§5",
  "daysUntilPayday": "number | null — see §11",
  "dailyAllowanceCents": "number | null — see §11, always >= 0",
  "isNegative": "boolean — netAfterCommittedCents < 0 (i.e. safeToSpendCents was floored)"
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
