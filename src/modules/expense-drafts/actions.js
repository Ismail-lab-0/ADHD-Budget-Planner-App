// Action creators for the Expense Drafts module — the data behind "Brain
// dump" quick capture (docs/DATA-MODEL.md "ExpenseDraft"). See
// src/modules/incomes/actions.js for the id/timestamp-in-action-creator
// convention this follows. Deliberately no update action: a draft is
// never edited in place, only created (capture) and deleted (dismissed,
// or removed once converted into a real Expense — see
// src/ui/components/inbox-section.js).

import { createId } from '../../core/id.js';

/**
 * @param {{text: string}} input the raw captured note; becomes the
 *   Expense's description if this draft is later converted
 * @param {{now?: Date}} [options]
 */
export function createExpenseDraftAction(input, { now = new Date() } = {}) {
  return {
    type: 'expenseDrafts/create',
    expenseDraft: {
      id: createId('ed'),
      text: input?.text ?? '',
      createdAt: now.toISOString(),
    },
  };
}

export function deleteExpenseDraftAction(id) {
  return { type: 'expenseDrafts/delete', id };
}
