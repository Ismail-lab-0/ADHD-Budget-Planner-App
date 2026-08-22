// Phase 8 — Full Testing and Validation: the six complete user flows named
// in the phase spec, each exercised end-to-end through the real store +
// storage adapter (the same pipeline the UI uses — src/ui/shell.js always
// calls getSafeToSpend(store.getState()) fresh after every dispatch, never
// a cached value). Individual pieces of this arithmetic are already
// covered in isolation elsewhere (safe-to-spend.test.js,
// dashboard-integration.test.js, budget-persistence.test.js); this file's
// job is to prove the *complete, ordered* flows a real user follows,
// exactly as specced, in one place — the artifact docs/QA-REPORT.md points
// back to.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { initAppState } from '../../src/main.js';
import { createStorageAdapter } from '../../src/core/storage.js';
import { getSafeToSpend } from '../../src/modules/safe-to-spend/index.js';
import { setCurrentBalanceAction } from '../../src/modules/budget/index.js';
import { createIncomeAction } from '../../src/modules/incomes/index.js';
import { createBillAction, updateBillAction } from '../../src/modules/bills/index.js';
import { createExpenseAction, deleteExpenseAction } from '../../src/modules/expenses/index.js';

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

const NOW = new Date(2026, 7, 21); // Friday, August 21, 2026 — fixed, never the real date

describe('FLOW A: open app -> enter balance -> add payday -> add bills -> view Safe-to-Spend', () => {
  test('a first-time user\'s full setup produces a correct, non-throwing Safe-to-Spend result', () => {
    const backing = createMockStorage();
    const { store } = reload(backing, NOW);

    // Open app: fresh install starts at exactly zero, no crash on an empty state.
    let result = getSafeToSpend(store.getState(), { now: NOW });
    assert.equal(result.safeToSpendCents, 0);
    assert.equal(result.nextPaydayDate, null);

    // Enter balance.
    store.dispatch(setCurrentBalanceAction(150000)); // $1,500.00
    // Add payday.
    store.dispatch(createIncomeAction({ name: 'Paycheck', amountCents: 220000, nextDate: '2026-09-01', frequency: 'monthly' }, { now: NOW }));
    // Add bills.
    store.dispatch(createBillAction({ name: 'Rent', amountCents: 90000, dueDate: '2026-08-25' }, { now: NOW }));
    store.dispatch(createBillAction({ name: 'Phone', amountCents: 6000, dueDate: '2026-08-28' }, { now: NOW }));

    // View Safe-to-Spend. Unpaid bills are display-only as of the "bills
    // only reduce Safe-to-Spend once marked paid" change (docs/
    // SAFE-TO-SPEND.md §2/§6) — they set upcomingBillsCents but don't
    // touch the arithmetic.
    result = getSafeToSpend(store.getState(), { now: NOW });
    assert.equal(result.nextPaydayDate, '2026-09-01');
    assert.equal(result.daysUntilPayday, 11);
    assert.equal(result.upcomingBillsCents, 96000); // both bills fall before payday
    assert.equal(result.safeToSpendCents, 150000);
    assert.equal(result.dailyAllowanceCents, Math.round(150000 / 11));
    assert.equal(result.isNegative, false);
  });
});

describe('FLOW B: add expense -> save -> Safe-to-Spend updates', () => {
  test('logging an expense both decrements Current Balance and reduces Safe-to-Spend by the same amount', () => {
    const backing = createMockStorage();
    const { store } = reload(backing, NOW);
    store.dispatch(setCurrentBalanceAction(100000));

    const before = getSafeToSpend(store.getState(), { now: NOW }).safeToSpendCents;
    assert.equal(before, 100000);

    store.dispatch(createExpenseAction({ amountCents: 4500, category: 'Groceries', date: '2026-08-21' }, { now: NOW }));

    const state = store.getState();
    assert.equal(state.expenses.length, 1);
    assert.equal(state.budget.currentBalanceCents, 95500); // balance auto-decremented

    const after = getSafeToSpend(state, { now: NOW }).safeToSpendCents;
    assert.equal(after, 95500);
    assert.equal(before - after, 4500);
  });
});

describe('FLOW C: add bill -> Safe-to-Spend updates', () => {
  test('adding a bill does NOT reduce Safe-to-Spend — it only counts once marked paid (docs/SAFE-TO-SPEND.md §2/§6)', () => {
    const backing = createMockStorage();
    const { store } = reload(backing, NOW);
    store.dispatch(setCurrentBalanceAction(100000));

    const before = getSafeToSpend(store.getState(), { now: NOW }).safeToSpendCents;
    store.dispatch(createBillAction({ name: 'Internet', amountCents: 7000, dueDate: '2026-08-30' }, { now: NOW }));
    const after = getSafeToSpend(store.getState(), { now: NOW }).safeToSpendCents;

    assert.equal(before, 100000);
    assert.equal(after, 100000);
  });
});

describe('FLOW D: edit bill -> Safe-to-Spend updates', () => {
  test('editing an unpaid bill\'s amount has no effect on Safe-to-Spend either — it\'s still excluded until paid', () => {
    const backing = createMockStorage();
    const { store } = reload(backing, NOW);
    store.dispatch(setCurrentBalanceAction(100000));
    store.dispatch(createBillAction({ name: 'Internet', amountCents: 7000, dueDate: '2026-08-30' }, { now: NOW }));

    const afterCreate = getSafeToSpend(store.getState(), { now: NOW }).safeToSpendCents;
    assert.equal(afterCreate, 100000);

    const id = store.getState().bills[0].id;
    store.dispatch(updateBillAction(id, { amountCents: 9000 }, { now: NOW }));

    const afterEdit = getSafeToSpend(store.getState(), { now: NOW }).safeToSpendCents;
    assert.equal(afterEdit, 100000);
    assert.equal(afterCreate, afterEdit); // unchanged — still an unpaid bill either way
  });

  test('editing a bill\'s due date past the payday horizon removes it from the result, without a stale double-count', () => {
    const backing = createMockStorage();
    const { store } = reload(backing, NOW);
    store.dispatch(setCurrentBalanceAction(100000));
    store.dispatch(createIncomeAction({ name: 'Paycheck', amountCents: 200000, nextDate: '2026-08-25', frequency: 'monthly' }, { now: NOW }));
    store.dispatch(createBillAction({ name: 'Subscription', amountCents: 1500, dueDate: '2026-08-24' }, { now: NOW }));

    assert.equal(getSafeToSpend(store.getState(), { now: NOW }).upcomingBillsCents, 1500);

    const id = store.getState().bills[0].id;
    store.dispatch(updateBillAction(id, { dueDate: '2026-09-15' }, { now: NOW })); // now after the 8/25 payday

    assert.equal(getSafeToSpend(store.getState(), { now: NOW }).upcomingBillsCents, 0);
  });
});

describe('FLOW E: delete expense -> Safe-to-Spend updates', () => {
  test('deleting a logged expense refunds the balance and Safe-to-Spend by exactly its amount', () => {
    const backing = createMockStorage();
    const { store } = reload(backing, NOW);
    store.dispatch(setCurrentBalanceAction(100000));
    store.dispatch(createExpenseAction({ amountCents: 3000, category: 'Fun', date: '2026-08-21' }, { now: NOW }));

    const afterCreate = getSafeToSpend(store.getState(), { now: NOW }).safeToSpendCents;
    assert.equal(afterCreate, 97000);

    const id = store.getState().expenses[0].id;
    store.dispatch(deleteExpenseAction(id));

    const state = store.getState();
    assert.equal(state.expenses.length, 0);
    assert.equal(state.budget.currentBalanceCents, 100000); // fully refunded, back to the original balance
    assert.equal(getSafeToSpend(state, { now: NOW }).safeToSpendCents, 100000);
  });
});

describe('FLOW F: refresh browser -> all data remains', () => {
  test('every module\'s data survives a simulated reload, together, in one session', () => {
    const backing = createMockStorage();
    const first = reload(backing, NOW);
    first.store.dispatch(setCurrentBalanceAction(150000));
    first.store.dispatch(createIncomeAction({ name: 'Paycheck', amountCents: 220000, nextDate: '2026-09-01' }, { now: NOW }));
    first.store.dispatch(createBillAction({ name: 'Rent', amountCents: 90000, dueDate: '2026-08-25' }, { now: NOW }));
    first.store.dispatch(createExpenseAction({ amountCents: 4500, category: 'Groceries', date: '2026-08-21' }, { now: NOW }));
    first.adapter.flush();

    const beforeReload = getSafeToSpend(first.store.getState(), { now: NOW });

    const second = reload(backing, NOW);
    const state = second.store.getState();

    assert.equal(state.budget.currentBalanceCents, 145500); // $1,500 - $45 expense
    assert.equal(state.incomes.length, 1);
    assert.equal(state.bills.length, 1);
    assert.equal(state.expenses.length, 1);

    const afterReload = getSafeToSpend(state, { now: NOW });
    assert.deepEqual(afterReload, beforeReload); // identical result before and after the simulated refresh
  });
});
