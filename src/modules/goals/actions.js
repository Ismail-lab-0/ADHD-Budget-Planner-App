// Action creators for the Goals module (savings goals — a named money
// target with an amount needed, an amount already put away, and a rough
// monthly pace). Non-deterministic values (id, timestamps) are generated
// here at dispatch time so the reducer stays pure — same convention as
// every other list-entity module (see src/modules/debts/actions.js).

import { createId } from '../../core/id.js';

/**
 * @param {{name: string, targetCents: number, savedCents: number, monthlyPaceCents?: number|null}} input
 * @param {{now?: Date}} [options]
 */
export function createGoalAction(input, { now = new Date() } = {}) {
  const timestamp = now.toISOString();
  return {
    type: 'goals/create',
    goal: {
      id: createId('g'),
      name: input?.name ?? '',
      targetCents: input?.targetCents,
      savedCents: input?.savedCents,
      monthlyPaceCents: input?.monthlyPaceCents ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };
}

export function updateGoalAction(id, changes, { now = new Date() } = {}) {
  return { type: 'goals/update', id, changes, now: now.toISOString() };
}

export function deleteGoalAction(id) {
  return { type: 'goals/delete', id };
}
