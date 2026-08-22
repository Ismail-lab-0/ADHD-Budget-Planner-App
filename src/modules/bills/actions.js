// Action creators for the Bills module. See src/modules/incomes/actions.js
// for the id/timestamp-in-action-creator convention this follows.

import { createId } from '../../core/id.js';
import { getLocalDateKey } from '../../core/date.js';

/**
 * @param {{name: string, amountCents: number, dueDate?: string, recurrence?: string}} input
 * @param {{now?: Date}} [options]
 */
export function createBillAction(input, { now = new Date() } = {}) {
  const timestamp = now.toISOString();
  return {
    type: 'bills/create',
    bill: {
      id: createId('b'),
      name: input?.name ?? '',
      amountCents: input?.amountCents,
      dueDate: input?.dueDate || getLocalDateKey(now),
      recurrence: input?.recurrence || 'one-time',
      active: true,
      paid: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };
}

export function updateBillAction(id, changes, { now = new Date() } = {}) {
  return { type: 'bills/update', id, changes, now: now.toISOString() };
}

export function deleteBillAction(id) {
  return { type: 'bills/delete', id };
}

export function toggleBillActiveAction(id, { now = new Date() } = {}) {
  return { type: 'bills/toggle', id, field: 'active', now: now.toISOString() };
}

/** Mark a bill paid/unpaid (Phase 2 §3). */
export function toggleBillPaidAction(id, { now = new Date() } = {}) {
  return { type: 'bills/toggle', id, field: 'paid', now: now.toISOString() };
}
