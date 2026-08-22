// How logging/editing/deleting an Expense affects the Current Balance
// checkpoint. See docs/DATA-MODEL.md "Current Balance model" for the full
// reasoning: the balance is a checkpoint the user can correct at any
// time, automatically adjusted by expense transactions in between.
//
// This file only decides *how much* the balance should change — it
// returns a signed delta, never mutates state itself. src/main.js's
// rootReducer applies that delta to `budget.currentBalanceCents`
// atomically, in the same state transition as the `expenses` slice
// update (so the two never drift out of sync, and the store's
// subscribers see one consistent state, not two separate updates).

import { isValidAmountCents } from '../../core/money.js';

/**
 * @param {{type: string, id?: string}} action
 * @param {Array} prevExpenses the `expenses` slice before this action
 * @param {Array} nextExpenses the `expenses` slice after this action
 * @returns {number} signed cents to add to currentBalanceCents (negative = spent)
 */
export function computeBalanceDelta(action, prevExpenses, nextExpenses) {
  if (nextExpenses === prevExpenses) return 0; // the expenses reducer no-op'd — nothing to apply

  if (action.type === 'expenses/create') {
    // createListReducer appends; the new expense is always the last item.
    const added = nextExpenses[nextExpenses.length - 1];
    return added && isValidAmountCents(added.amountCents) ? -added.amountCents : 0;
  }

  if (action.type === 'expenses/delete') {
    const removed = prevExpenses.find((expense) => expense.id === action.id);
    // Refund what was previously deducted — but only if that figure is
    // actually a valid amount. A corrupted stored expense (bad amountCents
    // from hand-edited/pre-validation localStorage data) contributes 0
    // rather than NaN-poisoning currentBalanceCents; the reducer already
    // guarantees this can't happen for anything created/edited through the
    // app itself (src/modules/expenses/reducer.js).
    return removed && isValidAmountCents(removed.amountCents) ? removed.amountCents : 0;
  }

  if (action.type === 'expenses/update') {
    const before = prevExpenses.find((expense) => expense.id === action.id);
    const after = nextExpenses.find((expense) => expense.id === action.id);
    if (!before || !after) return 0;
    const beforeCents = isValidAmountCents(before.amountCents) ? before.amountCents : 0;
    const afterCents = isValidAmountCents(after.amountCents) ? after.amountCents : 0;
    // Spent more than before -> further deduct the increase.
    // Spent less than before -> refund the decrease.
    return beforeCents - afterCents;
  }

  return 0;
}
