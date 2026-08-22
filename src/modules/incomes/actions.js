// Action creators for the Incomes module. Non-deterministic values (id,
// timestamps) are generated here, at dispatch time, so the reducer stays
// pure. See docs/ARCHITECTURE.md §4.

import { createId } from '../../core/id.js';
import { getLocalDateKey } from '../../core/date.js';

/**
 * @param {{name: string, amountCents: number, frequency?: string, nextDate?: string}} input
 * @param {{now?: Date}} [options]
 */
export function createIncomeAction(input, { now = new Date() } = {}) {
  const timestamp = now.toISOString();
  return {
    type: 'incomes/create',
    income: {
      id: createId('inc'),
      name: input?.name ?? '',
      amountCents: input?.amountCents,
      frequency: input?.frequency || 'one-time',
      nextDate: input?.nextDate || getLocalDateKey(now),
      active: true,
      received: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };
}

export function updateIncomeAction(id, changes, { now = new Date() } = {}) {
  return { type: 'incomes/update', id, changes, now: now.toISOString() };
}

export function deleteIncomeAction(id) {
  return { type: 'incomes/delete', id };
}

/** Activate/deactivate recurring income without deleting it (Phase 2 §2). */
export function toggleIncomeActiveAction(id, { now = new Date() } = {}) {
  return { type: 'incomes/toggle', id, field: 'active', now: now.toISOString() };
}

/**
 * Confirms an income actually arrived — the moment it credits Current
 * Balance (see docs/DATA-MODEL.md "Current Balance model"). A one-time
 * income is marked `received: true` (a durable, terminal state — there's
 * no next occurrence). A recurring income instead advances `nextDate` to
 * its next cycle, becoming "upcoming" again rather than staying
 * permanently marked — see src/modules/incomes/reducer.js.
 */
export function markIncomeReceivedAction(id, { now = new Date() } = {}) {
  return { type: 'incomes/mark-received', id, now: now.toISOString() };
}
