# Data Model

This document defines the shape of application state, what gets persisted
to `localStorage`, and how it evolves over time. It is a living spec:
schema changes must update this file in the same change that makes them
(see `CLAUDE.md`).

This describes the shape actually implemented as of `schemaVersion: 5`
(Phase 6 — Budget Planning, `docs/ROADMAP.md`). Safe-to-Spend is
implemented — see `docs/SAFE-TO-SPEND.md` — as is the Current Balance
model (§3a) and Category Budgets (§3b), which are deliberately excluded
from the Safe-to-Spend arithmetic (`docs/SAFE-TO-SPEND.md` §3b).

## 1. Root state shape

Everything lives under a single `localStorage` key, e.g.
`adhd-planner:v1`, as one JSON object:

```jsonc
{
  "schemaVersion": 10,
  "meta": {
    "createdAt": "2026-08-19T00:00:00.000Z",
    "lastOpenedAt": "2026-08-19T00:00:00.000Z"
  },
  "settings": { /* see §3 Settings */ },
  "budget": { /* see §3 Budget — Current Balance, Savings */ },
  "incomes": [ /* Income[] */ ],
  "bills": [ /* Bill[] */ ],
  "plannedExpenses": [ /* PlannedExpense[] */ ],
  "expenses": [ /* Expense[] */ ],
  "categoryBudgets": [ /* CategoryBudget[] */ ],
  "incomeReceipts": [ /* IncomeReceipt[] */ ],
  "billPayments": [ /* BillPayment[] */ ],
  "expenseDrafts": [ /* ExpenseDraft[] */ ],
  "debts": [ /* Debt[] */ ],
  "debtPayments": [ /* DebtPayment[] */ ],
  "goals": [ /* Goal[] */ ]
}
```

Notes:

- `schemaVersion` is the single number the storage adapter checks to
  decide whether to run migrations (§7).
- Nothing computed (Safe-to-Spend, the daily/weekly allowance) is stored
  here — see §4.
- Flat top-level collections (arrays), not deeply nested trees, so
  individual entities are easy to find, update, and migrate independently.
- `budget` holds the two *single-value* figures (Current Balance, Savings
  allocation) — not lists, so they don't fit the array-of-entities shape
  the way Incomes/Bills/Planned Expenses do. A third figure, Safety
  Buffer, existed through Phase 9 and was removed at the user's explicit
  request — see `docs/SAFE-TO-SPEND.md` §9.

## 2. Conventions used across all entities

- **IDs:** every entity has an `id: string`, generated client-side via
  `/core/id.js` (timestamp + random component — no UUID dependency). IDs
  are never reused or recycled.
- **Timestamps:** stored as ISO 8601 UTC strings (`new
  Date().toISOString()`) for instants; plain `YYYY-MM-DD` for calendar
  dates (due dates, next-income dates) where time-of-day doesn't apply.
  Conversion to the user's local day happens only at render/derivation
  time, via `/core/date.js` — never scattered ad hoc across modules.
- **Money amounts are stored as integer cents**, never floats — see
  `/core/money.js`. This avoids floating-point precision problems (e.g.
  `0.1 + 0.2 !== 0.3` in IEEE 754) for values users need to trust exactly.
  `formatCents` renders cents back as `"$2,450.00"`. **Almost every**
  amount (bills, income, planned expenses, expenses, savings) is a
  non-negative *magnitude*, validated by
  `isValidAmountCents`/parsed by `parseAmountToCents` (rejects negative
  and malformed input). **`budget.currentBalanceCents` is the one
  exception** — it's a *balance*, which can legitimately go negative
  (see §3a), validated by `isValidBalanceCents`/parsed by
  `parseBalanceToCents` (any-sign integer).
- **Soft delete vs. hard delete:** user-facing deletes are hard deletes
  (removed from the array). No trash/undo layer in initial scope.
- **No cross-entity foreign-key enforcement layer.**

## 3. Entities

### Budget (single-value figures, not a list)

```jsonc
{
  "currentBalanceCents": "any-sign integer, defaults to 0 — see §3a Current Balance model",
  "savingsAllocationCents": "integer >= 0, defaults to 0 — a separate savings-account balance the user tracks for reference; NOT subtracted from Safe-to-Spend (docs/SAFE-TO-SPEND.md §9), feature #6"
}
```

Two actions change `savingsAllocationCents`, with different consequences:

- **`addToSavingsAction`** (`'budget/add-to-savings'`, the sidebar footer
  Savings row's "+" button) is a **real transfer**: it adds the amount to
  `savingsAllocationCents` **and** debits `budget.currentBalanceCents` by
  the same amount, atomically, via a cross-slice special case in
  `src/main.js`'s `rootReducer` (the fifth use of that pattern — see §3a).
  So moving money into savings lowers Safe-to-Spend, once, exactly like
  logging an Expense.
- **`setSavingsAllocationAction`** (`'budget/set'`, used by onboarding's
  savings step and the sidebar footer's pencil) is an **absolute
  replace** with **no balance effect** — a plain record edit for fixing a
  mistake or reconciling against a real account. Neither Current Balance
  nor Safe-to-Spend moves.

## 3a. Current Balance model

Phase 5 required picking exactly one model for what Current Balance means
and documenting it — this is that decision.

**Current Balance is a user-set checkpoint, automatically adjusted by
logged Expenses, by Income once confirmed received, by Bills once
confirmed paid, and by moving money into Savings.** Concretely:

- The user can set `currentBalanceCents` directly at any time (the
  existing editor from Phase 2) — this represents "as of right now, I
  have $X" (initial setup, or reconciling against a real bank balance).
- Every `Expense` created after that checkpoint **automatically
  decrements** the balance by its amount, in the same state transition as
  the expense being recorded — not a separate step the user has to
  remember. Editing an expense's amount adjusts the balance by the
  difference; deleting one refunds it. See "Why not the alternative"
  below for the reasoning.
- Confirming an `Income` as **received** (`markIncomeReceivedAction`, a
  "Mark received" action next to each entry in the "Upcoming income" card)
  **automatically credits** the balance by its amount, the same shape of
  effect as an Expense but in the other direction. This was added later
  than the rest of this section (see CLAUDE.md "Current status") and is
  **deliberately manual, never automatic-on-date**: an Income's `nextDate`
  passing doesn't mean the money actually landed (paydays shift, direct
  deposits get delayed) — only a user's explicit confirmation moves the
  balance, preserving the same "only confirmed real events touch this
  number" guarantee Expenses already had. Marking a **one-time** income
  received sets `received: true` permanently (there's no next
  occurrence); marking a **recurring** income received instead advances
  its `nextDate` to the next cycle, so it never gets permanently "stuck"
  — see `src/modules/incomes/reducer.js`.
- Marking a `Bill` **paid** (`toggleBillPaidAction`, the "Mark paid"
  button) **automatically debits** the balance by its amount; toggling it
  back to unpaid refunds it. An **unpaid** bill due on/before the payday
  horizon *is* subtracted from Safe-to-Spend as a committed term
  (`docs/SAFE-TO-SPEND.md` §2 — "Bills still to land"), so "Mark paid" is
  **net zero on Safe-to-Spend**: the bill's amount moves out of the
  committed subtraction and into this balance debit at the same time
  (§7). Marking paid also logs a `BillPayment` (see that entity below);
  un-marking removes that log entry again. (Whether unpaid bills are a
  committed term has flip-flopped five times — see
  `docs/SAFE-TO-SPEND.md` §2's history note; the current, user-requested
  state is "subtracted while unpaid".)
- **Both Income and Bills are scoped narrower than Expenses**: editing or
  deleting an income/bill that was already marked received/paid does
  **not** retroactively adjust the balance (a recurring income doesn't
  even keep a durable "received" marker to hang that adjustment on) — a
  deliberate simplification, not an oversight. Also worth knowing: if a
  real-world payment is *both* marked paid on its Bill *and* separately
  logged as an Expense, that's a double deduction — Bills and Expenses
  aren't linked. Use one or the other for a given payment, not both. If
  either limitation needs to change later, that's a product decision, not
  a bug fix.
- Moving money into **Savings** (`addToSavingsAction` /
  `'budget/add-to-savings'`, the sidebar footer's "+" button)
  **automatically debits** the balance by the transferred amount, in the
  same state transition that raises `savingsAllocationCents`. This is the
  one savings action with a balance effect — *correcting* the Savings
  figure (`setSavingsAllocationAction`) is a plain record edit and
  changes nothing else. Like Income/Bills, it's narrower than Expenses:
  there's no "undo transfer" that re-credits the balance, and editing the
  figure afterward doesn't retroactively adjust anything. See
  `docs/SAFE-TO-SPEND.md` §9.
- Planned Expenses still don't auto-deduct when due (they're *upcoming*,
  not yet spent — there's no "mark fulfilled" action for them). This keeps
  scope narrow, consistent with `docs/PRODUCT.md` §5's non-goal: "not a
  full accounting/double-entry bookkeeping system" — four specific,
  deliberate automatic effects above (Expense, Income received, Bill
  paid, Savings transfer), not universal auto-deduction for everything. `IncomeReceipt`/`BillPayment` (below) *are* now a real
  received/paid transaction history in one narrow sense — they exist
  purely to make the "This Period" card's "Money in"/"Money out" honest
  (only counting what's actually happened, not what's merely scheduled or
  due) — but they're read-only reporting logs, not part of the
  Safe-to-Spend formula (which still only ever reads
  `currentBalanceCents` directly) and not retroactively adjusted by a
  later edit/delete, per the point above. Still not a full ledger in the
  accounting sense.
- **Current Balance and Savings are always independent inputs**, in
  onboarding included. What the user types as their balance is stored as
  their balance; the Savings figure is a separate savings-account balance
  tracked for reference and is **not** subtracted from Safe-to-Spend
  (`docs/SAFE-TO-SPEND.md` §9) — only an explicit "Add to savings"
  transfer (which debits Current Balance) moves the number. So entering
  $1,000 balance and $12,000 savings in onboarding leaves Safe-to-Spend
  at $1,000. (Two earlier builds behaved differently: one folded
  `enteredBalance + enteredSavings` into the stored balance; a later one
  stored them separately but still subtracted the Savings figure as a
  committed term. Both were changed at the user's request.)

**Why not the alternative ("purely manually maintained, expenses/income
are just a separate log"):** that model would require the user to log an
expense or confirm income *and* separately remember to update their
balance every time — exactly the double-maintenance burden
`docs/PRODUCT.md` §2 says this product exists to remove. The chosen model
makes logging an expense, or confirming income, a single action with both
effects.

**Current Balance can go negative**, and the app does not clamp it to
zero. If the balance were clamped when an expense exceeds it, the app
would be silently misrepresenting the user's real position — the same
"never lie about the number" principle `docs/SAFE-TO-SPEND.md` §10
already established for a negative Safe-to-Spend result. `getSafeToSpend`
reads a negative balance correctly (via `isValidBalanceCents`, not the
stricter non-negative `isValidAmountCents` other fields use).

Mechanically: every cross-slice effect (an `expenses/*` action touching
both the `expenses` slice and `budget.currentBalanceCents`; the single
`incomes/mark-received` action touching `incomes`,
`budget.currentBalanceCents`, **and** `incomeReceipts`; the single
`bills/toggle` action with `field: 'paid'` touching `bills`,
`budget.currentBalanceCents`, **and** `billPayments`; `debts/record-payment`
touching `debts`, `expenses`, `debtPayments`, **and**
`budget.currentBalanceCents`; and `budget/add-to-savings` touching
`budget.savingsAllocationCents` **and** `budget.currentBalanceCents`) is
computed by the module's own pure `*-effect.js` / `create-*.js` helper
(each only decides *what changed*) and applied atomically by
`src/main.js`'s `rootReducer` (the one place with visibility into every
slice a given action touches), so nothing ever drifts out of sync and the
store's subscribers see one consistent update, not several. The full list
is in `docs/ARCHITECTURE.md` §7.

### Income

Covers both "Income" and "Paydays" — the amount and the schedule of when
it arrives are the same underlying fact, not two things to maintain
separately (product features #2, #8).

```jsonc
{
  "id": "inc_...",
  "name": "string, required — e.g. 'Paycheck'",
  "amountCents": "integer >= 0, required",
  "frequency": "'one-time' | 'weekly' | 'biweekly' | 'monthly', defaults to 'one-time'",
  "nextDate": "YYYY-MM-DD, defaults to today at capture",
  "active": "boolean, defaults true — deactivate without deleting",
  "received": "boolean, defaults false — see §3a; only meaningful for 'one-time' (a recurring income's nextDate advancing is what makes it 'receivable again' instead)",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

`received` is additive and needed no schema version bump/migration — a
stored Income from before this field existed simply has `received ===
undefined`, which every read site treats identically to `false` (same
"leave existing data inert" reasoning as `settings.onboardingCompletedAt`
before it: `undefined` already behaves correctly as the default).

### Bill

Known recurring/committed obligations (product feature #3).

```jsonc
{
  "id": "b_...",
  "name": "string, required — e.g. 'Rent'",
  "amountCents": "integer >= 0, required",
  "dueDate": "YYYY-MM-DD, defaults to today at capture",
  "recurrence": "'one-time' | 'weekly' | 'monthly', defaults to 'one-time'",
  "active": "boolean, defaults true — deactivate without deleting",
  "paid": "boolean, defaults false",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

### PlannedExpense

Known one-off future spends the user wants accounted for before they
happen (product feature #4) — distinct from a Bill (not recurring) and
distinct from logged spending (hasn't happened yet; expense *tracking* is
not built this phase — see `docs/ROADMAP.md`).

```jsonc
{
  "id": "pe_...",
  "name": "string, required",
  "amountCents": "integer >= 0, required",
  "plannedDate": "YYYY-MM-DD | null, optional",
  "category": "string | null, optional",
  "notes": "string | null, optional",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

### Expense

Money actually spent, logged as it happens (product feature #5,
`docs/ROADMAP.md` Phase 5). Distinct from a Bill (not recurring, not a
future obligation) and a PlannedExpense (this already happened). Creating
one automatically adjusts `budget.currentBalanceCents` — see §3a.

```jsonc
{
  "id": "e_...",
  "amountCents": "integer >= 0, required — the only required field at capture",
  "description": "string | null, optional",
  "date": "YYYY-MM-DD, defaults to today at capture",
  "category": "string | null, optional — one of the default categories or freely customized",
  "notes": "string | null, optional",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

Default category suggestions (`DEFAULT_EXPENSE_CATEGORIES`,
`src/modules/expenses/selectors.js`): Groceries, Eating Out, Transport,
Shopping, Entertainment, Health, Subscriptions, Other. These are
suggestions offered via a `<datalist>`, not a locked enum — `category` is
a free-text field, so the user can type anything.

The actual suggestion list shown to the user is wider than just the
defaults: `getKnownCategories(state)` (same file) unions the defaults with
every distinct category already used by a logged Expense *or* an existing
CategoryBudget, alphabetized. It's the shared `<datalist>` source for both
the Expense form's category field and the CategoryBudget form's category
field (`src/ui/components/category-budgets-section.js`) — there's no
separate "list of custom categories" to maintain; typing a brand-new name
into *either* form makes it a known suggestion in *both*, immediately,
since it's derived fresh from `state` on every render rather than stored
anywhere as its own list.

### CategoryBudget

An optional monthly spending limit for a category (product feature #6,
`docs/ROADMAP.md` Phase 6) — a self-monitoring guideline, not a financial
commitment. **Deliberately excluded from the Safe-to-Spend calculation**
— see `docs/SAFE-TO-SPEND.md` §3b for why, and how double-subtraction is
avoided by construction.

```jsonc
{
  "id": "cb_...",
  "category": "string, required — matches the free-text Expense.category value it tracks",
  "limitCents": "integer >= 0, required — the monthly spending limit",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

Design intent: this is a *standing* monthly limit, not a per-month
record — there's no `period`/`month` field, and no explicit "reset"
action. "Spent this month" (`getCategoryBudgetProgress`,
`src/modules/category-budgets/selectors.js`) is computed fresh, every
time, as the sum of `Expense` records matching `category` whose `date`
falls in the *current* calendar month (relative to `now`) — the month
simply changes which expenses count as soon as it rolls over, with
nothing to migrate or clean up. More than one `CategoryBudget` for the
same `category` is technically allowed (not enforced unique) and tracked
independently; the add-form steers users toward an unbudgeted category
without hard-blocking a duplicate.

### IncomeReceipt

An automatic historical record created every time an `Income` is
confirmed received (`markIncomeReceivedAction`, "Mark received" on the
"Upcoming income" card) — not a user-facing entity with its own create/
edit/delete UI, just a log. Exists to answer a question a schedule alone
can't: "how much income has actually arrived?" Before this, an
unbounded period ("All time") had nothing truthful to sum — Income
records are only ever a forward-looking `nextDate`/`frequency`, with
nothing left behind to mark that a given cycle actually happened.

```jsonc
{
  "id": "ir_...",
  "incomeId": "string — the Income this receipt came from",
  "name": "string — the income's name at the time, denormalized so it still displays correctly if that Income is later renamed or deleted",
  "amountCents": "integer >= 0",
  "date": "YYYY-MM-DD — the local day the receipt was confirmed (not the income's nextDate)",
  "createdAt": "ISO timestamp"
}
```

One receipt is appended per "Mark received" confirmation — a one-time
income and a recurring income are treated identically here (both log
exactly one receipt per confirmation); what differs between them is only
in the `Income` record itself (`received: true` vs. `nextDate` advancing
— see §3a). There's no `updatedAt` — receipts are immutable once created,
never edited. `getPeriodSummary` (`src/modules/dashboard/index.js`) sums
these for **every** period's "Money in," bounded or not — an Income
that's merely scheduled/upcoming, not yet confirmed received, never
counts here, only in "Upcoming income" (a deliberately separate,
non-period-scoped concept — see `getUpcomingIncome`, same file).

### BillPayment

The Bill-side counterpart to `IncomeReceipt`, same idea, same shape,
same reasoning: an automatic historical record created every time a
`Bill` is marked paid (`toggleBillPaidAction`, "Mark paid" on the "Bills
due soon" card) — not a user-facing entity, just a log, existing to
answer "how much has actually left the account?" (as opposed to "how
much is merely *due*").

```jsonc
{
  "id": "bp_...",
  "billId": "string — the Bill this payment came from",
  "name": "string — the bill's name at the time, denormalized so it still displays correctly if that Bill is later renamed or deleted",
  "amountCents": "integer >= 0",
  "date": "YYYY-MM-DD — the local day the payment was confirmed (not the bill's dueDate)",
  "createdAt": "ISO timestamp"
}
```

One difference from `IncomeReceipt`: **un-marking a bill (paid back to
unpaid) removes the most recent payment logged for it**, undoing the
specific log entry for the payment being reversed — Income has no
equivalent "un-confirm" action to mirror, but Bills do (`paid` is a
two-way toggle), so its log stays a true reflection of "what's currently
recorded as paid," not an ever-growing history that includes reversed
mistakes. A Bill cycling paid → unpaid → paid again produces two
payments, not one stale plus one current — only the single most recent
entry corresponds to the most recent toggle. `getPeriodSummary` sums
these (alongside `Expense`s) for **every** period's "Money out," bounded
or not — a Bill that's merely due, not yet paid, never counts here, only
in `billsDueCount` (same file, a deliberately separate concept: what's
coming up, not what's left the account).

### ExpenseDraft

The data behind "Brain dump" quick capture — a persistent header button
plus a global "N" keyboard shortcut open a single-field popup
(`src/ui/components/brain-dump.js`); pressing Enter or "Save" stores the
text instantly, with no required category or amount, and the popup
clears and stays open for the next thought. Each capture becomes one
`ExpenseDraft`, shown in the "Inbox" card (`src/ui/components/
inbox-section.js`) below the Expenses section, most recent first.

**Deliberately scoped to money, not a general notes/task list** — this
was a real conflict, flagged to and resolved by the user (see CLAUDE.md's
"Current status"): `docs/PRODUCT.md` §5 explicitly rules out "task
capture/completion as a standalone feature." An `ExpenseDraft` is framed
as an *unconfirmed expense stub*, not a note: it exists only to become a
real `Expense` ("Convert to expense," which pre-fills the existing Add
Expense form — `renderExpenseForm`'s `initialDescription` option — with
the draft's text as the description) or to be dismissed. It is never read
by Safe-to-Spend, the same "excluded by construction" treatment as
`CategoryBudget` (`docs/SAFE-TO-SPEND.md` §3b) — nothing about a draft's
mere existence is a financial commitment.

```jsonc
{
  "id": "ed_...",
  "text": "string, required — the raw captured note; becomes the new Expense's description if converted",
  "createdAt": "ISO timestamp"
}
```

Never auto-deleted or auto-expired — a draft persists until "Convert to
expense" (which only removes it once the resulting Expense is actually
saved, not the moment the button is clicked — closing that popup without
submitting leaves the draft untouched, so an abandoned conversion never
silently loses the note) or the dismiss action removes it. No `updatedAt`
— a draft is only ever created or deleted, never edited in place. Not a
cross-slice effect like Expense/Income/Bill above: creating or deleting a
draft never touches `budget.currentBalanceCents` on its own — only the
real `Expense` created by a successful conversion does, through the
existing Expense balance effect (§3a).

### Debt

A balance the user is paying down over time — a credit card, a loan, a
line of credit. Added ahead of `docs/ROADMAP.md`'s phase order at the
user's explicit request (same as "Brain dump" before it). **Deliberately
not a full debt-management tool** (no avalanche/snowball/refinance
calculators — `docs/PRODUCT.md` §4): it answers "how much do I owe,
what's due, am I making progress?" and stops there.

```jsonc
{
  "id": "d_...",
  "name": "string, required — e.g. 'Visa Card'",
  "originalBalanceCents": "integer >= 0, required — the starting balance, needed for the payoff-progress bar",
  "currentBalanceCents": "integer >= 0, required — still owed; decreased by a recorded payment, never allowed below 0",
  "minimumPaymentCents": "integer >= 0, required",
  "dueDate": "integer 1–31, required — the day of the month the payment is due (not a YYYY-MM-DD; debt payments are treated as monthly-recurring for scheduling — see below)",
  "interestRate": "number >= 0 | null, optional — APR as a percent, e.g. 19.99; null means 'not entered' (the user is never forced to supply one). 0 is a valid, distinct value.",
  "paymentFrequency": "'monthly' | 'biweekly' | 'weekly', defaults to 'monthly' — used only to normalize the minimum payment for the payoff estimate; scheduling always rolls monthly",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

- **`currentBalanceCents` can never go negative.** `recordDebtPaymentAction`
  clamps it at 0 — an over-payment (paying more than remains) zeroes the
  debt but still logs an `Expense` for the full amount that actually left
  the account (`docs/SAFE-TO-SPEND.md` §3c — "never lie about the
  number").
- **Excluded from the Safe-to-Spend calculation by construction** —
  `getSafeToSpend` never reads `state.debts`. See `docs/SAFE-TO-SPEND.md`
  §3c: only the `Expense` a payment logs moves the number, exactly once,
  never the debt balance itself. Same treatment as `CategoryBudget`.
- **Payoff progress** (`getDebtProgress`) is
  `(originalBalanceCents - currentBalanceCents) / originalBalanceCents`,
  clamped to 0–100%. **Payoff estimate** (`estimatePayoff`) is a rough
  amortization projection shown only when an APR is provided, always
  clearly labelled an estimate; if the payment doesn't cover one month's
  interest, no date is shown (a calm note instead), never an impossible
  one.
- **Scheduling / "Bills due soon":** a debt's minimum payment surfaces in
  the existing "Bills due soon" card (`docs/PRODUCT.md` §8) as an
  ordinary-looking row with a "Make payment" action. `dueDate` (a
  day-of-month) resolves to the next such day on/after today, clamped to
  a short month's last day. `paymentFrequency` of weekly/biweekly still
  shows one row per month here — a deliberate simplification, since this
  is a budget planner, not a debt-management app. A debt already paid for
  the current calendar month (a `DebtPayment` dated in it) drops off the
  card, mirroring how a paid Bill does.
- Editing or deleting a debt does **not** retroactively adjust Current
  Balance, and deleting a debt does **not** delete the `Expense` records
  its past payments created (`docs/PRODUCT.md` §6) — the same "confirm
  the event, don't keep a reconciling ledger" scoping already documented
  for Bills and Income in §3a.

### DebtPayment

An automatic log record appended every time `recordDebtPaymentAction`
runs — the Debt-side counterpart to `BillPayment`/`IncomeReceipt`, same
shape and reasoning (a read-only history, not a user-facing CRUD
entity).

```jsonc
{
  "id": "dp_...",
  "debtId": "string — the Debt this payment came from",
  "name": "string — the debt's name at the time, denormalized so it still displays if the Debt is later renamed or deleted",
  "amountCents": "integer >= 0",
  "date": "YYYY-MM-DD — the payment date (defaults to today, user-editable in the payment form)",
  "expenseId": "string | null — the Expense this payment created, for reconciliation",
  "createdAt": "ISO timestamp"
}
```

Used to answer "has this debt already been paid this month?" (so it drops
off "Bills due soon" — `hasDebtPaymentInMonth`). Not summed into the
"This Period" card's "Money out": the payment is already an `Expense`,
counted there through that — adding the `DebtPayment` too would
double-count. Not retroactively removed if the linked Expense is later
deleted (same narrow scoping as `BillPayment`).

### Goal

A savings goal — a named money target the user is putting money aside
for over time (an emergency fund, a new laptop). Added at the user's
explicit request, reworking the former Budget tab into a Goals tab;
ahead of `docs/ROADMAP.md`'s phase order, same footing as Debt Tracking
and Brain Dump. Distinct from the retired "ADHD Life Planner"
life-planning goals (`docs/PRODUCT.md` §5) — this is a budgeting
concept: money, not aspirations.

```jsonc
{
  "id": "g_...",
  "name": "string — what the goal is for, required, non-empty",
  "targetCents": "integer >= 0 — the total amount needed",
  "savedCents": "integer >= 0 — how much is put away toward it so far",
  "monthlyPaceCents": "integer >= 0 | null — roughly how much the user plans to add each month; optional",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

- **A goal's `savedCents` reduces Safe-to-Spend** — it's protected,
  committed money, subtracted in `totalCommittedCents` exactly like
  `budget.savingsAllocationCents` (`docs/SAFE-TO-SPEND.md` §3d). This is
  the one difference from Debts / Category Budgets, which are
  informational only. Savings and Goals are two *separate* buckets: a
  user should treat goal money as distinct from the general Savings
  figure, not enter the same dollars in both.
- **No cross-slice effect.** Creating / editing / deleting a goal never
  touches `budget.currentBalanceCents` (again, exactly like setting the
  Savings figure) — the money moves in Safe-to-Spend purely because the
  formula reads `state.goals` on every calculation. There is no "add to
  this goal from my balance" action; `savedCents` is a field the user
  sets directly.
- `monthlyPaceCents` feeds only the display ("~$200/month · about N
  months to go" — `getGoalProgress`'s `monthsToGo`, a simple
  `ceil(remaining / pace)`). It never affects Safe-to-Spend or any
  schedule.
- `getGoalProgress` derives `percentSaved` (clamped 0–100),
  `remainingCents`, `isReached`, and `monthsToGo` fresh — nothing about
  progress is stored.

### Settings

```jsonc
{
  "onboardingCompletedAt": "ISO timestamp | null",
  "displayName": "string | null, optional, used only for greeting copy",
  "theme": "'system' | 'light' | 'dark'",
  "reducedMotion": "boolean, mirrors/overrides prefers-reduced-motion if set explicitly",
  "currency": "an ISO 4217 code from src/core/money.js's SUPPORTED_CURRENCIES, defaults to 'USD'"
}
```

`theme` is now live — `'system'` (the default) follows the OS's own
`prefers-color-scheme`; an explicit `'light'`/`'dark'` overrides it via a
`.theme-light`/`.theme-dark` class the shell toggles on `<html>` on every
render (see `src/ui/components/theme-toggle.js`, `src/modules/settings/`,
`src/styles/base.css`'s color-token block for the actual palette). Before
this it existed in the schema but nothing read or wrote it. It's
persisted the same way everything else in this app is — through the
existing storage adapter (docs/ARCHITECTURE.md), the app's one and only
`localStorage` access path — not a separate, bespoke key.

`currency` is a **display preference only**, added via
`src/ui/components/currency-selector.js` — an icon button in the header
bar's right-side controls group, alongside the period selector and theme
toggle, showing the active currency's bare sign (e.g. "$", "€" —
`getCurrencySymbol`) rather than its 3-letter code. Picking a currency changes
what symbol/punctuation `formatCents` (`src/core/money.js`) renders every
stored amount with, everywhere in the app — it does **not** convert
anything: the underlying stored number (integer cents) is completely
unchanged, there is no per-Bill/per-Expense/per-Income currency, and no
exchange rates are involved anywhere in this app. `€2,450.00` and
`$2,450.00` represent the identical stored `245000`, deliberately. This
was an explicit, narrower scope decision — see CLAUDE.md "Current
status" for the fuller "true multi-currency tracking" alternative that
was considered and declined, partly because it would need exchange rates
from somewhere, and a live/automatic source would conflict with this
app's non-negotiable "no external API calls, fully offline" rule.

`displayName` is now also live, the same way — set by onboarding's "Your
name" step (`setDisplayNameAction`, `src/ui/screens/onboarding.js`), read
by the dashboard's greeting (`src/ui/screens/dashboard.js`
`greetingText`). It existed in the schema from the start but had nothing
that ever wrote it until this.

`payScheduleHint` (a free-text field from the pre-pivot shape) is retired
— `Income.frequency`/`nextDate` replaces it with a structured value.
Current Balance/Savings/Safety Buffer moved out of `settings` into their
own `budget` object (§1) — they're core financial data, not app
preferences.

## 4. Derived vs. stored data

- **Safe-to-Spend amount** — derived from `budget`, `bills`,
  `plannedExpenses`, `incomes`, and `goals` (each goal's `savedCents` is
  a committed term) — see `docs/SAFE-TO-SPEND.md` for the exact formula. Note that `budget.currentBalanceCents` is itself kept
  automatically current by logged Expenses (§3a), so Safe-to-Spend never
  needs to read `expenses` directly — its effect is already folded into
  the balance by the time it's read.
- **Daily/Weekly spending allowance** — derived from Safe-to-Spend and the
  nearest `Income.nextDate`.
- **Category budget progress** (spent/remaining/status per category, and
  the Monthly View totals) — derived from `categoryBudgets` and
  `expenses` together, recomputed for "the current month" on every read
  (`docs/SAFE-TO-SPEND.md` §3b, `docs/DATA-MODEL.md`'s CategoryBudget
  entity above). Not part of the Safe-to-Spend calculation.
- **Dashboard view** — light composition (e.g. "which bills/planned
  expenses to list") over the above; nothing dashboard-specific is
  stored.

Keeping these derived (never persisted) means they can never go stale
relative to their source data.

## 5. Export / Import format

Not implemented yet (`docs/ROADMAP.md` Phase 10). Mechanism already
specified: the entire root state object (§1) as pretty JSON, whole-state
export/import only, migrated through the same path as a normal load (§7)
with explicit confirmation before overwrite.

## 6. Id generation

Unchanged: a single helper in `/core/id.js`, used by every module — no
per-module reimplementation (already built, Phase 0).

## 7. Schema versioning & migrations

- `schemaVersion` is a plain incrementing integer, currently `10`.
- **v1 → v2:** pre-pivot Task shape evolution (see git history) — no
  longer relevant to the current product but preserved in the migration
  chain for correctness (a v1 install still migrates through v2 on its way
  to v3).
- **v2 → v3 (this phase):** the product pivot's schema change. Since the
  v2 shape (`tasks`, `routines`, `calendarEvents`, `money`, `goals`,
  `weeklyReviews`) has no budget equivalent, this migration **discards**
  those collections rather than transform them — a deliberate, documented
  exception to the usual "prefer additive, non-destructive migrations"
  guidance, because the product direction they served no longer exists.
  It's still an explicit migration function (`src/core/schema.js`), not a
  silent reshape, and is unit-tested (`tests/unit/schema.test.js`). What
  carries over: `meta` as-is; `settings.onboardingCompletedAt`/
  `displayName`/`theme`/`reducedMotion`. `settings.payScheduleHint` is
  dropped (see §3 Settings). New: `budget`, `incomes`, `bills`,
  `plannedExpenses`, all starting empty/zeroed.
- **v3 → v4 (Phase 5 — Expense Tracking):** purely additive — adds the
  empty `expenses` collection. Nothing else changes shape.
- **v4 → v5 (Phase 6 — Budget Planning):** purely additive — adds the
  empty `categoryBudgets` collection. Nothing else changes shape.
- **v5 → v6 (Income Receipts):** purely additive — adds the empty
  `incomeReceipts` collection, the real historical log an unbounded
  period ("All time") sums for "Money in" instead of either a
  non-answer or a schedule projection with no real "forever" total. See
  "IncomeReceipt" above.
- **v6 → v7 (Bill Payments):** purely additive — adds the empty
  `billPayments` collection, the Bill-side counterpart to
  `incomeReceipts`: a real historical log "Money out" sums from (alongside
  `Expense`s) for any period, instead of counting bills that are merely
  *due*. See "BillPayment" above.
- **v7 → v8 (Expense Drafts):** purely additive — adds the empty
  `expenseDrafts` collection, the data behind "Brain dump" quick capture.
  See "ExpenseDraft" above.
- **v8 → v9 (Debt Tracking):** purely additive — adds the empty `debts`
  and `debtPayments` collections. Existing users get `debts: []` /
  `debtPayments: []` and see no data loss (§11). See "Debt" /
  "DebtPayment" above.
- **v9 → v10 (Goals — the Budget tab reworked into a Goals tab):** purely
  additive — adds the empty `goals` collection. Existing users get
  `goals: []` and see no data loss. See "Goal" above. Note: the *name*
  `goals` also existed in the retired pre-pivot v2 shape (life-planning
  goals) — v2 → v3 discards that entirely; this re-introduces `goals` as
  an unrelated *savings* collection.
- On load, the storage adapter reads the stored `schemaVersion` and runs
  every migration function in sequence up to the current version before
  the state reaches the store — mechanism unchanged, already built and
  tested (Phase 0).
