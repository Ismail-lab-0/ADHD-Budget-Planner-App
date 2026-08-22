import { createListReducer } from '../../core/list-entity.js';
import { isValidAmountCents } from '../../core/money.js';

const EDITABLE_FIELDS = ['amountCents', 'description', 'date', 'category', 'notes'];

function validateNewExpense(candidate) {
  if (!candidate) return null;
  if (!isValidAmountCents(candidate.amountCents)) return null;
  return candidate;
}

function sanitizeExpenseChanges(changes = {}) {
  const sanitized = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in changes) sanitized[field] = changes[field];
  }
  if ('amountCents' in sanitized && !isValidAmountCents(sanitized.amountCents)) {
    delete sanitized.amountCents;
  }
  return sanitized;
}

// Note: this reducer only manages the `expenses` array itself. The
// consequence of an expense on Current Balance (docs/DATA-MODEL.md
// "Current Balance model") is a *cross-slice* effect computed by
// balance-effect.js and applied by src/main.js's rootReducer, which has
// visibility into both slices — this reducer deliberately doesn't know
// budget exists, keeping module boundaries clean (docs/ARCHITECTURE.md §7).
export const expensesReducer = createListReducer({
  actionPrefix: 'expenses',
  entityKey: 'expense',
  validateNew: validateNewExpense,
  sanitizeChanges: sanitizeExpenseChanges,
});
