// Action creators for the Expenses module. See
// src/modules/incomes/actions.js for the id/timestamp-in-action-creator
// convention. Only `amountCents` is required at capture — everything
// else is optional, per Phase 5's minimum-friction goal.

import { createId } from '../../core/id.js';
import { getLocalDateKey } from '../../core/date.js';

/**
 * @param {{amountCents: number, description?: string, date?: string, category?: string, notes?: string}} input
 * @param {{now?: Date}} [options]
 */
export function createExpenseAction(input, { now = new Date() } = {}) {
  const timestamp = now.toISOString();
  return {
    type: 'expenses/create',
    expense: {
      id: createId('e'),
      amountCents: input?.amountCents,
      description: input?.description || null,
      date: input?.date || getLocalDateKey(now),
      category: input?.category || null,
      notes: input?.notes || null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };
}

export function updateExpenseAction(id, changes, { now = new Date() } = {}) {
  return { type: 'expenses/update', id, changes, now: now.toISOString() };
}

export function deleteExpenseAction(id) {
  return { type: 'expenses/delete', id };
}
