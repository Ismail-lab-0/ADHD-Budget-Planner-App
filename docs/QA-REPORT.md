# QA Report — Full Testing and Validation Pass

Ran between the completion of `docs/ROADMAP.md` Phase 8 (Onboarding &
Product Polish) and the start of Phase 9 (Backup / Import / Export). No new
product functionality was added — this pass's only changes were tests and
defensive bug fixes surfaced by testing. See `docs/TEST-PLAN.md` §2 for
where this pass's coverage lives in the ongoing test-plan record; this
document is the narrative account of what was actually done.

## 1. Automated test suite

`npm test` (Node's built-in `node:test` runner, zero added dependencies):
**316/316 passing**, 0 failures, across 27 files in `tests/unit/`. (Baseline
at the start of this pass was 277/316 — the 39 added here are the three new
`qa-*.test.js` files plus regression tests folded into two existing files.)

`npm run build` succeeds (`dist/index.html`, single self-contained file);
the bundled script was additionally extracted and executed directly under
Node (`node -e "require(...)"`) to catch anything a syntax check alone
would miss — it ran cleanly with no errors.

## 2. Money calculation testing

Existing coverage (`tests/unit/money.test.js`, `safe-to-spend.test.js`,
`category-budgets.test.js`, `expenses-balance-effect.test.js`, and others)
already exercised most of what this phase asked for in detail — decimal
amounts (including the classic `0.1 + 0.2` float footgun, verified absent
at the cents-integer level), rounding, recurring items, duplicate
subtraction, edited/deleted items, and negative values. This pass's job was
to (a) consolidate the specific end-to-end flows and dates the spec named
into one traceable place, and (b) specifically stress the categories most
likely to hide a real bug: corrupted/invalid stored values. That second
half surfaced two real, now-fixed defects — see §4.

New: `tests/unit/qa-user-flows.test.js` (Flows A–F, see §3),
`tests/unit/qa-date-scenarios.test.js` (§3), `tests/unit/qa-data-safety.test.js`
(§5).

Numeric-input note (not a bug, documented for completeness): every real
call site in `src/ui/` passes `parseAmountToCents`/`parseBalanceToCents` a
*string* straight from a form input, which is parsed exactly via `BigInt`
arithmetic with no floating-point step. Those functions also accept a raw
JS `number` (`Math.round(input * 100)`), used internally/in tests for
convenience; a pathological number literal with more than 2 decimal digits
of precision (e.g. `19.995`) could theoretically round ambiguously through
native float multiplication. This path is unreachable from the UI today,
so it's noted as a known limitation rather than fixed.

## 3. User flow testing

All six flows named in the spec, run end-to-end through the real store +
storage adapter (the same pipeline `src/ui/shell.js` uses) —
`tests/unit/qa-user-flows.test.js`:

| Flow | Result |
|---|---|
| A. Open app → enter balance → add payday → add bills → view Safe-to-Spend | ✅ pass |
| B. Add expense → save → Safe-to-Spend updates | ✅ pass |
| C. Add bill → Safe-to-Spend updates | ✅ pass |
| D. Edit bill → Safe-to-Spend updates | ✅ pass (both an amount edit and a due-date edit that crosses the payday horizon) |
| E. Delete expense → Safe-to-Spend updates | ✅ pass |
| F. Refresh browser → all data remains | ✅ pass (every module together — balance, income, bills, expenses — in one session, with an identical Safe-to-Spend result before and after) |

Fixed-date scenarios (`tests/unit/qa-date-scenarios.test.js`), all against
a fixed `now` of Friday, August 21, 2026:

| Scenario | Result |
|---|---|
| Today | ✅ pass |
| Tomorrow | ✅ pass |
| Payday today | ✅ pass (daily allowance = full amount, no divide-by-zero) |
| Payday tomorrow | ✅ pass |
| Payday next month | ✅ pass (25-day count verified across the Aug→Sep boundary) |
| End of month (including *viewed from* the last day of the month) | ✅ pass |
| Beginning of month | ✅ pass |
| Recurring monthly bills (stale rollforward, 31st-anchored clamping through short months, excluded once past the payday horizon) | ✅ pass |
| Overdue bills (counts in full; excluded once marked paid) | ✅ pass |

## 4. Failures found and fixed

Two real defects were found — both by writing tests, not observed in the
running app. Both are narrow, defensive fixes; neither changes any
documented calculation, decision, or wording.

### 4a. Unvalidated `amountCents` sums could be NaN-poisoned by corrupted data

`src/modules/safe-to-spend/calculation.js` has always validated every
`amountCents` it sums with `isValidAmountCents` before adding it — this is
documented, deliberate defensive design. Two other places summed
`amountCents` **without** that guard:

- `src/modules/category-budgets/selectors.js` (`sumSpentForCategory`) — a
  category budget's "spent this month" figure.
- `src/modules/expenses/balance-effect.js` (`computeBalanceDelta`) — the
  amount added to/refunded from Current Balance when an expense is
  created, edited, or deleted.

A corrupted `amountCents` (e.g. hand-edited localStorage, or a record from
a not-yet-anticipated future bug) reaching either of these would silently
turn the whole month's "spent" figure — or a balance adjustment — into
`NaN`, which then can't be formatted or compared sensibly (`formatCents`
falls back to `$0.00` for it, and `NaN` comparisons in the "exceeded /
approaching / on-track" status logic all evaluate `false`, so a genuinely
broken figure would misleadingly render as "on-track"). The reducer path
that runs when a user actually creates/edits an expense through the app
already validates `amountCents` (`src/modules/expenses/reducer.js`), so
this could only be reached by data that bypassed that validation — i.e.
corrupted/hand-edited storage, exactly the case §5 tests for.

**Fix:** both now skip an expense with an invalid `amountCents` rather than
summing it, matching the existing `safe-to-spend/calculation.js` pattern.
Regression tests: `tests/unit/category-budgets.test.js` ("a corrupted
amountCents on a matching expense is skipped, not NaN-summed into
spentCents") and `tests/unit/expenses-balance-effect.test.js` ("corrupted
amountCents" describe block, 4 cases).

### 4b. `x ?? []` doesn't guard against a collection that's present but the wrong type

Every collection read in `safe-to-spend/calculation.js`,
`category-budgets/selectors.js`, and elsewhere used the pattern `bills ??
[]` to tolerate a missing collection. That only catches `null`/`undefined`
— if a stored collection had degraded into some *other* type (an object,
a string) through corruption, `x ?? []` leaves it as-is, and `for (const
item of thatValue)` throws `TypeError: … is not iterable`. Found by a data-
safety test that set `plannedExpenses: {}`:

```
TypeError: plannedExpenses is not iterable
  at sumCommittedPlannedExpenses (safe-to-spend/calculation.js:31)
```

**Fix, two layers:**

1. Every read site in `safe-to-spend/calculation.js` and
   `category-budgets/selectors.js` now uses `Array.isArray(x) ? x : []`
   instead of `x ?? []`.
2. `src/core/schema.js`'s `migrate()` — the one place *all* persisted state
   passes through before reaching the store — now normalizes the five
   list-shaped collections (`incomes`, `bills`, `plannedExpenses`,
   `expenses`, `categoryBudgets`) to real arrays as a final step. This
   protects a second, distinct failure mode this same class of bug would
   have caused: `createListReducer` (`src/core/list-entity.js`) does
   `[...items, entity]` / `items.findIndex(...)` on whatever's in that
   state slot, which would throw the moment a user tried to create, edit,
   or delete *anything* in a slice sitting on corrupted data — a crash
   triggered by an ordinary user action, not just a read.

Regression tests: `tests/unit/qa-data-safety.test.js` ("invalid values" /
"missing values" describe blocks) exercise both layers directly.

No other failures were found. Every other area this pass tested — decimal
precision, rounding, recurring-date resolution, month boundaries, the
category-budget double-subtraction rule, edit/delete correctness, and
negative-value handling — passed against its existing, already-thorough
coverage without needing a code change.

## 5. Data safety testing

`tests/unit/qa-data-safety.test.js`, run at the full
`initAppState`/`getSafeToSpend`/`getCategoryBudgetProgress` level:

- **Corrupted localStorage:** unparseable JSON, valid JSON of the wrong
  shape (an array instead of an object), and a `schemaVersion` newer than
  this build supports — all recover to a fresh, usable empty state without
  throwing; corrupted data is preserved under a `:recovery` key rather than
  discarded (pre-existing `storage.js` behavior, re-verified end-to-end
  here).
- **Missing values:** a state object missing entire top-level collections,
  a completely empty object, and a bill with no `amountCents` field at all
  — none throw; all resolve to sensible defaults.
- **Invalid values:** non-array collections, string/negative/`NaN`
  `amountCents`, and a non-integer `currentBalanceCents` — see §4 for the
  two defects this surfaced and fixed; everything else already degraded
  gracefully.
- **Empty data:** a genuinely fresh install produces a fully zeroed,
  throw-free dashboard end to end.
- **Unexpected old data format:** a real v1 (pre-Phase-2, task-oriented)
  blob and a totally unrecognized garbage object both migrate all the way
  to the current schema shape without throwing, through `migrate()`
  directly and through the full storage-adapter/`initAppState` pipeline.

## 6. Manual UX test

No browser tool is available in this environment (confirmed: the Claude in
Chrome extension is not connected). A live-browser desktop/mobile pass —
the tool this checklist is designed for — is called out as a remaining
limitation in §7 rather than faked. In its place, this pass did:

- **Wording/tone audit:** grepped all UI and module source for
  medical/diagnostic/clinical language and shame/guilt-framed phrasing
  (`docs/PRODUCT.md` §7/§3's prohibited-language lists). None found outside
  the docs that explicitly prohibit it.
- **CSS/layout code review** against the mobile requirements in
  `CLAUDE.md`/`docs/TEST-PLAN.md`: every interactive element resolves to
  `--tap-target-min: 44px` (`src/styles/base.css`, applied consistently in
  `components.css`); `src/styles/responsive.css` implements a genuine
  mobile-first layout (bottom tab nav below 640px, becoming a top bar at
  tablet width; a dedicated `max-width: 420px` rule keeps quick-action
  buttons and money-item actions from cramming together on narrow phones);
  `prefers-reduced-motion` and `prefers-color-scheme` are both respected in
  `base.css`.
- **Throwaway DOM-shim render smoke test** (a minimal in-memory stand-in
  for `document`, not part of the repo, cleaned up after use — the same
  technique used in Phase 7): rendered the Dashboard, Money, and Onboarding
  screens with deliberately awkward data — a negative Current Balance, a
  six-figure expense, deliberately long bill/income names chosen to test
  wrapping — and confirmed every screen renders without throwing. Dumped
  the Dashboard's full rendered text for a negative-balance scenario and
  hand-checked it:
  ```
  Estimated safe to spend
  -$2,273.45
  Your bills, planned expenses, savings, and safety buffer currently
  add up to $2,273.45 more than what's available. This isn't a spending
  amount — it's a sign to review what's committed.
  ```
  Calm, non-judgmental, and unambiguous about what the negative number
  means — matching the wording principles in `docs/PRODUCT.md`/
  `docs/SAFE-TO-SPEND.md`. Also confirmed the Breakdown card's per-line
  minus sign (`−`, used only on lines that *subtract* from the total) is
  visually indistinguishable from the ordinary hyphen-minus `formatCents`
  uses for a genuinely negative figure — both read as "this reduces the
  total," which is the correct signal in both cases, so no change was
  needed there.
- **No confusing wording, difficult forms, or visual clutter** was
  identified beyond what Phase 7 already addressed (progressive disclosure
  on the three capture forms, plain-language empty states). This pass
  found nothing new to fix in that category.

## 7. Remaining limitations

- **No real-browser pass was performed.** Every item in
  `docs/TEST-PLAN.md` §3's manual checklists — including the accessibility
  checklist (keyboard-only operation, screen-reader pass, visible focus
  indicators) and true mobile-device testing (a numeric keypad actually
  appearing for `inputmode="decimal"` fields, real touch behavior) —
  remains to be run in an actual browser before a release. This report's
  §6 is the best substitute achievable without one, not a replacement for
  it.
- **No cross-browser testing.** Unchanged from `docs/TEST-PLAN.md` §5's
  existing non-goal — a spot check in at least one Chromium-based and one
  non-Chromium browser is still recommended before any release.
- **The numeric-input floating-point edge case** in `parseAmountToCents`/
  `parseBalanceToCents` (§2) is unreachable from the UI today but would
  become relevant if a future feature ever fed these functions a raw
  number instead of form-input text.
- **Backup/Import/Export (Phase 9) is untested** because it doesn't exist
  yet — out of scope for this pass by design.
