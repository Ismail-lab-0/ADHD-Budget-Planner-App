// Integration tests, through the real store (src/main.js's rootReducer +
// storage adapter): confirms an expense's cross-slice effect on Current
// Balance (docs/DATA-MODEL.md "Current Balance model"), that
// getSafeToSpend reflects it immediately, and that everything survives a
// simulated reload. See Phase 5 §"Testing" — "add/edit/delete expense",
// "persistence", "Safe-to-Spend updates".

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { initAppState } from '../../src/main.js';
import { createStorageAdapter } from '../../src/core/storage.js';
import { getSafeToSpend } from '../../src/modules/safe-to-spend/index.js';
import { setCurrentBalanceAction } from '../../src/modules/budget/index.js';
import { createExpenseAction, updateExpenseAction, deleteExpenseAction } from '../../src/modules/expenses/index.js';

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

describe('logging an expense updates Current Balance and Safe-to-Spend together', () => {
  test('creating an expense decrements the balance by exactly its amount', () => {
    const { store } = reload(createMockStorage());
    store.dispatch(setCurrentBalanceAction(100000));
    store.dispatch(createExpenseAction({ amountCents: 1999 }, { now: NOW })); // $19.99 coffee run
    assert.equal(store.getState().budget.currentBalanceCents, 98001);
  });

  test('getSafeToSpend reflects the new balance immediately, with no separate step', () => {
    const { store } = reload(createMockStorage());
    store.dispatch(setCurrentBalanceAction(100000));
    const before = getSafeToSpend(store.getState(), { now: NOW }).safeToSpendCents;
    store.dispatch(createExpenseAction({ amountCents: 1999 }, { now: NOW }));
    const after = getSafeToSpend(store.getState(), { now: NOW }).safeToSpendCents;
    assert.equal(before, 100000);
    assert.equal(after, 98001);
  });

  test('editing an expense to a larger amount further reduces the balance', () => {
    const { store } = reload(createMockStorage());
    store.dispatch(setCurrentBalanceAction(100000));
    store.dispatch(createExpenseAction({ amountCents: 1000 }, { now: NOW }));
    const id = store.getState().expenses[0].id;
    store.dispatch(updateExpenseAction(id, { amountCents: 3000 }, { now: NOW }));
    assert.equal(store.getState().budget.currentBalanceCents, 97000); // 100000 - 3000
  });

  test('deleting an expense refunds its amount back to the balance', () => {
    const { store } = reload(createMockStorage());
    store.dispatch(setCurrentBalanceAction(100000));
    store.dispatch(createExpenseAction({ amountCents: 2500 }, { now: NOW }));
    const id = store.getState().expenses[0].id;
    assert.equal(store.getState().budget.currentBalanceCents, 97500);
    store.dispatch(deleteExpenseAction(id));
    assert.equal(store.getState().budget.currentBalanceCents, 100000);
  });

  test('an expense larger than the balance is allowed to take it negative — no silent clamping', () => {
    const { store } = reload(createMockStorage());
    store.dispatch(setCurrentBalanceAction(1000));
    store.dispatch(createExpenseAction({ amountCents: 5000 }, { now: NOW }));
    assert.equal(store.getState().budget.currentBalanceCents, -4000); // the balance itself is not clamped
    const sts = getSafeToSpend(store.getState(), { now: NOW });
    assert.equal(sts.safeToSpendCents, 0); // safe-to-spend floors at 0 (docs/SAFE-TO-SPEND.md §10)
    assert.equal(sts.netAfterCommittedCents, -4000); // the true negative position is still reported
  });
});

describe('expense persistence', () => {
  test('create -> refresh -> expense and its balance effect both remain', () => {
    const backing = createMockStorage();
    const first = reload(backing);
    first.store.dispatch(setCurrentBalanceAction(100000));
    first.store.dispatch(createExpenseAction({ amountCents: 1999, description: 'Coffee' }, { now: NOW }));
    first.adapter.flush();

    const second = reload(backing);
    assert.equal(second.store.getState().expenses.length, 1);
    assert.equal(second.store.getState().expenses[0].description, 'Coffee');
    assert.equal(second.store.getState().budget.currentBalanceCents, 98001);
  });

  test('edit -> refresh -> changes and the adjusted balance remain', () => {
    const backing = createMockStorage();
    const first = reload(backing);
    first.store.dispatch(setCurrentBalanceAction(100000));
    first.store.dispatch(createExpenseAction({ amountCents: 1000 }, { now: NOW }));
    const id = first.store.getState().expenses[0].id;
    first.store.dispatch(updateExpenseAction(id, { amountCents: 4000, category: 'Groceries' }, { now: NOW }));
    first.adapter.flush();

    const second = reload(backing);
    assert.equal(second.store.getState().expenses[0].amountCents, 4000);
    assert.equal(second.store.getState().expenses[0].category, 'Groceries');
    assert.equal(second.store.getState().budget.currentBalanceCents, 96000);
  });

  test('delete -> refresh -> expense remains deleted and the balance stays refunded', () => {
    const backing = createMockStorage();
    const first = reload(backing);
    first.store.dispatch(setCurrentBalanceAction(100000));
    first.store.dispatch(createExpenseAction({ amountCents: 1500 }, { now: NOW }));
    const id = first.store.getState().expenses[0].id;
    first.store.dispatch(deleteExpenseAction(id));
    first.adapter.flush();

    const second = reload(backing);
    assert.equal(second.store.getState().expenses.length, 0);
    assert.equal(second.store.getState().budget.currentBalanceCents, 100000);
  });
});
