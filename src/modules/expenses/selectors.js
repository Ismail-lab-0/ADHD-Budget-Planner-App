import { getLocalDateKey, startOfWeek, startOfMonth, endOfMonth, addDays, addMonths } from '../../core/date.js';
import { isValidAmountCents } from '../../core/money.js';

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Groceries',
  'Eating Out',
  'Transport',
  'Shopping',
  'Entertainment',
  'Health',
  'Subscriptions',
  'Other',
];

export function getAllExpenses(state) {
  return state.expenses ?? [];
}

/**
 * Every category currently "in play" — the default suggestions plus any
 * category actually used by a logged Expense or an existing Category
 * Budget, deduplicated and alphabetized. Category stays free text
 * everywhere (docs/DATA-MODEL.md — no locked enum), so this isn't a
 * source of truth to validate against, just the shared `<datalist>`
 * suggestion list for both the Expense form's category field (this
 * module) and the Category Budget form's category field
 * (src/modules/category-budgets/) — one function so introducing a new
 * category from *either* form makes it "known" to both from then on,
 * without a separate persisted category list. Reads `state.categoryBudgets`
 * directly as raw data (not through category-budgets/index.js) — the same
 * "read another slice's raw data for a simple read-only aggregate"
 * precedent already used by category-budgets/selectors.js reading
 * `state.expenses`, so neither module formally depends on the other.
 * @param {object} state
 * @returns {string[]}
 */
export function getKnownCategories(state) {
  const categories = new Set(DEFAULT_EXPENSE_CATEGORIES);
  const expenses = getAllExpenses(state);
  for (const expense of Array.isArray(expenses) ? expenses : []) {
    if (expense?.category) categories.add(expense.category);
  }
  for (const budget of Array.isArray(state?.categoryBudgets) ? state.categoryBudgets : []) {
    if (budget?.category) categories.add(budget.category);
  }
  return [...categories].sort((a, b) => a.localeCompare(b));
}

function sortByDateDesc(expenses) {
  return expenses.slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

/** Most recent expenses first (by date, then createdAt as a tiebreak) — a short list, not a ledger. */
export function getRecentExpenses(state, { limit = 5 } = {}) {
  return sortByDateDesc(getAllExpenses(state)).slice(0, limit);
}

// The period filter (Recent Expenses section): lets the user look at a
// specific stretch of past spending instead of only "the last few". This
// is a read-only lens over Expenses — it doesn't change what's stored,
// doesn't touch Safe-to-Spend, and follows the same "derived, not stored"
// principle as Category Budgets' monthly figures (src/modules/
// category-budgets/selectors.js) and Safe-to-Spend itself.
export const EXPENSE_PERIODS = ['recent', 'week', 'month', 'lastMonth', 'all', 'custom'];

/**
 * Resolves a period id into inclusive `[startDateKey, endDateKey]` bounds
 * ("YYYY-MM-DD" strings, directly comparable against `Expense.date`), or
 * `null` for periods with no bound on one or both ends ('recent', 'all',
 * or a 'custom' range missing both `from`/`to`).
 * @param {string} period one of EXPENSE_PERIODS
 * @param {{now?: Date, from?: string|null, to?: string|null}} [options]
 * @returns {{startDateKey: string|null, endDateKey: string|null}|null}
 */
export function resolvePeriodRange(period, { now = new Date(), from = null, to = null } = {}) {
  if (period === 'week') {
    const start = startOfWeek(now);
    return { startDateKey: getLocalDateKey(start), endDateKey: getLocalDateKey(addDays(start, 6)) };
  }
  if (period === 'month') {
    return { startDateKey: getLocalDateKey(startOfMonth(now)), endDateKey: getLocalDateKey(endOfMonth(now)) };
  }
  if (period === 'lastMonth') {
    const lastMonth = addMonths(now, -1);
    return { startDateKey: getLocalDateKey(startOfMonth(lastMonth)), endDateKey: getLocalDateKey(endOfMonth(lastMonth)) };
  }
  if (period === 'custom') {
    if (!from && !to) return null;
    return { startDateKey: from || null, endDateKey: to || null };
  }
  return null; // 'recent' and 'all' — no date bound, only 'recent' additionally caps by count
}

/**
 * Expenses within a chosen period, most recent first. 'recent' and 'all'
 * are both unbounded by date — 'recent' additionally caps to `limit`
 * (the existing default-glance behavior); every other period returns
 * every matching expense, uncapped, since the user asked to look at that
 * specific stretch of time.
 * @param {object} state
 * @param {{period?: string, now?: Date, from?: string|null, to?: string|null, limit?: number}} [options]
 */
export function getExpensesForPeriod(state, { period = 'recent', now = new Date(), from = null, to = null, limit = 10 } = {}) {
  const sorted = sortByDateDesc(getAllExpenses(state));
  const range = resolvePeriodRange(period, { now, from, to });
  const filtered = range
    ? sorted.filter((expense) => {
        if (!expense?.date) return false;
        if (range.startDateKey && expense.date < range.startDateKey) return false;
        if (range.endDateKey && expense.date > range.endDateKey) return false;
        return true;
      })
    : sorted;
  return period === 'recent' ? filtered.slice(0, limit) : filtered;
}

/**
 * Sum of a list of expenses' amounts, skipping any with a corrupted/
 * invalid `amountCents` rather than letting one bad value NaN-poison the
 * total (same defensive pattern as src/modules/category-budgets/
 * selectors.js and src/modules/safe-to-spend/calculation.js).
 * @param {Array<{amountCents: number}>} expenses
 */
export function getExpensesTotalCents(expenses) {
  let totalCents = 0;
  for (const expense of Array.isArray(expenses) ? expenses : []) {
    if (!expense || !isValidAmountCents(expense.amountCents)) continue;
    totalCents += expense.amountCents;
  }
  return totalCents;
}
