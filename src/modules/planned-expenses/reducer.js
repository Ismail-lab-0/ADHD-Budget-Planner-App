import { createListReducer } from '../../core/list-entity.js';
import { isValidAmountCents } from '../../core/money.js';

const PLANNED_EXPENSE_EDITABLE_FIELDS = ['name', 'amountCents', 'plannedDate', 'category', 'notes'];

function validateNewPlannedExpense(candidate) {
  if (!candidate) return null;
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  if (!name || !isValidAmountCents(candidate.amountCents)) return null;
  return { ...candidate, name };
}

function sanitizePlannedExpenseChanges(changes = {}) {
  const sanitized = {};
  for (const field of PLANNED_EXPENSE_EDITABLE_FIELDS) {
    if (field in changes) sanitized[field] = changes[field];
  }
  if ('name' in sanitized) {
    const trimmed = typeof sanitized.name === 'string' ? sanitized.name.trim() : '';
    if (trimmed) sanitized.name = trimmed;
    else delete sanitized.name;
  }
  if ('amountCents' in sanitized && !isValidAmountCents(sanitized.amountCents)) {
    delete sanitized.amountCents;
  }
  return sanitized;
}

export const plannedExpensesReducer = createListReducer({
  actionPrefix: 'plannedExpenses',
  entityKey: 'plannedExpense',
  validateNew: validateNewPlannedExpense,
  sanitizeChanges: sanitizePlannedExpenseChanges,
});
