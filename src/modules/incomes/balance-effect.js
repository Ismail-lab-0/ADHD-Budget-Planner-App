// How confirming an Income as received affects the Current Balance
// checkpoint. See docs/DATA-MODEL.md "Current Balance model" — mirrors
// src/modules/expenses/balance-effect.js's pattern exactly (a pure
// function deciding *how much* to credit, applied atomically by
// src/main.js's rootReducer), but only for the single `incomes/
// mark-received` action; ordinary create/update/delete/toggle on an
// Income never touch the balance, same as before this existed.
//
// Deliberately narrower than the Expense version: editing or deleting an
// income that was already marked received does NOT retroactively adjust
// the balance (an already-recurring income doesn't even keep a durable
// "received" marker to hang that adjustment on — see reducer.js). This
// keeps scope narrow, consistent with docs/PRODUCT.md §5's non-goal "not
// a full accounting/double-entry bookkeeping system" — the same
// simplification Bills' `paid` flag already has no balance-linkage at
// all. If this ever needs to change, it's a deliberate product decision,
// not a bug.

import { isValidAmountCents } from '../../core/money.js';

/**
 * @param {{type: string, id?: string}} action
 * @param {Array} prevIncomes the `incomes` slice before this action
 * @param {Array} nextIncomes the `incomes` slice after this action
 * @returns {number} cents to add to currentBalanceCents (always >= 0 — income only ever credits)
 */
export function computeIncomeBalanceDelta(action, prevIncomes, nextIncomes) {
  if (action.type !== 'incomes/mark-received') return 0;
  if (nextIncomes === prevIncomes) return 0; // the reducer no-op'd (already received, unknown id, etc.) — nothing to credit

  const before = prevIncomes.find((income) => income.id === action.id);
  // Corrupted stored amountCents (hand-edited/pre-validation localStorage
  // data) contributes 0 rather than NaN-poisoning currentBalanceCents —
  // same defensive pattern as expenses/balance-effect.js.
  return before && isValidAmountCents(before.amountCents) ? before.amountCents : 0;
}
