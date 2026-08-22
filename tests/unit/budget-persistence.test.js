// Integration-level persistence tests: budget changes dispatched through
// the real store + storage adapter survive a simulated reload. See
// Phase 2 §9/§10 ("current balance persistence", "refresh persistence",
// etc. for every area) and docs/TEST-PLAN.md.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { initAppState } from '../../src/main.js';
import { createStorageAdapter } from '../../src/core/storage.js';
import { setCurrentBalanceAction, setSavingsAllocationAction } from '../../src/modules/budget/index.js';
import { createIncomeAction, updateIncomeAction, deleteIncomeAction } from '../../src/modules/incomes/index.js';
import { createBillAction, updateBillAction, deleteBillAction } from '../../src/modules/bills/index.js';
import { createPlannedExpenseAction, updatePlannedExpenseAction, deletePlannedExpenseAction } from '../../src/modules/planned-expenses/index.js';

function createMockStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

/** Simulates a page reload: a fresh initAppState reading the same backing storage. */
function reload(backing, now) {
  return initAppState({ storageAdapter: createStorageAdapter({ storage: backing, debounceMs: 0 }), now });
}

const NOW = new Date('2026-08-21T09:00:00.000Z');

describe('current balance / savings / safety buffer persistence', () => {
  test('current balance survives a refresh', () => {
    const backing = createMockStorage();
    const first = reload(backing, NOW);
    first.store.dispatch(setCurrentBalanceAction(245000));
    first.adapter.flush();

    const second = reload(backing, NOW);
    assert.equal(second.store.getState().budget.currentBalanceCents, 245000);
  });

  test('savings allocation survives a refresh', () => {
    const backing = createMockStorage();
    const first = reload(backing, NOW);
    first.store.dispatch(setSavingsAllocationAction(20000));
    first.adapter.flush();

    const second = reload(backing, NOW);
    assert.equal(second.store.getState().budget.savingsAllocationCents, 20000);
  });

});

describe('income persistence', () => {
  test('create -> refresh -> income remains', () => {
    const backing = createMockStorage();
    const first = reload(backing, NOW);
    first.store.dispatch(createIncomeAction({ name: 'Paycheck', amountCents: 250000 }, { now: NOW }));
    first.adapter.flush();

    const second = reload(backing, NOW);
    assert.equal(second.store.getState().incomes.length, 1);
    assert.equal(second.store.getState().incomes[0].name, 'Paycheck');
  });

  test('edit -> refresh -> changes remain', () => {
    const backing = createMockStorage();
    const first = reload(backing, NOW);
    first.store.dispatch(createIncomeAction({ name: 'Paycheck', amountCents: 250000 }, { now: NOW }));
    const id = first.store.getState().incomes[0].id;
    first.store.dispatch(updateIncomeAction(id, { amountCents: 300000 }, { now: NOW }));
    first.adapter.flush();

    const second = reload(backing, NOW);
    assert.equal(second.store.getState().incomes[0].amountCents, 300000);
  });

  test('delete -> refresh -> income remains deleted', () => {
    const backing = createMockStorage();
    const first = reload(backing, NOW);
    first.store.dispatch(createIncomeAction({ name: 'Paycheck', amountCents: 250000 }, { now: NOW }));
    const id = first.store.getState().incomes[0].id;
    first.store.dispatch(deleteIncomeAction(id));
    first.adapter.flush();

    const second = reload(backing, NOW);
    assert.equal(second.store.getState().incomes.length, 0);
  });
});

describe('bill persistence', () => {
  test('create -> refresh -> bill remains', () => {
    const backing = createMockStorage();
    const first = reload(backing, NOW);
    first.store.dispatch(createBillAction({ name: 'Rent', amountCents: 120000 }, { now: NOW }));
    first.adapter.flush();

    const second = reload(backing, NOW);
    assert.equal(second.store.getState().bills.length, 1);
    assert.equal(second.store.getState().bills[0].name, 'Rent');
  });

  test('edit -> refresh -> changes remain', () => {
    const backing = createMockStorage();
    const first = reload(backing, NOW);
    first.store.dispatch(createBillAction({ name: 'Rent', amountCents: 120000 }, { now: NOW }));
    const id = first.store.getState().bills[0].id;
    first.store.dispatch(updateBillAction(id, { amountCents: 130000 }, { now: NOW }));
    first.adapter.flush();

    const second = reload(backing, NOW);
    assert.equal(second.store.getState().bills[0].amountCents, 130000);
  });

  test('delete -> refresh -> bill remains deleted', () => {
    const backing = createMockStorage();
    const first = reload(backing, NOW);
    first.store.dispatch(createBillAction({ name: 'Rent', amountCents: 120000 }, { now: NOW }));
    const id = first.store.getState().bills[0].id;
    first.store.dispatch(deleteBillAction(id));
    first.adapter.flush();

    const second = reload(backing, NOW);
    assert.equal(second.store.getState().bills.length, 0);
  });
});

describe('planned expense persistence', () => {
  test('create -> refresh -> planned expense remains', () => {
    const backing = createMockStorage();
    const first = reload(backing, NOW);
    first.store.dispatch(createPlannedExpenseAction({ name: 'Car repair', amountCents: 30000 }, { now: NOW }));
    first.adapter.flush();

    const second = reload(backing, NOW);
    assert.equal(second.store.getState().plannedExpenses.length, 1);
    assert.equal(second.store.getState().plannedExpenses[0].name, 'Car repair');
  });

  test('edit -> refresh -> changes remain', () => {
    const backing = createMockStorage();
    const first = reload(backing, NOW);
    first.store.dispatch(createPlannedExpenseAction({ name: 'Car repair', amountCents: 30000 }, { now: NOW }));
    const id = first.store.getState().plannedExpenses[0].id;
    first.store.dispatch(updatePlannedExpenseAction(id, { amountCents: 50000 }, { now: NOW }));
    first.adapter.flush();

    const second = reload(backing, NOW);
    assert.equal(second.store.getState().plannedExpenses[0].amountCents, 50000);
  });

  test('delete -> refresh -> planned expense remains deleted', () => {
    const backing = createMockStorage();
    const first = reload(backing, NOW);
    first.store.dispatch(createPlannedExpenseAction({ name: 'Car repair', amountCents: 30000 }, { now: NOW }));
    const id = first.store.getState().plannedExpenses[0].id;
    first.store.dispatch(deletePlannedExpenseAction(id));
    first.adapter.flush();

    const second = reload(backing, NOW);
    assert.equal(second.store.getState().plannedExpenses.length, 0);
  });
});

describe('all budget areas together survive one refresh', () => {
  test('a full session of changes across every area round-trips correctly', () => {
    const backing = createMockStorage();
    const first = reload(backing, NOW);
    first.store.dispatch(setCurrentBalanceAction(245000));
    first.store.dispatch(setSavingsAllocationAction(20000));
    first.store.dispatch(createIncomeAction({ name: 'Paycheck', amountCents: 250000 }, { now: NOW }));
    first.store.dispatch(createBillAction({ name: 'Rent', amountCents: 120000 }, { now: NOW }));
    first.store.dispatch(createPlannedExpenseAction({ name: 'Car repair', amountCents: 30000 }, { now: NOW }));
    first.adapter.flush();

    const second = reload(backing, NOW);
    const state = second.store.getState();
    assert.equal(state.budget.currentBalanceCents, 245000);
    assert.equal(state.budget.savingsAllocationCents, 20000);
    assert.equal(state.incomes.length, 1);
    assert.equal(state.bills.length, 1);
    assert.equal(state.plannedExpenses.length, 1);
  });
});
