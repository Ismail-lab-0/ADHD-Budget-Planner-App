// The Debts module (added ahead of docs/ROADMAP.md's phase order at the
// user's explicit request, same as "Brain dump" before it). A debt is a
// balance the user is paying down over time — a credit card, a loan.
// Deliberately NOT a full debt-management tool (no avalanche/snowball/
// refinance calculators): it answers "how much do I owe, what's due, am I
// making progress?" and nothing more (see docs/PRODUCT.md §4).
//
// Debts never enter the Safe-to-Spend arithmetic directly — see
// docs/SAFE-TO-SPEND.md §3c. The only thing that moves Safe-to-Spend
// because of a debt is a *payment*, which logs a real `Expense`
// (src/modules/debts/payment-effect.js) — so the money is accounted for
// exactly once, through the same Current Balance debit any Expense
// already causes (docs/DATA-MODEL.md §3a), never twice.

import { createListReducer } from '../../core/list-entity.js';
import { isValidAmountCents } from '../../core/money.js';

export const DEBT_PAYMENT_FREQUENCIES = ['monthly', 'biweekly', 'weekly'];
const DEBT_EDITABLE_FIELDS = ['name', 'originalBalanceCents', 'currentBalanceCents', 'minimumPaymentCents', 'dueDate', 'interestRate', 'paymentFrequency'];

/** A day-of-month integer, 1..31 — see docs/DATA-MODEL.md "Debt". */
function isValidDueDate(value) {
  return Number.isInteger(value) && value >= 1 && value <= 31;
}

/** APR is optional: null/undefined (not entered) is valid; a number must be finite and >= 0. */
function isValidInterestRate(value) {
  if (value == null) return true;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function validateNewDebt(candidate) {
  if (!candidate) return null;
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  if (!name) return null;
  if (!isValidAmountCents(candidate.originalBalanceCents)) return null;
  if (!isValidAmountCents(candidate.currentBalanceCents)) return null;
  if (!isValidAmountCents(candidate.minimumPaymentCents)) return null;
  if (!isValidDueDate(candidate.dueDate)) return null;
  if (!isValidInterestRate(candidate.interestRate)) return null;
  const paymentFrequency = DEBT_PAYMENT_FREQUENCIES.includes(candidate.paymentFrequency) ? candidate.paymentFrequency : 'monthly';
  const interestRate = candidate.interestRate == null ? null : candidate.interestRate;
  return { ...candidate, name, interestRate, paymentFrequency };
}

function sanitizeDebtChanges(changes = {}) {
  const sanitized = {};
  for (const field of DEBT_EDITABLE_FIELDS) {
    if (field in changes) sanitized[field] = changes[field];
  }
  if ('name' in sanitized) {
    const trimmed = typeof sanitized.name === 'string' ? sanitized.name.trim() : '';
    if (trimmed) sanitized.name = trimmed;
    else delete sanitized.name;
  }
  for (const field of ['originalBalanceCents', 'currentBalanceCents', 'minimumPaymentCents']) {
    if (field in sanitized && !isValidAmountCents(sanitized[field])) delete sanitized[field];
  }
  if ('dueDate' in sanitized && !isValidDueDate(sanitized.dueDate)) delete sanitized.dueDate;
  if ('interestRate' in sanitized && !isValidInterestRate(sanitized.interestRate)) delete sanitized.interestRate;
  if ('paymentFrequency' in sanitized && !DEBT_PAYMENT_FREQUENCIES.includes(sanitized.paymentFrequency)) delete sanitized.paymentFrequency;
  return sanitized;
}

const baseDebtsReducer = createListReducer({
  actionPrefix: 'debts',
  entityKey: 'debt',
  validateNew: validateNewDebt,
  sanitizeChanges: sanitizeDebtChanges,
});

/**
 * Wraps the generic list reducer with one bespoke case:
 * `debts/record-payment` reduces the debt's `currentBalanceCents` by the
 * payment amount, **clamped at 0** — a debt balance can never go negative
 * (docs/DATA-MODEL.md §15 "Important Edge Cases"). The linked `Expense`
 * and the `DebtPayment` log record are a separate cross-slice effect
 * (src/modules/debts/payment-effect.js), applied atomically by
 * src/main.js's rootReducer, mirroring how confirming an Income/Bill
 * touches three slices at once.
 */
export function debtsReducer(items = [], action) {
  if (action.type === 'debts/record-payment') {
    const index = items.findIndex((item) => item.id === action.debtId);
    if (index === -1) return items;
    if (!isValidAmountCents(action.amountCents) || action.amountCents === 0) return items;
    const debt = items[index];
    const currentCents = isValidAmountCents(debt.currentBalanceCents) ? debt.currentBalanceCents : 0;
    const nextCents = Math.max(0, currentCents - action.amountCents);
    if (nextCents === currentCents) return items;
    const next = items.slice();
    next[index] = { ...debt, currentBalanceCents: nextCents, updatedAt: action.now };
    return next;
  }
  return baseDebtsReducer(items, action);
}
