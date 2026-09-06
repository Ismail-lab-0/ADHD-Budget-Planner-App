// Cross-slice integration for Debt Tracking: the `debts/record-payment`
// action is handled specially by src/main.js's rootReducer (like
// expenses/incomes/bills) because one payment touches four things at once
// — the debt's balance, the `expenses` slice, `budget.currentBalanceCents`,
// and the `debtPayments` log. The key property (docs/SAFE-TO-SPEND.md
// §3c): a payment reduces Safe-to-Spend exactly *once*, through the
// ordinary Expense pathway — the debt's own balance is never read by the
// calculation, so there's no double count.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { rootReducer } from '../../src/main.js';
import { createEmptyState } from '../../src/core/schema.js';
import { createDebtAction, recordDebtPaymentAction } from '../../src/modules/debts/index.js';
import { createExpenseAction } from '../../src/modules/expenses/index.js';
import { getSafeToSpend } from '../../src/modules/safe-to-spend/index.js';
import { DEBT_PAYMENT_CATEGORY } from '../../src/modules/debts/index.js';

const NOW = new Date('2026-08-21T09:00:00.000Z');

function stateWithDebt() {
  let state = { ...createEmptyState(), budget: { currentBalanceCents: 500000, savingsAllocationCents: 0 } };
  state = rootReducer(state, createDebtAction({ name: 'Visa Card', originalBalanceCents: 350000, currentBalanceCents: 280000, minimumPaymentCents: 10000, dueDate: 15, interestRate: 19.99 }, { now: NOW }));
  return state;
}

describe('debts/record-payment through rootReducer', () => {
  test('reduces the debt balance, logs an Expense, and debits Current Balance — all in one transition', () => {
    const state = stateWithDebt();
    const debtId = state.debts[0].id;
    const next = rootReducer(state, recordDebtPaymentAction(debtId, { amountCents: 15000, note: 'August payment' }, { now: NOW }));

    assert.equal(next.debts[0].currentBalanceCents, 265000, 'debt balance drops by the payment');
    assert.equal(next.expenses.length, 1, 'a linked expense is created');
    assert.equal(next.expenses[0].amountCents, 15000);
    assert.equal(next.expenses[0].category, DEBT_PAYMENT_CATEGORY);
    assert.equal(next.expenses[0].description, 'Payment: Visa Card');
    assert.equal(next.expenses[0].notes, 'August payment');
    assert.equal(next.expenses[0].debtId, debtId, 'the expense back-references the debt');
    assert.equal(next.budget.currentBalanceCents, 485000, 'Current Balance is debited once, by the expense amount');
    assert.equal(next.debtPayments.length, 1, 'a DebtPayment log record is appended');
    assert.equal(next.debtPayments[0].debtId, debtId);
    assert.equal(next.debtPayments[0].expenseId, next.expenses[0].id);
  });

  test('the payment is reflected in Safe-to-Spend exactly once (no double count)', () => {
    const state = stateWithDebt();
    const before = getSafeToSpend(state, { now: NOW }).safeToSpendCents;
    const next = rootReducer(state, recordDebtPaymentAction(state.debts[0].id, { amountCents: 20000 }, { now: NOW }));
    const after = getSafeToSpend(next, { now: NOW }).safeToSpendCents;
    assert.equal(before - after, 20000, 'Safe-to-Spend drops by the payment amount, not twice that');
  });

  test('an over-payment clamps the debt at $0 but still debits the full amount actually paid', () => {
    let state = stateWithDebt();
    state = rootReducer(state, createDebtAction({ name: 'Small', originalBalanceCents: 5000, currentBalanceCents: 5000, minimumPaymentCents: 5000, dueDate: 1 }, { now: NOW }));
    const smallId = state.debts[1].id;
    const balanceBefore = state.budget.currentBalanceCents;
    const next = rootReducer(state, recordDebtPaymentAction(smallId, { amountCents: 8000 }, { now: NOW }));
    assert.equal(next.debts[1].currentBalanceCents, 0, 'debt never goes negative');
    assert.equal(balanceBefore - next.budget.currentBalanceCents, 8000, 'the full $80 that really left the account is debited');
    assert.equal(next.expenses[0].amountCents, 8000);
  });

  test('a payment against an unknown debt id is a total no-op (no expense, no balance change)', () => {
    const state = stateWithDebt();
    const next = rootReducer(state, recordDebtPaymentAction('d_nope', { amountCents: 10000 }, { now: NOW }));
    assert.equal(next, state);
  });

  test('deleting a debt leaves its already-logged payment expenses untouched (§6)', () => {
    let state = stateWithDebt();
    const debtId = state.debts[0].id;
    state = rootReducer(state, recordDebtPaymentAction(debtId, { amountCents: 10000 }, { now: NOW }));
    assert.equal(state.expenses.length, 1);
    state = rootReducer(state, { type: 'debts/delete', id: debtId });
    assert.equal(state.debts.length, 0);
    assert.equal(state.expenses.length, 1, 'the payment expense stays in history');
  });

  test('an ordinary manually-logged expense is unaffected by the debt machinery', () => {
    const state = stateWithDebt();
    const next = rootReducer(state, createExpenseAction({ amountCents: 4200, category: 'Groceries' }, { now: NOW }));
    assert.equal(next.expenses[0].debtId, undefined);
    assert.equal(next.budget.currentBalanceCents, 500000 - 4200);
  });
});
