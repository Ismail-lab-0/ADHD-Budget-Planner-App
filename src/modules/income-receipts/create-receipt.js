// Builds the historical record created every time an Income is confirmed
// received — see docs/DATA-MODEL.md "IncomeReceipt". This is *not* a
// user-facing CRUD entity (no create/update/delete actions of its own) —
// it's an automatic log, one record appended per `incomes/mark-received`
// dispatch, applied atomically alongside that action's existing balance
// effect (src/modules/incomes/balance-effect.js) by src/main.js's
// rootReducer, the one place with visibility into all three slices
// (`incomes`, `incomeReceipts`, `budget`) this single action touches.
//
// Pure — decides *what record to create*, never mutates state itself,
// same shape as every other *-effect.js in this codebase.

import { createId } from '../../core/id.js';
import { getLocalDateKey } from '../../core/date.js';
import { isValidAmountCents } from '../../core/money.js';

/**
 * @param {{id: string, name: string, amountCents: number}|undefined} income
 *   the confirmed income, read *before* the mark-received mutation (its
 *   amount/name don't change during that mutation, but reading pre-mutation
 *   state is the more defensive choice — see src/main.js).
 * @param {Date} now
 * @returns {{id: string, incomeId: string, name: string, amountCents: number, date: string, createdAt: string}|null}
 *   `null` if there's nothing valid to record (unknown income, or a
 *   corrupted/invalid amount — the same defensive guard every balance
 *   effect in this codebase uses, so a bad stored value can't
 *   NaN-poison a receipt).
 */
export function createIncomeReceipt(income, now) {
  if (!income || !isValidAmountCents(income.amountCents)) return null;
  return {
    id: createId('ir'),
    incomeId: income.id,
    name: income.name,
    amountCents: income.amountCents,
    date: getLocalDateKey(now),
    createdAt: now.toISOString(),
  };
}
