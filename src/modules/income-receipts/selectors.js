import { isValidAmountCents } from '../../core/money.js';

export function getAllIncomeReceipts(state) {
  const value = state?.incomeReceipts;
  return Array.isArray(value) ? value : [];
}

/**
 * Receipts whose `date` falls within `[startDateKey, endDateKey]`
 * (either bound optional/nullable) — the real, logged counterpart to
 * `getExpensesForPeriod` (src/modules/expenses/selectors.js), used by
 * `getPeriodSummary`'s unbounded-period branch (src/modules/dashboard/
 * index.js) to sum actual received income instead of projecting.
 * @param {object} state
 * @param {{startDateKey?: string|null, endDateKey?: string|null}} [options]
 */
export function getIncomeReceiptsForPeriod(state, { startDateKey = null, endDateKey = null } = {}) {
  return getAllIncomeReceipts(state).filter((receipt) => {
    if (!receipt?.date) return false;
    if (startDateKey && receipt.date < startDateKey) return false;
    if (endDateKey && receipt.date > endDateKey) return false;
    return true;
  });
}

/**
 * Sum of a list of receipts' amounts, skipping any with a corrupted/
 * invalid `amountCents` rather than letting one bad value NaN-poison the
 * total (same defensive pattern as every other *TotalCents helper in this
 * codebase).
 * @param {Array<{amountCents: number}>} receipts
 */
export function getIncomeReceiptsTotalCents(receipts) {
  let totalCents = 0;
  for (const receipt of Array.isArray(receipts) ? receipts : []) {
    if (!receipt || !isValidAmountCents(receipt.amountCents)) continue;
    totalCents += receipt.amountCents;
  }
  return totalCents;
}
