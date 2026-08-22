// How marking a Bill paid/unpaid affects the Current Balance checkpoint.
// See docs/DATA-MODEL.md "Current Balance model" — mirrors src/modules/
// expenses/balance-effect.js and src/modules/incomes/balance-effect.js's
// pattern exactly (a pure function deciding *how much* to adjust, applied
// atomically by src/main.js's rootReducer), but for the single `bills/
// toggle` action with `field: 'paid'`. Ordinary create/update/delete and
// the `field: 'active'` toggle never touch the balance, same as before
// this existed.
//
// Why this exists: originally added to fix a real reported bug, back when
// `sumCommittedBills` (src/modules/safe-to-spend/calculation.js) excluded
// paid bills from a subtracted `upcomingBillsCents` term — without this
// effect, nothing ever actually left Current Balance when a bill was
// marked paid, so Safe-to-Spend visibly went *up* by that amount, as if
// the money had "come back." As of a later, explicit user request, bills
// no longer subtract from Safe-to-Spend at all while unpaid (see
// docs/SAFE-TO-SPEND.md §2/§7) — so this debit is no longer "canceling
// out" an earlier subtraction, it's the *only* time a bill's amount ever
// reduces Safe-to-Spend, the first and only time it counts. Un-marking a
// bill as paid (toggling back to unpaid) symmetrically refunds it,
// mirroring an Expense delete.
//
// Deliberately narrower than Expenses, same simplification already
// documented for Income: editing a bill's amount or deleting it after
// it's been marked paid does not retroactively adjust the balance. Also
// worth knowing: if a payment is *both* marked paid here *and* separately
// logged as an Expense, that's a double deduction — this app doesn't link
// the two, consistent with `docs/PRODUCT.md` §5's "not a full accounting/
// double-entry bookkeeping system" non-goal. Use one or the other for a
// given real-world payment, not both.

import { isValidAmountCents } from '../../core/money.js';

/**
 * @param {{type: string, id?: string, field?: string}} action
 * @param {Array} prevBills the `bills` slice before this action
 * @param {Array} nextBills the `bills` slice after this action
 * @returns {number} signed cents to add to currentBalanceCents (negative = paid, positive = un-marked/refunded)
 */
export function computeBillBalanceDelta(action, prevBills, nextBills) {
  if (action.type !== 'bills/toggle' || action.field !== 'paid') return 0;
  if (nextBills === prevBills) return 0; // the reducer no-op'd (unknown id) — nothing to apply

  const after = nextBills.find((bill) => bill.id === action.id);
  if (!after || !isValidAmountCents(after.amountCents)) return 0;

  return after.paid ? -after.amountCents : after.amountCents;
}
