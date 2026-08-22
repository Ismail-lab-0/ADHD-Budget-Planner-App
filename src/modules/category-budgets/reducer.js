import { createListReducer } from '../../core/list-entity.js';
import { isValidAmountCents } from '../../core/money.js';

const CATEGORY_BUDGET_EDITABLE_FIELDS = ['category', 'limitCents'];

function validateNewCategoryBudget(candidate) {
  if (!candidate) return null;
  const category = typeof candidate.category === 'string' ? candidate.category.trim() : '';
  if (!category || !isValidAmountCents(candidate.limitCents)) return null;
  return { ...candidate, category };
}

function sanitizeCategoryBudgetChanges(changes = {}) {
  const sanitized = {};
  for (const field of CATEGORY_BUDGET_EDITABLE_FIELDS) {
    if (field in changes) sanitized[field] = changes[field];
  }
  if ('category' in sanitized) {
    const trimmed = typeof sanitized.category === 'string' ? sanitized.category.trim() : '';
    if (trimmed) sanitized.category = trimmed;
    else delete sanitized.category;
  }
  if ('limitCents' in sanitized && !isValidAmountCents(sanitized.limitCents)) {
    delete sanitized.limitCents;
  }
  return sanitized;
}

// Note: this reducer doesn't enforce one-budget-per-category — creating a
// second budget for the same category is allowed; each record is tracked
// and displayed independently (both would report the same "spent this
// month" figure, computed fresh from Expenses each time — see
// getCategoryBudgetProgress). The add form steers users toward picking an
// unbudgeted category without a hard block, keeping this reducer simple
// (Phase 6 is deliberately "lightweight").
export const categoryBudgetsReducer = createListReducer({
  actionPrefix: 'categoryBudgets',
  entityKey: 'categoryBudget',
  validateNew: validateNewCategoryBudget,
  sanitizeChanges: sanitizeCategoryBudgetChanges,
});
