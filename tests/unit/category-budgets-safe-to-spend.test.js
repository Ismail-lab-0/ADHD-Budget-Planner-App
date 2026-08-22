// THE critical test for Phase 6: category budgets must never cause the
// same money to be subtracted from Safe-to-Spend twice. See
// docs/SAFE-TO-SPEND.md §3b for the full reasoning — category budgets are
// a planning/visibility layer over Expenses that already reduced Current
// Balance once (Phase 5); they must never independently subtract
// anything from the Safe-to-Spend arithmetic.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { initAppState } from '../../src/main.js';
import { createStorageAdapter } from '../../src/core/storage.js';
import { getSafeToSpend } from '../../src/modules/safe-to-spend/index.js';
import { setCurrentBalanceAction } from '../../src/modules/budget/index.js';
import { createExpenseAction } from '../../src/modules/expenses/index.js';
import { createCategoryBudgetAction, updateCategoryBudgetAction, deleteCategoryBudgetAction } from '../../src/modules/category-budgets/index.js';

function createMockStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

const NOW = new Date(2026, 7, 21);

function reload(backing) {
  return initAppState({ storageAdapter: createStorageAdapter({ storage: backing, debounceMs: 0 }), now: NOW });
}

describe('creating/editing/deleting a category budget never changes Safe-to-Spend', () => {
  test('creating a category budget has zero effect on the result', () => {
    const { store } = reload(createMockStorage());
    store.dispatch(setCurrentBalanceAction(100000));
    const before = getSafeToSpend(store.getState(), { now: NOW });

    store.dispatch(createCategoryBudgetAction({ category: 'Groceries', limitCents: 40000 }, { now: NOW }));

    const after = getSafeToSpend(store.getState(), { now: NOW });
    assert.deepEqual(after, before);
  });

  test('editing a category budget\'s limit has zero effect on the result', () => {
    const { store } = reload(createMockStorage());
    store.dispatch(setCurrentBalanceAction(100000));
    store.dispatch(createCategoryBudgetAction({ category: 'Groceries', limitCents: 40000 }, { now: NOW }));
    const id = store.getState().categoryBudgets[0].id;
    const before = getSafeToSpend(store.getState(), { now: NOW });

    store.dispatch(updateCategoryBudgetAction(id, { limitCents: 90000 }, { now: NOW }));

    const after = getSafeToSpend(store.getState(), { now: NOW });
    assert.deepEqual(after, before);
  });

  test('deleting a category budget has zero effect on the result', () => {
    const { store } = reload(createMockStorage());
    store.dispatch(setCurrentBalanceAction(100000));
    store.dispatch(createCategoryBudgetAction({ category: 'Groceries', limitCents: 40000 }, { now: NOW }));
    const id = store.getState().categoryBudgets[0].id;
    const before = getSafeToSpend(store.getState(), { now: NOW });

    store.dispatch(deleteCategoryBudgetAction(id));

    const after = getSafeToSpend(store.getState(), { now: NOW });
    assert.deepEqual(after, before);
  });
});

describe('logging an expense against a budgeted category reduces Safe-to-Spend exactly once', () => {
  test('a $50 grocery expense with a $400 Groceries budget moves Safe-to-Spend by exactly $50, not $100', () => {
    const { store } = reload(createMockStorage());
    store.dispatch(setCurrentBalanceAction(100000)); // $1,000
    store.dispatch(createCategoryBudgetAction({ category: 'Groceries', limitCents: 40000 }, { now: NOW })); // $400/mo

    const before = getSafeToSpend(store.getState(), { now: NOW }).safeToSpendCents;
    store.dispatch(createExpenseAction({ amountCents: 5000, category: 'Groceries' }, { now: NOW })); // $50
    const after = getSafeToSpend(store.getState(), { now: NOW }).safeToSpendCents;

    // Exactly one $50 deduction (through Current Balance, Phase 5's
    // model) — not $100 from also subtracting the category budget's
    // "spent" figure a second time.
    assert.equal(before - after, 5000);
  });

  test('the same holds when the expense pushes the category budget over its limit', () => {
    const { store } = reload(createMockStorage());
    store.dispatch(setCurrentBalanceAction(100000));
    store.dispatch(createCategoryBudgetAction({ category: 'Groceries', limitCents: 1000 }, { now: NOW })); // tiny $10 budget

    const before = getSafeToSpend(store.getState(), { now: NOW }).safeToSpendCents;
    store.dispatch(createExpenseAction({ amountCents: 5000, category: 'Groceries' }, { now: NOW })); // $50 — well over the $10 budget
    const after = getSafeToSpend(store.getState(), { now: NOW }).safeToSpendCents;

    assert.equal(before - after, 5000); // still just the one deduction, exceeded status is display-only
  });

  test('multiple expenses across multiple budgeted categories each deduct exactly once, summed correctly', () => {
    const { store } = reload(createMockStorage());
    store.dispatch(setCurrentBalanceAction(100000));
    store.dispatch(createCategoryBudgetAction({ category: 'Groceries', limitCents: 40000 }, { now: NOW }));
    store.dispatch(createCategoryBudgetAction({ category: 'Eating Out', limitCents: 15000 }, { now: NOW }));

    store.dispatch(createExpenseAction({ amountCents: 5000, category: 'Groceries' }, { now: NOW }));
    store.dispatch(createExpenseAction({ amountCents: 3000, category: 'Eating Out' }, { now: NOW }));
    store.dispatch(createExpenseAction({ amountCents: 2000, category: 'Transport' }, { now: NOW })); // unbudgeted category

    const result = getSafeToSpend(store.getState(), { now: NOW });
    // 100000 - 5000 - 3000 - 2000 = 90000, regardless of which expenses
    // happen to have a category budget defined.
    assert.equal(result.safeToSpendCents, 90000);
  });
});

describe('the underlying formula composition is unchanged by Phase 6', () => {
  test('getSafeToSpend never reads categoryBudgets at all', () => {
    // A state with category budgets that would produce a wildly different
    // result *if* they were (incorrectly) part of the arithmetic — proves
    // they're inert to the calculation regardless of their values.
    const state = {
      budget: { currentBalanceCents: 100000, savingsAllocationCents: 0 },
      incomes: [],
      bills: [],
      plannedExpenses: [],
      expenses: [],
      categoryBudgets: [{ id: 'cb1', category: 'Groceries', limitCents: 99999999 }],
    };
    assert.equal(getSafeToSpend(state, { now: NOW }).safeToSpendCents, 100000);
  });
});
