import { createListReducer } from '../../core/list-entity.js';
import { isValidAmountCents } from '../../core/money.js';

export const BILL_RECURRENCES = ['one-time', 'weekly', 'monthly'];
const BILL_EDITABLE_FIELDS = ['name', 'amountCents', 'dueDate', 'recurrence'];

function validateNewBill(candidate) {
  if (!candidate) return null;
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  if (!name || !isValidAmountCents(candidate.amountCents)) return null;
  const recurrence = BILL_RECURRENCES.includes(candidate.recurrence) ? candidate.recurrence : 'one-time';
  return { ...candidate, name, recurrence };
}

function sanitizeBillChanges(changes = {}) {
  const sanitized = {};
  for (const field of BILL_EDITABLE_FIELDS) {
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
  if ('recurrence' in sanitized && !BILL_RECURRENCES.includes(sanitized.recurrence)) {
    delete sanitized.recurrence;
  }
  return sanitized;
}

export const billsReducer = createListReducer({
  actionPrefix: 'bills',
  entityKey: 'bill',
  validateNew: validateNewBill,
  sanitizeChanges: sanitizeBillChanges,
});
