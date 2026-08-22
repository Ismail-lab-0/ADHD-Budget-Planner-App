import { isValidAmountCents } from '../../core/money.js';

export function getAllBillPayments(state) {
  const value = state?.billPayments;
  return Array.isArray(value) ? value : [];
}

/**
 * Payments whose `date` falls within `[startDateKey, endDateKey]` (either
 * bound optional/nullable) — the real, logged counterpart to
 * `getExpensesForPeriod`/`getIncomeReceiptsForPeriod`, used by
 * `getPeriodSummary`'s "Money out" (src/modules/dashboard/index.js) to
 * include what was actually paid, not just what was due.
 * @param {object} state
 * @param {{startDateKey?: string|null, endDateKey?: string|null}} [options]
 */
export function getBillPaymentsForPeriod(state, { startDateKey = null, endDateKey = null } = {}) {
  return getAllBillPayments(state).filter((payment) => {
    if (!payment?.date) return false;
    if (startDateKey && payment.date < startDateKey) return false;
    if (endDateKey && payment.date > endDateKey) return false;
    return true;
  });
}

/**
 * Sum of a list of payments' amounts, skipping any with a corrupted/
 * invalid `amountCents` rather than letting one bad value NaN-poison the
 * total (same defensive pattern as every other *TotalCents helper in this
 * codebase).
 * @param {Array<{amountCents: number}>} payments
 */
export function getBillPaymentsTotalCents(payments) {
  let totalCents = 0;
  for (const payment of Array.isArray(payments) ? payments : []) {
    if (!payment || !isValidAmountCents(payment.amountCents)) continue;
    totalCents += payment.amountCents;
  }
  return totalCents;
}
