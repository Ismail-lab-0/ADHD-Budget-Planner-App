// Selectors for Category Budgets (Phase 6). "Spent" is always derived
// live from Expenses dated in the current calendar month — there is no
// explicit monthly reset step or stored "spent so far" figure. The month
// simply changes which expenses count, automatically, the moment `now`
// rolls into a new month. This also means these figures can never drift
// out of sync with the Expenses they're computed from (same "derived, not
// stored" principle as Safe-to-Spend — see docs/DATA-MODEL.md §4).
//
// These are purely a planning/visibility layer — see docs/SAFE-TO-SPEND.md
// for why they deliberately do NOT feed into the Safe-to-Spend arithmetic.

import { getLocalDateKey } from '../../core/date.js';
import { isValidAmountCents } from '../../core/money.js';

/** Spending at/above this fraction of the limit (but not yet over) is "approaching". */
export const APPROACHING_THRESHOLD_RATIO = 0.8;

export function getAllCategoryBudgets(state) {
  const value = state?.categoryBudgets;
  return Array.isArray(value) ? value : [];
}

/** "YYYY-MM" — a simple string-prefix month key, comparable against Expense.date ("YYYY-MM-DD"). */
function monthKeyFor(date) {
  return getLocalDateKey(date).slice(0, 7);
}

function sumSpentForCategory(expenses, category, monthKey) {
  let totalCents = 0;
  // Array.isArray, not `?? []` — a corrupted stored value can be present
  // but the wrong type, not just missing; see src/modules/safe-to-spend/
  // calculation.js's identical guard and docs/QA-REPORT.md (Phase 8).
  for (const expense of Array.isArray(expenses) ? expenses : []) {
    if (!expense || expense.category !== category) continue;
    if (!expense.date || !expense.date.startsWith(monthKey)) continue;
    // A corrupted/invalid amountCents (e.g. hand-edited or pre-validation
    // localStorage data) is skipped rather than summed — an unguarded `+=`
    // here would let a single bad value NaN-poison the whole month's
    // "spent" figure and status, matching the defensive pattern already
    // used by src/modules/safe-to-spend/calculation.js.
    if (!isValidAmountCents(expense.amountCents)) continue;
    totalCents += expense.amountCents;
  }
  return totalCents;
}

function statusFor(spentCents, limitCents) {
  if (limitCents <= 0) return spentCents > 0 ? 'exceeded' : 'on-track';
  if (spentCents > limitCents) return 'exceeded';
  if (spentCents >= limitCents * APPROACHING_THRESHOLD_RATIO) return 'approaching';
  return 'on-track';
}

/**
 * Each category budget's progress for the current calendar month.
 * @param {object} state
 * @param {{now?: Date}} [options]
 * @returns {Array<{id: string, category: string, limitCents: number, spentCents: number, remainingCents: number, status: 'on-track'|'approaching'|'exceeded'}>}
 */
export function getCategoryBudgetProgress(state, { now = new Date() } = {}) {
  const monthKey = monthKeyFor(now);
  return getAllCategoryBudgets(state).map((budget) => {
    const spentCents = sumSpentForCategory(state.expenses, budget.category, monthKey);
    const remainingCents = budget.limitCents - spentCents;
    return {
      id: budget.id,
      category: budget.category,
      limitCents: budget.limitCents,
      spentCents,
      remainingCents,
      status: statusFor(spentCents, budget.limitCents),
    };
  });
}

/**
 * The Monthly View (Phase 6): totals across *budgeted* categories only —
 * spending in a category with no budget defined isn't part of this
 * summary (it's still visible on the Recent Expenses list, just not
 * folded into "total spent" here, which would otherwise make "remaining"
 * mean something different than "budget minus spend").
 * @param {object} state
 * @param {{now?: Date}} [options]
 */
export function getMonthlyBudgetSummary(state, { now = new Date() } = {}) {
  const categories = getCategoryBudgetProgress(state, { now });
  const totalPlannedCents = categories.reduce((sum, c) => sum + c.limitCents, 0);
  const totalSpentCents = categories.reduce((sum, c) => sum + c.spentCents, 0);
  return {
    totalPlannedCents,
    totalSpentCents,
    totalRemainingCents: totalPlannedCents - totalSpentCents,
    categories,
  };
}
