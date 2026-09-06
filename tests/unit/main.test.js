// Tests for the app-wiring logic exported by src/main.js: rootReducer and
// initAppState. This is the pure, DOM-free part of "application
// initialization" — see docs/TEST-PLAN.md §2 ("application initialization,
// state initialization, storage save, storage load, state persistence
// after reload"). Screen rendering (src/ui/*) is DOM-dependent and is
// covered by the manual checklists instead, per docs/TEST-PLAN.md §1.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { rootReducer, initAppState } from '../../src/main.js';
import { createStorageAdapter } from '../../src/core/storage.js';
import { createEmptyState, CURRENT_SCHEMA_VERSION } from '../../src/core/schema.js';

/** A minimal in-memory stand-in for the browser's localStorage. */
function createMockStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

describe('rootReducer', () => {
  test('returns the same state reference for an unknown action (store no-op contract)', () => {
    const state = { incomes: [] };
    assert.equal(rootReducer(state, { type: 'nothing/registered/yet' }), state);
  });

  test('meta/touch-last-opened updates meta.lastOpenedAt without touching the rest of state', () => {
    const state = { meta: { createdAt: 'x', lastOpenedAt: 'old' }, incomes: [] };
    const next = rootReducer(state, { type: 'meta/touch-last-opened', now: 'new' });
    assert.equal(next.meta.lastOpenedAt, 'new');
    assert.equal(next.meta.createdAt, 'x');
    assert.equal(next.incomes, state.incomes);
  });

  test('expenseDrafts/* routes to the generic slice reducer, untouched by any cross-slice special case (unlike expenses/incomes/bills)', () => {
    const state = { budget: { currentBalanceCents: 5000 }, expenseDrafts: [] };
    const next = rootReducer(state, { type: 'expenseDrafts/create', expenseDraft: { id: 'ed_1', text: 'Coffee with Sam', createdAt: 'x' } });
    assert.deepEqual(next.expenseDrafts, [{ id: 'ed_1', text: 'Coffee with Sam', createdAt: 'x' }]);
    // Creating a draft is not a money event — the balance is untouched.
    assert.equal(next.budget.currentBalanceCents, 5000);
  });

  test('budget/add-to-savings is a cross-slice transfer: raises savings AND debits Current Balance atomically', () => {
    const state = { budget: { currentBalanceCents: 100000, savingsAllocationCents: 5000 } };
    const next = rootReducer(state, { type: 'budget/add-to-savings', amountCents: 20000 });
    assert.equal(next.budget.savingsAllocationCents, 25000);
    assert.equal(next.budget.currentBalanceCents, 80000); // debited by the same amount
  });

  test('budget/set (correcting the Savings figure) is NOT a transfer — the balance is left alone', () => {
    const state = { budget: { currentBalanceCents: 100000, savingsAllocationCents: 5000 } };
    const next = rootReducer(state, { type: 'budget/set', field: 'savingsAllocationCents', amountCents: 25000 });
    assert.equal(next.budget.savingsAllocationCents, 25000);
    assert.equal(next.budget.currentBalanceCents, 100000); // untouched
  });

  test('a rejected budget/add-to-savings (invalid amount) is a full no-op — no partial balance debit', () => {
    const state = { budget: { currentBalanceCents: 100000, savingsAllocationCents: 5000 } };
    assert.equal(rootReducer(state, { type: 'budget/add-to-savings', amountCents: -1 }), state);
    assert.equal(rootReducer(state, { type: 'budget/add-to-savings', amountCents: 0 }), state);
  });
});

describe('initAppState', () => {
  test('application initialization: with nothing stored yet, the store starts from a fresh empty state', () => {
    const storageAdapter = createStorageAdapter({ storage: createMockStorage() });
    const { store } = initAppState({ storageAdapter, now: new Date('2026-08-21T09:00:00.000Z') });
    assert.equal(store.getState().schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.deepEqual(store.getState().incomes, []);
  });

  test('state initialization: previously persisted state loads into the store', () => {
    const backing = createMockStorage();
    createStorageAdapter({ storage: backing }).save({
      ...createEmptyState(),
      settings: { ...createEmptyState().settings, displayName: 'Alex' },
    });

    const storageAdapter = createStorageAdapter({ storage: backing });
    const { store } = initAppState({ storageAdapter, now: new Date('2026-08-21T09:00:00.000Z') });
    assert.equal(store.getState().settings.displayName, 'Alex');
  });

  test('storage save: initializing schedules a persisted write reflecting the new state', () => {
    const backing = createMockStorage();
    const storageAdapter = createStorageAdapter({ storage: backing, debounceMs: 0 });
    const { adapter } = initAppState({ storageAdapter, now: new Date('2026-08-21T09:00:00.000Z') });

    adapter.flush();

    const persisted = JSON.parse(backing.getItem('adhd-planner:v1'));
    assert.equal(persisted.meta.lastOpenedAt, '2026-08-21T09:00:00.000Z');
  });

  test('storage load: a freshly loaded adapter reads back exactly what was saved', () => {
    const backing = createMockStorage();
    const first = initAppState({
      storageAdapter: createStorageAdapter({ storage: backing, debounceMs: 0 }),
      now: new Date('2026-08-21T09:00:00.000Z'),
    });
    first.adapter.flush();

    const reloaded = createStorageAdapter({ storage: backing }).load();
    assert.equal(reloaded.meta.lastOpenedAt, '2026-08-21T09:00:00.000Z');
  });

  test('state persistence after reload: a value set in one session is present in the next', () => {
    const backing = createMockStorage();

    const first = initAppState({
      storageAdapter: createStorageAdapter({ storage: backing, debounceMs: 0 }),
      now: new Date('2026-08-21T09:00:00.000Z'),
    });
    first.adapter.flush();

    const second = initAppState({
      storageAdapter: createStorageAdapter({ storage: backing }),
      now: new Date('2026-08-21T09:05:00.000Z'),
    });

    assert.equal(second.store.getState().meta.lastOpenedAt, '2026-08-21T09:05:00.000Z');
    // And the earlier session's write really did carry forward, not just
    // the initial empty state:
    assert.equal(second.store.getState().schemaVersion, CURRENT_SCHEMA_VERSION);
  });
});
