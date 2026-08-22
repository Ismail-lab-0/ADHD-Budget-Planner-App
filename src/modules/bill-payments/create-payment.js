// Builds the historical record created every time a Bill is marked
// paid — see docs/DATA-MODEL.md "BillPayment". Mirrors src/modules/
// income-receipts/create-receipt.js's shape exactly, the Bill-side
// counterpart of the same idea: neither is a user-facing CRUD entity (no
// create/update/delete actions of its own), both are automatic logs.
// Applied atomically alongside `bills/toggle`'s existing balance effect
// (src/modules/bills/balance-effect.js) by src/main.js's rootReducer, the
// one place with visibility into all three slices (`bills`,
// `billPayments`, `budget`) that action touches.
//
// Pure — decides *what record to create*, never mutates state itself.

import { createId } from '../../core/id.js';
import { getLocalDateKey } from '../../core/date.js';
import { isValidAmountCents } from '../../core/money.js';

/**
 * @param {{id: string, name: string, amountCents: number}|undefined} bill
 *   the bill just marked paid, read *before* the mutation (its amount/
 *   name don't change during a paid/unpaid toggle, but the pre-mutation
 *   slice is the more defensive choice — see src/main.js).
 * @param {Date} now
 * @returns {{id: string, billId: string, name: string, amountCents: number, date: string, createdAt: string}|null}
 *   `null` if there's nothing valid to record (unknown bill, or a
 *   corrupted/invalid amount — the same defensive guard every balance
 *   effect in this codebase uses).
 */
export function createBillPayment(bill, now) {
  if (!bill || !isValidAmountCents(bill.amountCents)) return null;
  return {
    id: createId('bp'),
    billId: bill.id,
    name: bill.name,
    amountCents: bill.amountCents,
    date: getLocalDateKey(now),
    createdAt: now.toISOString(),
  };
}
