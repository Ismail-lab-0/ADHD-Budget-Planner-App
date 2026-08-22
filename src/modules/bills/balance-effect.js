// How marking a Bill paid/unpaid affects the Current Balance checkpoint.
// See docs/DATA-MODEL.md "Current Balance model" — mirrors src/modules/
// expenses/balance-effect.js and src/modules/incomes/balance-effect.js's
// pattern exactly (a pure function deciding *how much* to adjust, applied
// atomically by src/main.js's rootReducer), but for the single `bills/
// toggle` action with `field: 'paid'`. Ordinary create/update/delete and
// the `field: 'active'` toggle never touch the balance, same as before
// this existed.
//
// Why this needed fixing: `sumCommittedBills` (src/modules/safe-to-spend/
// calculation.js) excludes paid bills from `upcomingBillsCents` — so the
// moment a bill is marked paid, Safe-to-Spend goes *up* by that amount,
// since less is being subtracted. Without a balance effect, nothing ever
// actually left Current Balance, so that money looked like it "came
// back" (reported as a bug — the reason this file exists). Marking paid
// now debits the balance by the bill's amount in the same state
// transition, so the two cancel out: money that was reserved (subtracted
// via `upcomingBillsCents`) becomes money that's spent (subtracted via a
// lower `currentBalanceCents` instead) — Safe-to-Spend doesn't move.
// Un-marking a bill as paid (toggling back to unpaid) symmetrically
// refunds it, mirroring an Expense delete.
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
