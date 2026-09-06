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
import { getExpensesForPeriod, getExpensesTotalCents, resolvePeriodRange } from '../expenses/index.js';
import { getIncomeReceiptsForPeriod, getIncomeReceiptsTotalCents } from '../income-receipts/index.js';
import { getBillPaymentsForPeriod, getBillPaymentsTotalCents } from '../bill-payments/index.js';
import { getCurrentBillDueDate, getSafeToSpend } from '../safe-to-spend/index.js';
import { isValidAmountCents } from '../../core/money.js';
import { getLocalDateKey } from '../../core/date.js';

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
 * Total amount currently owed across every active, unpaid bill — the
 * dollar-amount counterpart to `getUpcomingBills`'s `totalCount`. (Kept
 * available; the summary-strip tile that first used it was removed in the
 * reference-based dashboard redesign — see CLAUDE.md.)
 * Same active-and-unpaid filter as `getUpcomingBills`, but unbounded (no
 * `limit`, since a sum needs every matching bill, not just the nearest
 * few) and with no due-date horizon applied — unlike `getSafeToSpend`'s
 * own `upcomingBillsCents` (src/modules/safe-to-spend/calculation.js),
 * which only counts bills due before the next payday, this is every bill
 * currently unpaid, matching what "Bills due" (the neighboring count
 * tile) already means. Skips a corrupted `amountCents` rather than
 * letting one bad value NaN-poison the total, same defensive pattern as
 * `getExpensesTotalCents`.
 * @param {object} state
 * @returns {number}
 */
export function getUpcomingBillsTotalCents(state) {
  let totalCents = 0;
  for (const bill of getAllBills(state)) {
    if (!bill || !bill.active || bill.paid) continue;
    if (!isValidAmountCents(bill.amountCents)) continue;
    totalCents += bill.amountCents;
  }
  return totalCents;
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

/**
 * Everything the Safe-to-Spend hero's "How is this worked out?" panel
 * needs, as one object — the canonical `getSafeToSpend` result plus a
 * `period` block of grouped figures the panel shows row by row. **This
 * module composes; it does not re-derive the Safe-to-Spend arithmetic**
 * (docs/ARCHITECTURE.md §7, CLAUDE.md) — every figure below is either
 * straight off `getSafeToSpend` or a plain sum of a real dated log
 * (`Expense` / `BillPayment` / `IncomeReceipt`), the same logs
 * `getPeriodSummary` already reads.
 *
 * The panel renders (see src/ui/components/safe-to-spend-hero.js):
 *
 *   In checking                         inCheckingCents
 *   + Arrived after that balance        arrivedAfterBalanceCents
 *   − Bills still to land               result.upcomingBillsCents
 *   − Paid and spent after that balance paidAndSpentAfterBalanceCents
 *   − Already set aside                 setAsideCents
 *   ───────────────────────────────
 *   Safe until payday                   result.safeToSpendCents
 *
 * `inCheckingCents` is `currentBalanceCents` with this month's logged
 * balance movements added back (`+ spent + billsPaid − incomeReceived`),
 * so the flow reconciles **exactly, by construction**:
 *
 *   inChecking + arrived − billsStillToLand − paidAndSpent − setAside
 *     === currentBalance − upcomingBills − plannedExpenses − goalsSaved
 *     === netAfterCommittedCents   (then floored at 0 → safeToSpendCents, §10)
 *
 * Anything else that moved the balance this month with no dated log — a
 * savings transfer (`budget/add-to-savings`), a manual balance edit — is
 * absorbed into `inCheckingCents`.
 *
 * Grouping: `paidAndSpentAfterBalanceCents` = this month's `Expense`s
 * (which already include debt-payment expenses, counted once) + this
 * month's `BillPayment`s. `setAsideCents` = `plannedExpensesCents +
 * goalsSavedCents` (NOT `upcomingBillsCents` — that's its own
 * "Bills still to land" row).
 *
 * @param {object} state
 * @param {{now?: Date}} [options]
 * @returns {ReturnType<typeof getSafeToSpend> & {period: {inCheckingCents: number, arrivedAfterBalanceCents: number, paidAndSpentAfterBalanceCents: number, setAsideCents: number}}}
 */
export function getSafeToSpendBreakdown(state, { now = new Date() } = {}) {
  const result = getSafeToSpend(state, { now });

  const range = resolvePeriodRange('month', { now }) ?? {};
  const startDateKey = range.startDateKey ?? null;
  const endDateKey = range.endDateKey ?? null;

  const spentThisMonthCents = getExpensesTotalCents(
    getExpensesForPeriod(state, { period: 'custom', from: startDateKey, to: endDateKey, now })
  );
  const billsPaidThisMonthCents = getBillPaymentsTotalCents(getBillPaymentsForPeriod(state, { startDateKey, endDateKey }));
  const incomeReceivedThisMonthCents = getIncomeReceiptsTotalCents(getIncomeReceiptsForPeriod(state, { startDateKey, endDateKey }));

  const inCheckingCents =
    result.currentBalanceCents + spentThisMonthCents + billsPaidThisMonthCents - incomeReceivedThisMonthCents;

  return {
    ...result,
    period: {
      inCheckingCents,
      arrivedAfterBalanceCents: incomeReceivedThisMonthCents,
      paidAndSpentAfterBalanceCents: spentThisMonthCents + billsPaidThisMonthCents,
      setAsideCents: result.plannedExpensesCents + result.goalsSavedCents,
    },
  };
}

/**
 * Money in vs money out for each calendar month of `now`'s year — the
 * Dashboard's "Overview" chart. Composes `getPeriodSummary` per month, so
 * "in" is confirmed `IncomeReceipt`s and "out" is `Expense`s +
 * `BillPayment`s, exactly as the rest of the app defines them. Months
 * with no activity are still returned (a zero bar reads as a quiet
 * month), including months later in the year than today.
 * @param {object} state
 * @param {{now?: Date}} [options]
 * @returns {Array<{key: string, label: string, inCents: number, outCents: number}>}
 */
export function getMonthlyInVsOut(state, { now = new Date() } = {}) {
  const year = now.getFullYear();
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'short' });
  const rows = [];
  for (let month = 0; month < 12; month++) {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const summary = getPeriodSummary(state, { startDateKey: getLocalDateKey(first), endDateKey: getLocalDateKey(last), now });
    rows.push({ key: `${year}-${String(month + 1).padStart(2, '0')}`, label: monthName.format(first), inCents: summary.moneyInCents, outCents: summary.moneyOutCents });
  }
  return rows;
}

/**
 * This calendar month's logged spending vs last month's, with the percent
 * change — the delta chip on the Dashboard's "Total Expenses" stat card.
 * `Expense` records only (a debt payment is already one). `deltaPct` is
 * `null` when last month had no spending (no meaningful base).
 * @param {object} state
 * @param {{now?: Date}} [options]
 * @returns {{thisMonthCents: number, lastMonthCents: number, deltaPct: number|null}}
 */
export function getExpensesMonthOverMonth(state, { now = new Date() } = {}) {
  const total = (period) => {
    const range = resolvePeriodRange(period, { now });
    return getExpensesForPeriod(state, { period: 'custom', from: range?.startDateKey ?? null, to: range?.endDateKey ?? null, now }).reduce(
      (sum, expense) => sum + (isValidAmountCents(expense?.amountCents) ? expense.amountCents : 0),
      0
    );
  };
  const thisMonthCents = total('month');
  const lastMonthCents = total('lastMonth');
  const deltaPct = lastMonthCents > 0 ? ((thisMonthCents - lastMonthCents) / lastMonthCents) * 100 : null;
  return { thisMonthCents, lastMonthCents, deltaPct };
}
