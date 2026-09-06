// How marking a Bill paid/unpaid affects the Current Balance checkpoint.
// See docs/DATA-MODEL.md "Current Balance model" — mirrors src/modules/
// expenses/balance-effect.js and src/modules/incomes/balance-effect.js's
// pattern exactly (a pure function deciding *how much* to adjust, applied
// atomically by src/main.js's rootReducer), but for the single `bills/
// toggle` action with `field: 'paid'`. Ordinary create/update/delete and
// the `field: 'active'` toggle never touch the balance, same as before
// this existed.
//
// Why this exists: an unpaid bill due on/before the payday horizon IS
// subtracted from Safe-to-Spend (`upcomingBillsCents` — docs/SAFE-TO-SPEND.md
// §2/§7). "Mark paid" removes it from that committed subtraction; this
// debit reduces the balance by the same amount at the same instant, so
// the net effect on Safe-to-Spend is ZERO — the amount just moves from
// "Bills still to land" to "already gone from the balance". Un-marking
// reverses both, also net zero. Without this debit, "Mark paid" would
// make Safe-to-Spend visibly go *up* (a real reported bug). (Whether
// unpaid bills are a committed term has flip-flopped five times — see
// docs/SAFE-TO-SPEND.md §2's history note; the current state is
// "subtracted while unpaid".)
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
