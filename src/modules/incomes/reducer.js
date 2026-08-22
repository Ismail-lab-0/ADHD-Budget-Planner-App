import { createListReducer } from '../../core/list-entity.js';
import { isValidAmountCents } from '../../core/money.js';
import { getLocalDateKey, parseLocalDate, advanceByFrequency } from '../../core/date.js';

export const INCOME_FREQUENCIES = ['one-time', 'weekly', 'biweekly', 'monthly'];
const INCOME_EDITABLE_FIELDS = ['name', 'amountCents', 'frequency', 'nextDate'];

function validateNewIncome(candidate) {
  if (!candidate) return null;
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  if (!name || !isValidAmountCents(candidate.amountCents)) return null;
  const frequency = INCOME_FREQUENCIES.includes(candidate.frequency) ? candidate.frequency : 'one-time';
  return { ...candidate, name, frequency };
}

function sanitizeIncomeChanges(changes = {}) {
  const sanitized = {};
  for (const field of INCOME_EDITABLE_FIELDS) {
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
  if ('frequency' in sanitized && !INCOME_FREQUENCIES.includes(sanitized.frequency)) {
    delete sanitized.frequency;
  }
  return sanitized;
}

const baseIncomesReducer = createListReducer({
  actionPrefix: 'incomes',
  entityKey: 'income',
  validateNew: validateNewIncome,
  sanitizeChanges: sanitizeIncomeChanges,
});

/**
 * Wraps the generic list reducer with one bespoke case:
 * `incomes/mark-received` isn't a plain field toggle (see
 * src/modules/incomes/actions.js `markIncomeReceivedAction`) — a one-time
 * income becomes permanently `received: true`, while a recurring income's
 * `nextDate` advances to its next cycle instead, so it never gets
 * permanently "stuck" as received. The actual Current Balance credit is a
 * separate cross-slice effect (src/modules/incomes/balance-effect.js),
 * applied atomically by src/main.js's rootReducer, mirroring how Expenses
 * affect the balance.
 */
export function incomesReducer(items = [], action) {
  if (action.type === 'incomes/mark-received') {
    const index = items.findIndex((item) => item.id === action.id);
    if (index === -1) return items;
    const income = items[index];
    const next = items.slice();
    if (income.frequency === 'one-time' || !income.frequency) {
      if (income.received) return items; // already received — no-op
      next[index] = { ...income, received: true, updatedAt: action.now };
    } else {
      if (!income.nextDate) return items; // nothing to advance from
      const advanced = advanceByFrequency(parseLocalDate(income.nextDate), income.frequency);
      next[index] = { ...income, nextDate: getLocalDateKey(advanced), updatedAt: action.now };
    }
    return next;
  }
  return baseIncomesReducer(items, action);
}
