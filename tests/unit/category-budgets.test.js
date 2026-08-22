// Tests for the Category Budgets module (Phase 6): creation, editing,
// deletion, spending calculation, exceeded status, and monthly period
// handling. Safe-to-Spend interaction (the "critical" no-double-
// subtraction requirement) is tested separately in
// tests/unit/category-budgets-safe-to-spend.test.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCategoryBudgetAction,
  updateCategoryBudgetAction,
  deleteCategoryBudgetAction,
  categoryBudgetsReducer,
  getCategoryBudgetProgress,
  getMonthlyBudgetSummary,
  APPROACHING_THRESHOLD_RATIO,
} from '../../src/modules/category-budgets/index.js';

const NOW = new Date(2026, 7, 21); // August 21, 2026 — fixed, never the real date

function seedBudget(overrides) {
  return categoryBudgetsReducer([], createCategoryBudgetAction({ category: 'Groceries', limitCents: 40000, ...overrides }, { now: NOW }))[0];
}

function expense({ category, amountCents, date }) {
  return { id: `e_${Math.random()}`, category, amountCents, date, description: null, notes: null, createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() };
}

describe('category budget creation', () => {
  test('category + limit is enough to create a valid budget', () => {
    const [budget] = categoryBudgetsReducer([], createCategoryBudgetAction({ category: 'Groceries', limitCents: 40000 }, { now: NOW }));
    assert.equal(budget.category, 'Groceries');
    assert.equal(budget.limitCents, 40000);
    assert.equal(budget.id.startsWith('cb_'), true);
  });

  test('an empty category or invalid limit is refused', () => {
    assert.deepEqual(categoryBudgetsReducer([], createCategoryBudgetAction({ category: '  ', limitCents: 1000 }, { now: NOW })), []);
    assert.deepEqual(categoryBudgetsReducer([], createCategoryBudgetAction({ category: 'x', limitCents: -1 }, { now: NOW })), []);
    assert.deepEqual(categoryBudgetsReducer([], createCategoryBudgetAction({ category: 'x', limitCents: 12.5 }, { now: NOW })), []);
  });

  test('the category is trimmed', () => {
    const [budget] = categoryBudgetsReducer([], createCategoryBudgetAction({ category: '  Groceries  ', limitCents: 1000 }, { now: NOW }));
    assert.equal(budget.category, 'Groceries');
  });
});

describe('category budget editing', () => {
  test('editable fields apply and updatedAt advances', () => {
    const budget = seedBudget();
    const later = new Date(2026, 7, 22);
    const [updated] = categoryBudgetsReducer([budget], updateCategoryBudgetAction(budget.id, { limitCents: 50000 }, { now: later }));
    assert.equal(updated.limitCents, 50000);
    assert.equal(updated.updatedAt, later.toISOString());
  });

  test('an update cannot change id or createdAt', () => {
    const budget = seedBudget();
    const [updated] = categoryBudgetsReducer([budget], updateCategoryBudgetAction(budget.id, { id: 'hacked', createdAt: 'x' }, { now: NOW }));
    assert.equal(updated.id, budget.id);
    assert.equal(updated.createdAt, budget.createdAt);
  });

  test('an update cannot blank the category or apply an invalid limit', () => {
    const budget = seedBudget();
    const [updated] = categoryBudgetsReducer([budget], updateCategoryBudgetAction(budget.id, { category: '  ', limitCents: -5 }, { now: NOW }));
    assert.equal(updated.category, 'Groceries');
    assert.equal(updated.limitCents, 40000);
  });

  test('updating a nonexistent id is a no-op (same array reference)', () => {
    const budgets = [seedBudget()];
    assert.equal(categoryBudgetsReducer(budgets, updateCategoryBudgetAction('missing', { limitCents: 100 }, { now: NOW })), budgets);
  });
});

describe('category budget deletion', () => {
  test('delete removes the budget', () => {
    const budget = seedBudget();
    assert.deepEqual(categoryBudgetsReducer([budget], deleteCategoryBudgetAction(budget.id)), []);
  });

  test('deleting a nonexistent id is a no-op', () => {
    const budgets = [];
    assert.equal(categoryBudgetsReducer(budgets, deleteCategoryBudgetAction('missing')), budgets);
  });
});

describe('spending against a category', () => {
  test('sums only expenses in the matching category, this month', () => {
    const budget = seedBudget({ category: 'Groceries', limitCents: 40000 });
    const state = {
      categoryBudgets: [budget],
      expenses: [
        expense({ category: 'Groceries', amountCents: 15000, date: '2026-08-05' }),
        expense({ category: 'Groceries', amountCents: 13000, date: '2026-08-19' }),
        expense({ category: 'Eating Out', amountCents: 5000, date: '2026-08-10' }), // different category — excluded
      ],
    };
    const [progress] = getCategoryBudgetProgress(state, { now: NOW });
    assert.equal(progress.spentCents, 28000);
    assert.equal(progress.remainingCents, 12000);
  });

  test('an unbudgeted category never appears in the progress list', () => {
    const state = { categoryBudgets: [], expenses: [expense({ category: 'Transport', amountCents: 5000, date: '2026-08-10' })] };
    assert.deepEqual(getCategoryBudgetProgress(state, { now: NOW }), []);
  });

  test('an expense with no category is never counted against any budget', () => {
    const budget = seedBudget({ category: 'Groceries' });
    const state = { categoryBudgets: [budget], expenses: [expense({ category: null, amountCents: 5000, date: '2026-08-10' })] };
    const [progress] = getCategoryBudgetProgress(state, { now: NOW });
    assert.equal(progress.spentCents, 0);
  });

  test('Phase 8 — data safety: a corrupted amountCents on a matching expense is skipped, not NaN-summed into spentCents', () => {
    const budget = seedBudget({ category: 'Groceries', limitCents: 40000 });
    const state = {
      categoryBudgets: [budget],
      expenses: [
        expense({ category: 'Groceries', amountCents: 15000, date: '2026-08-05' }),
        expense({ category: 'Groceries', amountCents: 'corrupted', date: '2026-08-19' }),
        expense({ category: 'Groceries', amountCents: undefined, date: '2026-08-12' }),
      ],
    };
    const [progress] = getCategoryBudgetProgress(state, { now: NOW });
    assert.equal(progress.spentCents, 15000); // only the one valid expense counts
    assert.equal(progress.remainingCents, 25000);
    assert.equal(Number.isNaN(progress.spentCents), false);
  });
});

describe('exceeded / approaching / on-track status', () => {
  test('well under the limit is on-track', () => {
    const budget = seedBudget({ limitCents: 40000 });
    const state = { categoryBudgets: [budget], expenses: [expense({ category: 'Groceries', amountCents: 10000, date: '2026-08-05' })] };
    assert.equal(getCategoryBudgetProgress(state, { now: NOW })[0].status, 'on-track');
  });

  test(`at/above ${APPROACHING_THRESHOLD_RATIO * 100}% but not over is approaching`, () => {
    const budget = seedBudget({ limitCents: 40000 });
    const state = { categoryBudgets: [budget], expenses: [expense({ category: 'Groceries', amountCents: 32000, date: '2026-08-05' })] }; // 80%
    assert.equal(getCategoryBudgetProgress(state, { now: NOW })[0].status, 'approaching');
  });

  test('spending past the limit is exceeded, and remaining goes negative', () => {
    const budget = seedBudget({ limitCents: 40000 });
    const state = { categoryBudgets: [budget], expenses: [expense({ category: 'Groceries', amountCents: 45000, date: '2026-08-05' })] };
    const [progress] = getCategoryBudgetProgress(state, { now: NOW });
    assert.equal(progress.status, 'exceeded');
    assert.equal(progress.remainingCents, -5000);
  });

  test('exceeding a budget produces a neutral remainingCents figure, not a special "shame" value', () => {
    // No separate flag or altered arithmetic for the exceeded case — the
    // same subtraction, just a negative result. See docs/PRODUCT.md §3/§6.
    const budget = seedBudget({ limitCents: 10000 });
    const state = { categoryBudgets: [budget], expenses: [expense({ category: 'Groceries', amountCents: 11000, date: '2026-08-05' })] };
    const [progress] = getCategoryBudgetProgress(state, { now: NOW });
    assert.equal(progress.remainingCents, progress.limitCents - progress.spentCents);
  });
});

describe('monthly reset / period handling', () => {
  test('an expense from a previous month is excluded from this month\'s spent figure', () => {
    const budget = seedBudget({ limitCents: 40000 });
    const state = {
      categoryBudgets: [budget],
      expenses: [
        expense({ category: 'Groceries', amountCents: 30000, date: '2026-07-25' }), // last month
        expense({ category: 'Groceries', amountCents: 10000, date: '2026-08-05' }), // this month
      ],
    };
    const [progress] = getCategoryBudgetProgress(state, { now: NOW });
    assert.equal(progress.spentCents, 10000); // only the August expense counts
  });

  test('an expense from a future month is also excluded', () => {
    const budget = seedBudget({ limitCents: 40000 });
    const state = { categoryBudgets: [budget], expenses: [expense({ category: 'Groceries', amountCents: 10000, date: '2026-09-01' })] };
    assert.equal(getCategoryBudgetProgress(state, { now: NOW })[0].spentCents, 0);
  });

  test('"reset" happens automatically as the month changes, with no explicit reset action', () => {
    const budget = seedBudget({ limitCents: 40000 });
    const state = { categoryBudgets: [budget], expenses: [expense({ category: 'Groceries', amountCents: 30000, date: '2026-08-30' })] };

    const augustResult = getCategoryBudgetProgress(state, { now: new Date(2026, 7, 30) });
    assert.equal(augustResult[0].spentCents, 30000);

    const septemberResult = getCategoryBudgetProgress(state, { now: new Date(2026, 8, 1) });
    assert.equal(septemberResult[0].spentCents, 0); // same data, new month — no reset step needed
  });
});

describe('getMonthlyBudgetSummary', () => {
  test('totals only budgeted categories, not all spending', () => {
    const groceries = seedBudget({ category: 'Groceries', limitCents: 40000 });
    const eatingOut = categoryBudgetsReducer([], createCategoryBudgetAction({ category: 'Eating Out', limitCents: 15000 }, { now: NOW }))[0];
    const state = {
      categoryBudgets: [groceries, eatingOut],
      expenses: [
        expense({ category: 'Groceries', amountCents: 28000, date: '2026-08-05' }),
        expense({ category: 'Eating Out', amountCents: 9000, date: '2026-08-10' }),
        expense({ category: 'Transport', amountCents: 5000, date: '2026-08-15' }), // unbudgeted — excluded from the summary
      ],
    };
    const summary = getMonthlyBudgetSummary(state, { now: NOW });
    assert.equal(summary.totalPlannedCents, 55000);
    assert.equal(summary.totalSpentCents, 37000); // 28000 + 9000, not +5000
    assert.equal(summary.totalRemainingCents, 18000);
    assert.equal(summary.categories.length, 2);
  });

  test('an empty budget list produces zeroed totals', () => {
    const summary = getMonthlyBudgetSummary({ categoryBudgets: [], expenses: [] }, { now: NOW });
    assert.equal(summary.totalPlannedCents, 0);
    assert.equal(summary.totalSpentCents, 0);
    assert.equal(summary.totalRemainingCents, 0);
  });
});
