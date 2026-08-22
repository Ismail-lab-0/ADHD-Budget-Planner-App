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
 * Sum of active, unpaid bills due on/before `horizonKey` (or all of them if
 * `horizonKey` is null). **Display-only as of the "bills only reduce
 * Safe-to-Spend once marked paid" change (see docs/SAFE-TO-SPEND.md §2/§6)
 * — this total is no longer part of `totalCommittedCents`/`safeToSpendCents`.**
 * An unpaid bill has zero effect on Safe-to-Spend; only the Current Balance
 * debit that happens when a bill is actually marked paid
 * (`src/modules/bills/balance-effect.js`) moves the number, the same way
 * an Expense does. Kept (and still returned as `upcomingBillsCents`) so a
 * future UI can show "$X in upcoming bills" the same way `upcomingIncomeCents`
 * already does.
 */
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
 *   upcomingBillsCents: number, // display-only — see sumUpcomingBills; not part of safeToSpendCents
 *   plannedExpensesCents: number,
 *   savingsAllocationCents: number,
 *   safeToSpendCents: number,
 *   nextPaydayDate: string|null,
 *   daysUntilPayday: number|null,
 *   dailyAllowanceCents: number|null,
 *   isNegative: boolean,
 * }}
 */
export function getSafeToSpend(state, { now = new Date() } = {}) {
  const budget = state?.budget ?? {};
  // A balance may legitimately be negative (docs/DATA-MODEL.md "Current
  // Balance model") — using the non-negative-only guard here would
  // silently zero out a real negative balance, corrupting the result.
  const currentBalanceCents = isValidBalanceCents(budget.currentBalanceCents) ? budget.currentBalanceCents : 0;
  const savingsAllocationCents = isValidAmountCents(budget.savingsAllocationCents) ? budget.savingsAllocationCents : 0;

  const nextPaydayDate = findNextPaydayDate(state?.incomes, now);
  const daysUntilPayday = nextPaydayDate != null ? daysBetween(now, parseLocalDate(nextPaydayDate)) : null;

  const upcomingBillsCents = sumUpcomingBills(state?.bills, now, nextPaydayDate);
  const plannedExpensesCents = sumCommittedPlannedExpenses(state?.plannedExpenses, nextPaydayDate);
  const upcomingIncomeCents = sumIncomeAtHorizon(state?.incomes, now, nextPaydayDate);

  // upcomingBillsCents is deliberately NOT part of this sum — see the
  // sumUpcomingBills doc comment above and docs/SAFE-TO-SPEND.md §2/§6.
  // A bill only reduces Safe-to-Spend once it's actually marked paid,
  // via the Current Balance debit already baked into currentBalanceCents.
  const totalCommittedCents = plannedExpensesCents + savingsAllocationCents;
  const safeToSpendCents = currentBalanceCents - totalCommittedCents; // upcomingIncomeCents deliberately excluded — see docs/SAFE-TO-SPEND.md §3

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
    // The exact sum already used above to derive safeToSpendCents — the UI
    // needs this to show "how much is committed" (e.g. a progress bar), and
    // must never re-derive it itself (see docs/SAFE-TO-SPEND.md §11b and
    // CLAUDE.md — money arithmetic belongs in this module, not src/ui/).
    totalCommittedCents,
    safeToSpendCents,
    nextPaydayDate,
    daysUntilPayday,
    dailyAllowanceCents,
    isNegative: safeToSpendCents < 0,
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
