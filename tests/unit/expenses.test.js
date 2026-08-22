// Tests for the Expenses module (Phase 5): creation, editing, deletion,
// defaults, category, dates, decimal amounts. Balance-linking behavior is
// tested separately in tests/unit/expenses-balance-effect.test.js and
// tests/unit/expenses-persistence.test.js (integration, through the real
// store).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createExpenseAction,
  updateExpenseAction,
  deleteExpenseAction,
  expensesReducer,
  DEFAULT_EXPENSE_CATEGORIES,
  getRecentExpenses,
  getExpensesForPeriod,
  getExpensesTotalCents,
  resolvePeriodRange,
  getKnownCategories,
} from '../../src/modules/expenses/index.js';

const NOW = new Date('2026-08-21T09:00:00.000Z');

function seedExpense(overrides) {
  return expensesReducer([], createExpenseAction({ amountCents: 1250, ...overrides }, { now: NOW }))[0];
}

describe('expense creation', () => {
  test('amount alone is enough to create a valid expense', () => {
    const [expense] = expensesReducer([], createExpenseAction({ amountCents: 1250 }, { now: NOW }));
    assert.equal(expense.amountCents, 1250);
    assert.equal(expense.id.startsWith('e_'), true);
  });

  test('defaults: description/category/notes null, date defaults to today, timestamps set', () => {
    const [expense] = expensesReducer([], createExpenseAction({ amountCents: 500 }, { now: NOW }));
    assert.equal(expense.description, null);
    assert.equal(expense.category, null);
    assert.equal(expense.notes, null);
    assert.equal(expense.date, '2026-08-21');
    assert.equal(expense.createdAt, NOW.toISOString());
    assert.equal(expense.updatedAt, NOW.toISOString());
  });

  test('optional fields are stored when given', () => {
    const [expense] = expensesReducer(
      [],
      createExpenseAction({ amountCents: 500, description: 'Coffee', date: '2026-08-15', category: 'Eating Out', notes: 'with a friend' }, { now: NOW })
    );
    assert.equal(expense.description, 'Coffee');
    assert.equal(expense.date, '2026-08-15');
    assert.equal(expense.category, 'Eating Out');
    assert.equal(expense.notes, 'with a friend');
  });

  test('a missing or invalid amount is refused', () => {
    assert.deepEqual(expensesReducer([], createExpenseAction({ amountCents: undefined }, { now: NOW })), []);
    assert.deepEqual(expensesReducer([], createExpenseAction({ amountCents: -100 }, { now: NOW })), []);
    assert.deepEqual(expensesReducer([], createExpenseAction({ amountCents: 12.5 }, { now: NOW })), []);
  });

  test('a custom category not in the default list is accepted (categories are customizable)', () => {
    const [expense] = expensesReducer([], createExpenseAction({ amountCents: 500, category: 'Pet supplies' }, { now: NOW }));
    assert.equal(expense.category, 'Pet supplies');
  });

  test('decimal amounts create exact cents, no float drift', () => {
    const [expense] = expensesReducer([], createExpenseAction({ amountCents: 1999 }, { now: NOW })); // $19.99
    assert.equal(expense.amountCents, 1999);
  });
});

describe('default categories', () => {
  test('provides the 8 sensible defaults from Phase 5', () => {
    assert.deepEqual(DEFAULT_EXPENSE_CATEGORIES, [
      'Groceries',
      'Eating Out',
      'Transport',
      'Shopping',
      'Entertainment',
      'Health',
      'Subscriptions',
      'Other',
    ]);
  });
});

describe('expense editing', () => {
  test('editable fields apply and updatedAt advances', () => {
    const expense = seedExpense();
    const later = new Date('2026-08-22T10:00:00.000Z');
    const [updated] = expensesReducer([expense], updateExpenseAction(expense.id, { amountCents: 2000, category: 'Groceries' }, { now: later }));
    assert.equal(updated.amountCents, 2000);
    assert.equal(updated.category, 'Groceries');
    assert.equal(updated.updatedAt, later.toISOString());
  });

  test('the date can be changed', () => {
    const expense = seedExpense({ date: '2026-08-20' });
    const [updated] = expensesReducer([expense], updateExpenseAction(expense.id, { date: '2026-08-19' }, { now: NOW }));
    assert.equal(updated.date, '2026-08-19');
  });

  test('an update cannot change id or createdAt', () => {
    const expense = seedExpense();
    const [updated] = expensesReducer([expense], updateExpenseAction(expense.id, { id: 'hacked', createdAt: 'x' }, { now: NOW }));
    assert.equal(updated.id, expense.id);
    assert.equal(updated.createdAt, expense.createdAt);
  });

  test('an update with an invalid amount is dropped, not applied', () => {
    const expense = seedExpense();
    const [updated] = expensesReducer([expense], updateExpenseAction(expense.id, { amountCents: -5 }, { now: NOW }));
    assert.equal(updated.amountCents, 1250);
  });

  test('updating a nonexistent id is a no-op (same array reference)', () => {
    const expenses = [seedExpense()];
    assert.equal(expensesReducer(expenses, updateExpenseAction('missing', { amountCents: 100 }, { now: NOW })), expenses);
  });
});

describe('expense deletion', () => {
  test('delete removes the expense', () => {
    const expense = seedExpense();
    assert.deepEqual(expensesReducer([expense], deleteExpenseAction(expense.id)), []);
  });

  test('deleting a nonexistent id is a no-op', () => {
    const expenses = [];
    assert.equal(expensesReducer(expenses, deleteExpenseAction('missing')), expenses);
  });
});

describe('getRecentExpenses', () => {
  test('sorts most recent first by date, limited to a short list', () => {
    const e1 = seedExpense({ date: '2026-08-19' });
    const e2 = seedExpense({ date: '2026-08-21' });
    const e3 = seedExpense({ date: '2026-08-20' });
    const recent = getRecentExpenses({ expenses: [e1, e2, e3] }, { limit: 2 });
    assert.deepEqual(recent.map((e) => e.date), ['2026-08-21', '2026-08-20']);
  });
});

// Friday, August 21, 2026 — the same fixed reference point used by
// tests/unit/qa-date-scenarios.test.js.
const TODAY = new Date(2026, 7, 21);

describe('resolvePeriodRange (the period filter, Recent Expenses section)', () => {
  test("'week' resolves to the Monday-Sunday of the current calendar week", () => {
    assert.deepEqual(resolvePeriodRange('week', { now: TODAY }), { startDateKey: '2026-08-17', endDateKey: '2026-08-23' });
  });

  test("'month' resolves to the full current calendar month", () => {
    assert.deepEqual(resolvePeriodRange('month', { now: TODAY }), { startDateKey: '2026-08-01', endDateKey: '2026-08-31' });
  });

  test("'lastMonth' resolves to the full previous calendar month", () => {
    assert.deepEqual(resolvePeriodRange('lastMonth', { now: TODAY }), { startDateKey: '2026-07-01', endDateKey: '2026-07-31' });
  });

  test("'all' and 'recent' are unbounded", () => {
    assert.equal(resolvePeriodRange('all', { now: TODAY }), null);
    assert.equal(resolvePeriodRange('recent', { now: TODAY }), null);
  });

  test("'custom' with both bounds given uses them as-is", () => {
    assert.deepEqual(resolvePeriodRange('custom', { from: '2026-01-01', to: '2026-01-15' }), { startDateKey: '2026-01-01', endDateKey: '2026-01-15' });
  });

  test("'custom' with only one bound given is open-ended on the other side", () => {
    assert.deepEqual(resolvePeriodRange('custom', { from: '2026-01-01' }), { startDateKey: '2026-01-01', endDateKey: null });
  });

  test("'custom' with neither bound given is unbounded", () => {
    assert.equal(resolvePeriodRange('custom', {}), null);
  });
});

describe('getExpensesForPeriod', () => {
  test("'recent' caps to limit, most recent first, regardless of date spread", () => {
    const e1 = seedExpense({ date: '2026-01-01' });
    const e2 = seedExpense({ date: '2026-08-21' });
    const e3 = seedExpense({ date: '2026-08-20' });
    const result = getExpensesForPeriod({ expenses: [e1, e2, e3] }, { period: 'recent', limit: 2 });
    assert.deepEqual(result.map((e) => e.date), ['2026-08-21', '2026-08-20']);
  });

  test("'month' returns every expense in the current calendar month, uncapped", () => {
    const inMonth1 = seedExpense({ date: '2026-08-01' });
    const inMonth2 = seedExpense({ date: '2026-08-31' });
    const outOfMonth = seedExpense({ date: '2026-07-31' });
    const result = getExpensesForPeriod({ expenses: [inMonth1, inMonth2, outOfMonth] }, { period: 'month', now: TODAY });
    assert.deepEqual(result.map((e) => e.date).sort(), ['2026-08-01', '2026-08-31']);
  });

  test("'week' excludes expenses outside the current Monday-Sunday window", () => {
    const inWeek = seedExpense({ date: '2026-08-19' }); // Wednesday, same week as Aug 21
    const lastWeek = seedExpense({ date: '2026-08-14' });
    const result = getExpensesForPeriod({ expenses: [inWeek, lastWeek] }, { period: 'week', now: TODAY });
    assert.deepEqual(result.map((e) => e.id), [inWeek.id]);
  });

  test("'custom' filters to the given inclusive range", () => {
    const before = seedExpense({ date: '2025-12-31' });
    const inside = seedExpense({ date: '2026-01-15' });
    const after = seedExpense({ date: '2026-02-01' });
    const result = getExpensesForPeriod({ expenses: [before, inside, after] }, { period: 'custom', from: '2026-01-01', to: '2026-01-31' });
    assert.deepEqual(result.map((e) => e.id), [inside.id]);
  });

  test("'all' returns everything, uncapped, regardless of date", () => {
    const expenses = [seedExpense({ date: '2020-01-01' }), seedExpense({ date: '2026-08-21' })];
    const result = getExpensesForPeriod({ expenses }, { period: 'all' });
    assert.equal(result.length, 2);
  });

  test('an expense with no date is excluded from every date-bounded period', () => {
    const noDate = seedExpense();
    noDate.date = null;
    const result = getExpensesForPeriod({ expenses: [noDate] }, { period: 'month', now: TODAY });
    assert.deepEqual(result, []);
  });
});

describe('getExpensesTotalCents', () => {
  test('sums amounts across a list', () => {
    assert.equal(getExpensesTotalCents([{ amountCents: 500 }, { amountCents: 1250 }]), 1750);
  });

  test('is 0 for an empty list', () => {
    assert.equal(getExpensesTotalCents([]), 0);
  });

  test('skips an entry with a corrupted/invalid amountCents rather than NaN-poisoning the total', () => {
    assert.equal(getExpensesTotalCents([{ amountCents: 500 }, { amountCents: 'not a number' }, { amountCents: -100 }]), 500);
  });

  test('tolerates a non-array input, returning 0', () => {
    assert.equal(getExpensesTotalCents(null), 0);
    assert.equal(getExpensesTotalCents(undefined), 0);
  });
});

describe('getKnownCategories (shared suggestions for the Expense and Category Budget forms)', () => {
  test('an empty state returns just the default suggestions, alphabetized', () => {
    assert.deepEqual(getKnownCategories({ expenses: [], categoryBudgets: [] }), [...DEFAULT_EXPENSE_CATEGORIES].sort());
  });

  test('includes a custom category used by a logged expense', () => {
    const result = getKnownCategories({ expenses: [{ category: 'Pet Supplies' }], categoryBudgets: [] });
    assert.ok(result.includes('Pet Supplies'));
    assert.ok(result.includes('Groceries')); // defaults are still present alongside it
  });

  test('includes a custom category used by an existing category budget', () => {
    const result = getKnownCategories({ expenses: [], categoryBudgets: [{ category: 'Home Repairs' }] });
    assert.ok(result.includes('Home Repairs'));
  });

  test('deduplicates a category appearing in both expenses and category budgets, and among the defaults', () => {
    const result = getKnownCategories({
      expenses: [{ category: 'Groceries' }, { category: 'Groceries' }],
      categoryBudgets: [{ category: 'Groceries' }],
    });
    assert.equal(result.filter((c) => c === 'Groceries').length, 1);
  });

  test('ignores expenses/budgets with no category set', () => {
    const result = getKnownCategories({ expenses: [{ category: null }, {}], categoryBudgets: [{ category: undefined }] });
    assert.deepEqual(result, [...DEFAULT_EXPENSE_CATEGORIES].sort());
  });

  test('is alphabetized', () => {
    const result = getKnownCategories({ expenses: [{ category: 'Zoo membership' }, { category: 'Aardvark food' }], categoryBudgets: [] });
    assert.equal(result[0], 'Aardvark food');
    assert.equal(result[result.length - 1], 'Zoo membership');
  });

  test('tolerates a missing or corrupted expenses/categoryBudgets collection rather than throwing', () => {
    assert.deepEqual(getKnownCategories({}), [...DEFAULT_EXPENSE_CATEGORIES].sort());
    assert.deepEqual(getKnownCategories({ expenses: 'not an array', categoryBudgets: 'not an array' }), [...DEFAULT_EXPENSE_CATEGORIES].sort());
  });
});
