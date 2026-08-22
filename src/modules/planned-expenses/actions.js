// Action creators for the Planned Expenses module. See
// src/modules/incomes/actions.js for the id/timestamp convention.

import { createId } from '../../core/id.js';

/**
 * @param {{name: string, amountCents: number, plannedDate?: string, category?: string, notes?: string}} input
 * @param {{now?: Date}} [options]
 */
export function createPlannedExpenseAction(input, { now = new Date() } = {}) {
  const timestamp = now.toISOString();
  return {
    type: 'plannedExpenses/create',
    plannedExpense: {
      id: createId('pe'),
      name: input?.name ?? '',
      amountCents: input?.amountCents,
      plannedDate: input?.plannedDate || null,
      category: input?.category || null,
      notes: input?.notes || null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };
}

export function updatePlannedExpenseAction(id, changes, { now = new Date() } = {}) {
  return { type: 'plannedExpenses/update', id, changes, now: now.toISOString() };
}

export function deletePlannedExpenseAction(id) {
  return { type: 'plannedExpenses/delete', id };
}
