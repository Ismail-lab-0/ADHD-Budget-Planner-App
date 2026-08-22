// The Dashboard module: composition/selection logic for what the
// dashboard displays, as distinct from the Safe-to-Spend *arithmetic*
// (src/modules/safe-to-spend/), which this module never recomputes or
// duplicates — see docs/ARCHITECTURE.md §7 ("the Dashboard module is the
// only module allowed to depend on many other modules' selectors at
// once"). This file only decides *what to list* and *in what order*;
// every dollar figure the dashboard shows comes from
// `getSafeToSpend(state)` directly.

import { getAllBills } from '../bills/index.js';
import { getAllPlannedExpenses } from '../planned-expenses/index.js';
import { getUnreceivedIncomes } from '../incomes/index.js';
import { getExpensesForPeriod, getExpensesTotalCents } from '../expenses/index.js';
import { getIncomeReceiptsForPeriod, getIncomeReceiptsTotalCents } from '../income-receipts/index.js';
import { getBillPaymentsForPeriod, getBillPaymentsTotalCents } from '../bill-payments/index.js';
import { getCurrentBillDueDate } from '../safe-to-spend/index.js';

const DEFAULT_LIMIT = 5;

/**
 * The most relevant upcoming commitments (active, unpaid bills + planned
 * expenses) for a short "at a glance" list — not a full ledger. Dated
 * items sort soonest-first; undated items sort last. See Phase 4 §
 * "Upcoming Commitments" — "do not display a giant transaction table."
 *
 * @param {object} state
 * @param {{limit?: number}} [options]
 * @returns {{items: Array<{id: string, kind: 'bill'|'plannedExpense', name: string, amountCents: number, date: string|null}>, remainingCount: number}}
 */
export function getUpcomingCommitments(state, { limit = DEFAULT_LIMIT } = {}) {
  const relevantBills = getAllBills(state)
    .filter((bill) => bill.active && !bill.paid)
    .map((bill) => ({ id: bill.id, kind: 'bill', name: bill.name, amountCents: bill.amountCents, date: bill.dueDate ?? null }));

  const relevantPlannedExpenses = getAllPlannedExpenses(state).map((expense) => ({
    id: expense.id,
    kind: 'plannedExpense',
    name: expense.name,
    amountCents: expense.amountCents,
    date: expense.plannedDate ?? null,
  }));

  const combined = [...relevantBills, ...relevantPlannedExpenses].sort((a, b) => {
    if (a.date && b.date) return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return 0;
  });

  return {
    items: combined.slice(0, limit),
    remainingCount: Math.max(combined.length - limit, 0),
  };
}

/**
 * The nearest active, unpaid bills, soonest-due first (undated last) — the
 * subset of `getUpcomingCommitments` that's bills only, for a dedicated
 * "Bills due soon" highlight. Same sort convention, no money arithmetic.
 * @param {object} state
 * @param {{limit?: number}} [options]
 * @returns {{items: Array<{id: string, name: string, amountCents: number, date: string|null}>, totalCount: number}}
 */
export function getUpcomingBills(state, { limit = 3 } = {}) {
  const bills = getAllBills(state)
    .filter((bill) => bill.active && !bill.paid)
    .map((bill) => ({ id: bill.id, name: bill.name, amountCents: bill.amountCents, date: bill.dueDate ?? null }))
    .sort((a, b) => {
      if (a.date && b.date) return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      return 0;
    });

  return { items: bills.slice(0, limit), totalCount: bills.length };
}

/**
 * The nearest not-yet-received incomes, soonest-due first — the "Upcoming
 * income" card's shortlist (src/ui/components/upcoming-income.js), same
 * shape/convention as `getUpcomingBills`. Not period-scoped — like Bills
 * due soon, this is always "what's next," regardless of the header bar's
 * global period selector.
 * @param {object} state
 * @param {{limit?: number}} [options]
 * @returns {{items: Array<{id: string, name: string, amountCents: number, date: string|null, frequency: string}>, totalCount: number}}
 */
export function getUpcomingIncome(state, { limit = 3 } = {}) {
  const incomes = getUnreceivedIncomes(state)
    .map((income) => ({ id: income.id, name: income.name, amountCents: income.amountCents, date: income.nextDate ?? null, frequency: income.frequency }))
    .sort((a, b) => {
      if (a.date && b.date) return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      return 0;
    });

  return { items: incomes.slice(0, limit), totalCount: incomes.length };
}

/**
 * The header bar's global period selector feeds every period-scoped card
 * (This Period, Expenses) through this one function — see
 * docs/ARCHITECTURE.md and src/ui/screens/dashboard.js. Deliberately never
 * used by Safe-to-Spend or Current Balance, which are always "right now"
 * snapshots regardless of the selected period.
 *
 * Both figures are sums of a real, dated, historical log — never a
 * projection of what's *scheduled* — so both work identically for any
 * period, bounded or not, with no special-casing between them:
 * - `moneyInCents`: every `IncomeReceipt` (`docs/DATA-MODEL.md`) whose
 *   date falls in range — created automatically each time an Income is
 *   confirmed received ("Mark received"). An Income that's merely
 *   *upcoming* (scheduled but not yet confirmed) never counts here — see
 *   "Upcoming income" (`getUpcomingIncome` below) for that, a
 *   deliberately separate, non-period-scoped concept.
 * - `moneyOutCents`: every logged `Expense` *plus* every `BillPayment`
 *   whose date falls in range — created automatically each time a Bill is
 *   confirmed paid ("Mark paid"). A Bill that's merely *due* in the
 *   period never counts here either — see `billsDueCount` below for that.
 *
 * This used to differ: bounded periods projected from each income's
 * `nextDate`/`frequency` (`getIncomeOccurrencesInRange`) rather than
 * reading confirmed receipts, and bills never contributed to "Money out"
 * at all regardless of paid status. Both were real reported points of
 * confusion — an amount showing as "in"/"out" before it had actually
 * happened. `getIncomeOccurrencesInRange` is kept, unused by this file
 * now, in case a *distinct*, separately-labeled "projected" view is ever
 * wanted later (see its own doc comment).
 *
 * @param {object} state
 * @param {{startDateKey?: string|null, endDateKey?: string|null, now?: Date}} [options]
 * @returns {{moneyInCents: number, moneyOutCents: number, billsDueCount: number}}
 */
export function getPeriodSummary(state, { startDateKey = null, endDateKey = null, now = new Date() } = {}) {
  const periodExpenses = getExpensesForPeriod(state, { period: 'custom', from: startDateKey, to: endDateKey, now });
  const periodPayments = getBillPaymentsForPeriod(state, { startDateKey, endDateKey });
  const moneyOutCents = getExpensesTotalCents(periodExpenses) + getBillPaymentsTotalCents(periodPayments);

  const periodReceipts = getIncomeReceiptsForPeriod(state, { startDateKey, endDateKey });
  const moneyInCents = getIncomeReceiptsTotalCents(periodReceipts);

  const billsDueCount = getAllBills(state).filter((bill) => {
    if (!bill || !bill.active || bill.paid) return false;
    if (!bill.dueDate) return true; // no date at all — conservatively always counts, same convention as safe-to-spend/calculation.js
    const dueKey = getCurrentBillDueDate(bill.dueDate, bill.recurrence, now);
    if (dueKey == null) return false;
    if (startDateKey != null && dueKey < startDateKey) return false;
    if (endDateKey != null && dueKey > endDateKey) return false;
    return true;
  }).length;

  return { moneyInCents, moneyOutCents, billsDueCount };
}
