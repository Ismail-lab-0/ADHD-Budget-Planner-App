// Action creators for the Debts module. Non-deterministic values (id,
// timestamps) are generated here, at dispatch time, so the reducer stays
// pure. See src/modules/bills/actions.js for the same convention.

import { createId } from '../../core/id.js';
import { getLocalDateKey } from '../../core/date.js';

/**
 * @param {{name: string, originalBalanceCents: number, currentBalanceCents: number, minimumPaymentCents: number, dueDate: number, interestRate?: number|null, paymentFrequency?: string}} input
 * @param {{now?: Date}} [options]
 */
export function createDebtAction(input, { now = new Date() } = {}) {
  const timestamp = now.toISOString();
  return {
    type: 'debts/create',
    debt: {
      id: createId('d'),
      name: input?.name ?? '',
      originalBalanceCents: input?.originalBalanceCents,
      currentBalanceCents: input?.currentBalanceCents,
      minimumPaymentCents: input?.minimumPaymentCents,
      dueDate: input?.dueDate,
      interestRate: input?.interestRate ?? null,
      paymentFrequency: input?.paymentFrequency || 'monthly',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };
}

export function updateDebtAction(id, changes, { now = new Date() } = {}) {
  return { type: 'debts/update', id, changes, now: now.toISOString() };
}

export function deleteDebtAction(id) {
  return { type: 'debts/delete', id };
}

/**
 * Records a payment against a debt: reduces its `currentBalanceCents`
 * (clamped at 0 — see reducer.js), logs a linked `Expense` so the money
 * is reflected in the expense history and Current Balance / Safe-to-Spend
 * exactly once (src/modules/debts/payment-effect.js, docs/DATA-MODEL.md
 * §3a / SAFE-TO-SPEND.md §3c), and appends a `DebtPayment` record. All in
 * one atomic state transition, applied by src/main.js's rootReducer.
 * @param {string} debtId
 * @param {{amountCents: number, date?: string, note?: string|null}} input
 * @param {{now?: Date}} [options]
 */
export function recordDebtPaymentAction(debtId, input, { now = new Date() } = {}) {
  return {
    type: 'debts/record-payment',
    debtId,
    amountCents: input?.amountCents,
    date: input?.date || getLocalDateKey(now),
    note: input?.note?.trim() || null,
    now: now.toISOString(),
  };
}
