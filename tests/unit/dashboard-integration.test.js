// Proves the dashboard's data source (getSafeToSpend) reflects real
// changes dispatched through the real store — the same pipeline the UI
// uses (src/ui/shell.js re-renders on every store change, always calling
// getSafeToSpend(store.getState()) fresh, never a cached/stale value).
// This is the testable stand-in for "the dashboard always reflects the
// underlying engine" (Phase 4 §"Testing") — DOM rendering itself stays
// manual per docs/TEST-PLAN.md §1.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { initAppState } from '../../src/main.js';
import { createStorageAdapter } from '../../src/core/storage.js';
import { getSafeToSpend } from '../../src/modules/safe-to-spend/index.js';
import { getPeriodSummary } from '../../src/modules/dashboard/index.js';
import { setCurrentBalanceAction, setSavingsAllocationAction } from '../../src/modules/budget/index.js';
import { createIncomeAction, markIncomeReceivedAction } from '../../src/modules/incomes/index.js';
import { createBillAction, toggleBillPaidAction } from '../../src/modules/bills/index.js';
import { createPlannedExpenseAction } from '../../src/modules/planned-expenses/index.js';

function createMockStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

const NOW = new Date(2026, 7, 21);

function setup() {
  const storageAdapter = createStorageAdapter({ storage: createMockStorage(), debounceMs: 0 });
  return initAppState({ storageAdapter, now: NOW });
}

describe('Safe-to-Spend reflects every budget-affecting change, live through the store', () => {
  test('changing current balance updates the result', () => {
    const { store } = setup();
    const before = getSafeToSpend(store.getState(), { now: NOW }).safeToSpendCents;
    store.dispatch(setCurrentBalanceAction(500000));
    const after = getSafeToSpend(store.getState(), { now: NOW }).safeToSpendCents;
    assert.equal(before, 0);
    assert.equal(after, 500000);
  });

  test('adding income updates the payday horizon (not the arithmetic — see docs/SAFE-TO-SPEND.md §3)', () => {
    const { store } = setup();
    assert.equal(getSafeToSpend(store.getState(), { now: NOW }).nextPaydayDate, null);
    store.dispatch(createIncomeAction({ name: 'Paycheck', amountCents: 250000, nextDate: '2026-09-01' }, { now: NOW }));
    const result = getSafeToSpend(store.getState(), { now: NOW });
    assert.equal(result.nextPaydayDate, '2026-09-01');
    assert.equal(result.daysUntilPayday, 11);
  });

  test('marking an income received credits Current Balance (and so, Safe-to-Spend) automatically — docs/DATA-MODEL.md "Current Balance model"', () => {
    const { store } = setup();
    store.dispatch(setCurrentBalanceAction(50000));
    store.dispatch(createIncomeAction({ name: 'Freelance', amountCents: 20000, frequency: 'one-time', nextDate: '2026-08-21' }, { now: NOW }));
    const income = store.getState().incomes[0];

    assert.equal(getSafeToSpend(store.getState(), { now: NOW }).safeToSpendCents, 50000); // not yet received — no effect

    store.dispatch(markIncomeReceivedAction(income.id, { now: NOW }));
    const state = store.getState();
    assert.equal(state.budget.currentBalanceCents, 70000);
    assert.equal(state.incomes[0].received, true);
    assert.equal(getSafeToSpend(state, { now: NOW }).safeToSpendCents, 70000);
  });

  test('marking a recurring income received advances its schedule instead of a durable "received" flag', () => {
    const { store } = setup();
    store.dispatch(setCurrentBalanceAction(0));
    store.dispatch(createIncomeAction({ name: 'Paycheck', amountCents: 250000, frequency: 'weekly', nextDate: '2026-08-21' }, { now: NOW }));
    const income = store.getState().incomes[0];

    store.dispatch(markIncomeReceivedAction(income.id, { now: NOW }));
    const state = store.getState();
    assert.equal(state.budget.currentBalanceCents, 250000);
    assert.equal(state.incomes[0].nextDate, '2026-08-28');
  });

  test('marking an income received also logs a real IncomeReceipt — the history "All time" sums (docs/DATA-MODEL.md "IncomeReceipt")', () => {
    const { store } = setup();
    store.dispatch(createIncomeAction({ name: 'Paycheck', amountCents: 250000, frequency: 'weekly', nextDate: '2026-08-21' }, { now: NOW }));
    const income = store.getState().incomes[0];

    store.dispatch(markIncomeReceivedAction(income.id, { now: NOW }));
    let state = store.getState();
    assert.equal(state.incomeReceipts.length, 1);
    assert.equal(state.incomeReceipts[0].name, 'Paycheck');
    assert.equal(state.incomeReceipts[0].amountCents, 250000);
    assert.equal(state.incomeReceipts[0].date, '2026-08-21');

    // Confirming it again (next cycle) appends a second receipt rather than replacing the first.
    const rolledForward = store.getState().incomes[0];
    const later = new Date(2026, 7, 28);
    store.dispatch(markIncomeReceivedAction(rolledForward.id, { now: later }));
    state = store.getState();
    assert.equal(state.incomeReceipts.length, 2);
    assert.equal(state.incomeReceipts[1].date, '2026-08-28');

    // "All time" Money In now sums real receipts, not a schedule projection.
    const summary = getPeriodSummary(state, { startDateKey: null, endDateKey: null, now: later });
    assert.equal(summary.moneyInCents, 500000);
  });

  test('adding a bill does NOT reduce Safe-to-Spend — bills only count once marked paid (docs/SAFE-TO-SPEND.md §2/§6)', () => {
    const { store } = setup();
    store.dispatch(setCurrentBalanceAction(100000));
    store.dispatch(createBillAction({ name: 'Rent', amountCents: 60000 }, { now: NOW }));
    assert.equal(getSafeToSpend(store.getState(), { now: NOW }).safeToSpendCents, 100000);
  });

  test('marking a bill paid reduces Safe-to-Spend by exactly its amount — the first time it counts at all (regression test for a real reported request: bills should never subtract until "Mark paid" is clicked)', () => {
    const { store } = setup();
    store.dispatch(setCurrentBalanceAction(100000));
    store.dispatch(createBillAction({ name: 'Rent', amountCents: 60000 }, { now: NOW }));
    const before = getSafeToSpend(store.getState(), { now: NOW }).safeToSpendCents;
    assert.equal(before, 100000); // unpaid — no effect yet

    const bill = store.getState().bills[0];
    store.dispatch(toggleBillPaidAction(bill.id, { now: NOW }));

    const state = store.getState();
    assert.equal(state.budget.currentBalanceCents, 40000); // the balance absorbed the payment
    assert.equal(state.bills[0].paid, true);
    assert.equal(getSafeToSpend(state, { now: NOW }).safeToSpendCents, 40000); // reduced by exactly the bill amount
  });

  test('un-marking a paid bill refunds the balance — and since an unpaid bill is never subtracted, Safe-to-Spend goes right back to the original balance', () => {
    const { store } = setup();
    store.dispatch(setCurrentBalanceAction(100000));
    store.dispatch(createBillAction({ name: 'Rent', amountCents: 60000 }, { now: NOW }));
    const bill = store.getState().bills[0];
    store.dispatch(toggleBillPaidAction(bill.id, { now: NOW })); // mark paid
    store.dispatch(toggleBillPaidAction(bill.id, { now: NOW })); // mark unpaid again

    const state = store.getState();
    assert.equal(state.budget.currentBalanceCents, 100000); // refunded back to the original balance
    assert.equal(state.bills[0].paid, false);
    assert.equal(getSafeToSpend(state, { now: NOW }).safeToSpendCents, 100000); // back to unaffected — unpaid bills aren't subtracted
  });

  test('marking a bill paid also logs a real BillPayment — the history "Money out" sums (docs/DATA-MODEL.md "BillPayment") — and un-marking it removes that same entry', () => {
    const { store } = setup();
    store.dispatch(createBillAction({ name: 'Rent', amountCents: 60000 }, { now: NOW }));
    const bill = store.getState().bills[0];

    store.dispatch(toggleBillPaidAction(bill.id, { now: NOW }));
    let state = store.getState();
    assert.equal(state.billPayments.length, 1);
    assert.equal(state.billPayments[0].name, 'Rent');
    assert.equal(state.billPayments[0].amountCents, 60000);
    assert.equal(state.billPayments[0].date, '2026-08-21');

    // "Money out" for a period covering today now includes it.
    let summary = getPeriodSummary(state, { startDateKey: '2026-08-01', endDateKey: '2026-08-31', now: NOW });
    assert.equal(summary.moneyOutCents, 60000);

    // Un-marking removes the log entry, and it drops back out of "Money out."
    store.dispatch(toggleBillPaidAction(bill.id, { now: NOW }));
    state = store.getState();
    assert.equal(state.billPayments.length, 0);
    summary = getPeriodSummary(state, { startDateKey: '2026-08-01', endDateKey: '2026-08-31', now: NOW });
    assert.equal(summary.moneyOutCents, 0);
  });

  test('a bill merely due in a period, never marked paid, does not count toward "Money out" — only billsDueCount reflects it', () => {
    const { store } = setup();
    store.dispatch(createBillAction({ name: 'Internet', amountCents: 6000, dueDate: '2026-08-15' }, { now: NOW }));

    const summary = getPeriodSummary(store.getState(), { startDateKey: '2026-08-01', endDateKey: '2026-08-31', now: NOW });
    assert.equal(summary.moneyOutCents, 0);
    assert.equal(summary.billsDueCount, 1);
  });

  test('adding a planned expense reduces the result', () => {
    const { store } = setup();
    store.dispatch(setCurrentBalanceAction(100000));
    store.dispatch(createPlannedExpenseAction({ name: 'Car repair', amountCents: 25000 }, { now: NOW }));
    assert.equal(getSafeToSpend(store.getState(), { now: NOW }).safeToSpendCents, 75000);
  });

  test('changing savings allocation reduces the result', () => {
    const { store } = setup();
    store.dispatch(setCurrentBalanceAction(100000));
    store.dispatch(setSavingsAllocationAction(20000));
    assert.equal(getSafeToSpend(store.getState(), { now: NOW }).safeToSpendCents, 80000);
  });

  test('every area combined produces the correctly composed result, matching a hand-built calculation from the same state', () => {
    const { store } = setup();
    store.dispatch(setCurrentBalanceAction(300000));
    store.dispatch(setSavingsAllocationAction(20000));
    store.dispatch(createIncomeAction({ name: 'Paycheck', amountCents: 250000, nextDate: '2026-09-01' }, { now: NOW }));
    store.dispatch(createBillAction({ name: 'Rent', amountCents: 120000, dueDate: '2026-08-25' }, { now: NOW }));
    store.dispatch(createPlannedExpenseAction({ name: 'Car repair', amountCents: 30000, plannedDate: '2026-08-28' }, { now: NOW }));

    const state = store.getState();
    const result = getSafeToSpend(state, { now: NOW });

    // Cross-check against a calculation built directly from the same
    // state's raw fields, independent of the engine's internal helpers —
    // if the UI ever started duplicating this arithmetic, a divergence
    // here would be the signal. The bill is deliberately excluded from
    // `expected` — unpaid bills no longer subtract (docs/SAFE-TO-SPEND.md
    // §2/§6).
    const expected = state.budget.currentBalanceCents - (30000 + 20000);
    assert.equal(result.safeToSpendCents, expected);
    assert.equal(result.safeToSpendCents, 250000);
  });
});
