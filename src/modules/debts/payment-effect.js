// How recording a Debt payment touches the other slices. Mirrors
// src/modules/bill-payments/create-payment.js + src/modules/incomes/
// balance-effect.js: pure functions that decide *what records to create*,
// never mutating state — src/main.js's rootReducer (the one place with
// full-state visibility) applies them atomically alongside the debt's own
// balance decrement (src/modules/debts/reducer.js).
//
// A debt payment deliberately reuses the ordinary Expense pathway rather
// than inventing a parallel "debt spending" concept: the linked Expense
// is what debits Current Balance (docs/DATA-MODEL.md §3a), so it flows
// into Safe-to-Spend the exact same way any other logged spend does —
// counted once, never twice (docs/SAFE-TO-SPEND.md §3c). The `Debt`
// record's own `currentBalanceCents` is informational only, never read by
// the Safe-to-Spend calculation.

import { createId } from '../../core/id.js';
import { isValidAmountCents } from '../../core/money.js';

/** The category every debt-payment Expense is filed under (free text, like every Expense category). */
export const DEBT_PAYMENT_CATEGORY = 'Debt Payment';

/**
 * The `Expense` a debt payment logs. Shape matches
 * src/modules/expenses/actions.js's `createExpenseAction` output exactly
 * (so every existing Expense selector/edit/delete path treats it
 * identically), plus a `debtId` back-reference for reporting.
 * @param {{id: string, name: string}|undefined} debt
 * @param {{amountCents: number, date: string, note: string|null, now: string}} action the `debts/record-payment` action
 * @returns {object|null} null if there's nothing valid to record
 */
export function buildDebtPaymentExpense(debt, action) {
  if (!debt || !isValidAmountCents(action.amountCents) || action.amountCents === 0) return null;
  const description = `Payment: ${debt.name}`;
  return {
    id: createId('e'),
    amountCents: action.amountCents,
    description,
    date: action.date,
    category: DEBT_PAYMENT_CATEGORY,
    notes: action.note || null,
    debtId: debt.id,
    createdAt: action.now,
    updatedAt: action.now,
  };
}

/**
 * The `DebtPayment` log record (docs/DATA-MODEL.md "DebtPayment") — the
 * Debt-side counterpart to `BillPayment`/`IncomeReceipt`. Denormalizes
 * `name` so it still reads correctly if the Debt is later renamed or
 * deleted. Links to the Expense it created so the two can be reconciled.
 * @param {{id: string, name: string}|undefined} debt
 * @param {{amountCents: number, date: string, now: string}} action
 * @param {string|null} expenseId the id of the Expense built by buildDebtPaymentExpense
 * @returns {object|null}
 */
export function buildDebtPaymentRecord(debt, action, expenseId) {
  if (!debt || !isValidAmountCents(action.amountCents) || action.amountCents === 0) return null;
  return {
    id: createId('dp'),
    debtId: debt.id,
    name: debt.name,
    amountCents: action.amountCents,
    date: action.date,
    expenseId: expenseId ?? null,
    createdAt: action.now,
  };
}
