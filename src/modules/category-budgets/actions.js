// Action creators for the Category Budgets module (Phase 6). See
// src/modules/incomes/actions.js for the id/timestamp convention.

import { createId } from '../../core/id.js';

/**
 * @param {{category: string, limitCents: number}} input
 * @param {{now?: Date}} [options]
 */
export function createCategoryBudgetAction(input, { now = new Date() } = {}) {
  const timestamp = now.toISOString();
  return {
    type: 'categoryBudgets/create',
    categoryBudget: {
      id: createId('cb'),
      category: input?.category ?? '',
      limitCents: input?.limitCents,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };
}

export function updateCategoryBudgetAction(id, changes, { now = new Date() } = {}) {
  return { type: 'categoryBudgets/update', id, changes, now: now.toISOString() };
}

export function deleteCategoryBudgetAction(id) {
  return { type: 'categoryBudgets/delete', id };
}
