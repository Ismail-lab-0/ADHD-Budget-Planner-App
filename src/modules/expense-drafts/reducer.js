import { createListReducer } from '../../core/list-entity.js';

function validateNewExpenseDraft(candidate) {
  if (!candidate) return null;
  const text = typeof candidate.text === 'string' ? candidate.text.trim() : '';
  if (!text) return null;
  return { ...candidate, text };
}

// Drafts are never edited in place (see actions.js) — only 'create' and
// 'delete' are ever dispatched. The list-entity factory still requires a
// sanitizeChanges function for its 'update'/'toggle' cases; returning {}
// unconditionally makes either a guaranteed no-op rather than silently
// allowing edits this module was never asked to support.
function sanitizeExpenseDraftChanges() {
  return {};
}

export const expenseDraftsReducer = createListReducer({
  actionPrefix: 'expenseDrafts',
  entityKey: 'expenseDraft',
  validateNew: validateNewExpenseDraft,
  sanitizeChanges: sanitizeExpenseDraftChanges,
});
