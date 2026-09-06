// The Safe-to-Spend calculation. Pure function of (state, now) — no DOM,
// no side effects. See docs/SAFE-TO-SPEND.md for the full reasoning
// behind every decision here; this file implements that document, it
// doesn't redefine it. Money in, money out, all in integer cents (see
// src/core/money.js).

import { daysBetween, parseLocalDate } from '../../core/date.js';
import { isValidAmountCents, isValidBalanceCents } from '../../core/money.js';
import { getNextIncomeDate, getCurrentBillDueDate } from './recurrence.js';

// Every collection read below is guarded with `Array.isArray(x) ? x : []`
// rather than the narrower `x ?? []` — a corrupted/hand-edited localStorage
// value can be *present but the wrong type* (an object, a string), not just
// missing, and `for...of` on a non-iterable throws. See Phase 8 QA
// (docs/QA-REPORT.md) — this function must never throw regardless of what
// shape a stored collection has degraded into.

/**
 * Sum of active, unpaid bills due on/before `horizonKey` (the next
 * payday), or all of them if `horizonKey` is null. **This IS a
 * subtracted term** — `upcomingBillsCents` is part of
 * `totalCommittedCents` / `safeToSpendCents` ("Bills still to land" in
 * the breakdown). Marking a bill paid removes it from this sum *and*
 * debits Current Balance by its amount (`src/modules/bills/
 * balance-effect.js`) — the amount just moves from "committed" to
 * "already gone from the balance", net zero on Safe-to-Spend. See
 * docs/SAFE-TO-SPEND.md §2/§7. (Whether unpaid bills are a committed
 * term has flip-flopped several times at the user's request — §2's
 * history note; the current state is "subtracted".)
 */
/**
 * Sum of every savings goal's "already put away" amount — protected,
 * committed money, subtracted from Safe-to-Spend (docs/SAFE-TO-SPEND.md
 * §3d). Note this is *not* the same treatment as
 * `budget.savingsAllocationCents` anymore — the flat Savings figure
 * became a display-only separate-account balance (§9); a goal's
 * `savedCents` is still a subtraction. Read here as raw `state.goals`
 * (same convention as every other collection in this file) rather than
 * importing src/modules/goals/, and guarded per-item against a corrupted
 * `savedCents`.
 */
function sumGoalsSaved(goals) {
  let totalCents = 0;
  for (const goal of Array.isArray(goals) ? goals : []) {
    if (!goal || !isValidAmountCents(goal.savedCents)) continue;
    totalCents += goal.savedCents;
  }
  return totalCents;
}

function sumUpcomingBills(bills, today, horizonKey) {
  let totalCents = 0;
  for (const bill of Array.isArray(bills) ? bills : []) {
    if (!bill || !bill.active || bill.paid) continue;
    if (!isValidAmountCents(bill.amountCents)) continue;
    if (!bill.dueDate) {
      totalCents += bill.amountCents; // no date at all — conservatively always counts
      continue;
    }
    const dueKey = getCurrentBillDueDate(bill.dueDate, bill.recurrence, today);
    if (dueKey == null) continue;
    if (horizonKey == null || dueKey <= horizonKey) totalCents += bill.amountCents;
  }
  return totalCents;
}

/** Sum of planned expenses due on/before `horizonKey` (undated ones always count — see docs/SAFE-TO-SPEND.md). */
function sumCommittedPlannedExpenses(plannedExpenses, horizonKey) {
  let totalCents = 0;
  for (const expense of Array.isArray(plannedExpenses) ? plannedExpenses : []) {
    if (!expense || !isValidAmountCents(expense.amountCents)) continue;
    if (!expense.plannedDate || horizonKey == null || expense.plannedDate <= horizonKey) {
      totalCents += expense.amountCents;
    }
  }
  return totalCents;
}

/** The earliest upcoming occurrence across all active income sources, or null if none. */
function findNextPaydayDate(incomes, today) {
  let earliest = null;
  for (const income of Array.isArray(incomes) ? incomes : []) {
    if (!income || !income.active) continue;
    const occurrence = getNextIncomeDate(income.nextDate, income.frequency, today);
    if (occurrence != null && (earliest == null || occurrence < earliest)) {
      earliest = occurrence;
    }
  }
  return earliest;
}

/**
 * Sum of active income landing exactly on `horizonKey` (i.e. the income(s)
 * that *are* the next payday). Purely informational, for display — see
 * docs/SAFE-TO-SPEND.md §3: this is never added to `safeToSpendCents`.
 */
function sumIncomeAtHorizon(incomes, today, horizonKey) {
  if (horizonKey == null) return 0;
  let totalCents = 0;
  for (const income of Array.isArray(incomes) ? incomes : []) {
    if (!income || !income.active) continue;
    if (!isValidAmountCents(income.amountCents)) continue;
    const occurrence = getNextIncomeDate(income.nextDate, income.frequency, today);
    if (occurrence === horizonKey) totalCents += income.amountCents;
  }
  return totalCents;
}

/**
 * @param {object} state
 * @param {{now?: Date}} [options]
 * @returns {{
 *   currentBalanceCents: number,
 *   upcomingIncomeCents: number,
 *   upcomingBillsCents: number, // SUBTRACTED — active, unpaid bills due on/before the next payday (see §2/§7)
 *   plannedExpensesCents: number,
 *   savingsAllocationCents: number, // display-only — a separate account balance; NOT subtracted (see §9)
 *   goalsSavedCents: number,
 *   netAfterCommittedCents: number, // currentBalance − totalCommitted; can be negative (see §10)
 *   safeToSpendCents: number, // netAfterCommittedCents floored at 0 — never negative (see §10)
 *   nextPaydayDate: string|null,
 *   daysUntilPayday: number|null,
 *   dailyAllowanceCents: number|null,
 *   isNegative: boolean, // true when netAfterCommittedCents < 0 (i.e. safeToSpendCents was floored)
 * }}
 */
export function getSafeToSpend(state, { now = new Date() } = {}) {
  const budget = state?.budget ?? {};
  // A balance may legitimately be negative (docs/DATA-MODEL.md "Current
  // Balance model") — using the non-negative-only guard here would
  // silently zero out a real negative balance, corrupting the result.
  const currentBalanceCents = isValidBalanceCents(budget.currentBalanceCents) ? budget.currentBalanceCents : 0;
  const savingsAllocationCents = isValidAmountCents(budget.savingsAllocationCents) ? budget.savingsAllocationCents : 0;
  const goalsSavedCents = sumGoalsSaved(state?.goals);

  const nextPaydayDate = findNextPaydayDate(state?.incomes, now);
  const daysUntilPayday = nextPaydayDate != null ? daysBetween(now, parseLocalDate(nextPaydayDate)) : null;

  const upcomingBillsCents = sumUpcomingBills(state?.bills, now, nextPaydayDate);
  const plannedExpensesCents = sumCommittedPlannedExpenses(state?.plannedExpenses, nextPaydayDate);
  const upcomingIncomeCents = sumIncomeAtHorizon(state?.incomes, now, nextPaydayDate);

  // What's subtracted from Current Balance:
  //   - upcomingBillsCents: active, unpaid bills due on/before the next
  //     payday ("Bills still to land"). Marking one paid moves its amount
  //     out of here and into a Current Balance debit instead — net zero
  //     (§7).
  //   - plannedExpensesCents: known one-off future spends within the horizon.
  //   - goalsSavedCents: money earmarked to a savings goal — protected
  //     (docs/SAFE-TO-SPEND.md §3d).
  // NOT subtracted:
  //   - savingsAllocationCents: the Savings figure is a *separate account
  //     balance* the user tracks for reference, not money sitting inside
  //     Current Balance — subtracting it would misrepresent a $1,000
  //     checking balance as deeply negative just because $12,000 sits in a
  //     savings account. Moving money into savings is a real transfer
  //     (`budget/add-to-savings`, src/main.js) that debits Current Balance
  //     directly, the same as an Expense — so it reaches Safe-to-Spend
  //     that way, once. See §9.
  //   - upcoming income (§3): informational until it actually arrives.
  const totalCommittedCents = upcomingBillsCents + plannedExpensesCents + goalsSavedCents;
  // The raw position: what's left after everything committed. Can be
  // negative (commitments exceed the balance) — kept on the result so the
  // UI can say *by how much* the user is over-committed.
  const netAfterCommittedCents = currentBalanceCents - totalCommittedCents; // upcomingIncomeCents deliberately excluded (§3); upcomingBillsCents IS included (§2/§7)
  // Safe-to-Spend is floored at 0 — a negative "safe to spend" isn't a
  // spendable amount, and showing one read as broken. Over-commitment is
  // still surfaced, via `isNegative` + `netAfterCommittedCents` + the
  // wording.js message, not by a negative headline. See docs/SAFE-TO-SPEND.md §10.
  const safeToSpendCents = Math.max(0, netAfterCommittedCents);

  // Same-day payday (0 days) is treated as a 1-day window for the daily
  // rate rather than dividing by zero — see docs/SAFE-TO-SPEND.md.
  const dailyAllowanceCents =
    daysUntilPayday == null ? null : Math.round(safeToSpendCents / Math.max(daysUntilPayday, 1));

  return {
    currentBalanceCents,
    upcomingIncomeCents,
    upcomingBillsCents,
    plannedExpensesCents,
    savingsAllocationCents,
    goalsSavedCents,
    // The exact sum already used above to derive safeToSpendCents — the UI
    // needs this to show "how much is committed" (e.g. a progress bar), and
    // must never re-derive it itself (see docs/SAFE-TO-SPEND.md §11b and
    // CLAUDE.md — money arithmetic belongs in this module, not src/ui/).
    totalCommittedCents,
    netAfterCommittedCents,
    safeToSpendCents,
    nextPaydayDate,
    daysUntilPayday,
    dailyAllowanceCents,
    isNegative: netAfterCommittedCents < 0,
  };
}

/**
 * Convenience accessor matching docs/ARCHITECTURE.md's documented
 * `getSpendingAllowance(state)` interface — derived from the same
 * calculation, not recomputed separately.
 */
export function getSpendingAllowance(state, options) {
  return getSafeToSpend(state, options).dailyAllowanceCents;
}
