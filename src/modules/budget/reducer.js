import { isValidAmountCents, isValidBalanceCents } from '../../core/money.js';

const FIELDS = ['currentBalanceCents', 'savingsAllocationCents'];

// currentBalanceCents may legitimately be negative (see docs/DATA-MODEL.md
// "Current Balance model") — everything else here is a protected/reserved
// magnitude and must stay non-negative.
const NEGATIVE_ALLOWED_FIELDS = new Set(['currentBalanceCents']);

export function createEmptyBudget() {
  return { currentBalanceCents: 0, savingsAllocationCents: 0 };
}

export function budgetReducer(budget = createEmptyBudget(), action) {
  switch (action.type) {
    case 'budget/set': {
      if (!FIELDS.includes(action.field)) return budget;
      const isValid = NEGATIVE_ALLOWED_FIELDS.has(action.field)
        ? isValidBalanceCents(action.amountCents)
        : isValidAmountCents(action.amountCents);
      if (!isValid) return budget;
      if (budget[action.field] === action.amountCents) return budget;
      return { ...budget, [action.field]: action.amountCents };
    }
    case 'budget/add-to-savings': {
      if (!isValidAmountCents(action.amountCents)) return budget;
      if (action.amountCents === 0) return budget; // adding nothing is a no-op, not a $0 contribution
      const current = isValidAmountCents(budget.savingsAllocationCents) ? budget.savingsAllocationCents : 0;
      return { ...budget, savingsAllocationCents: current + action.amountCents };
    }
    default:
      return budget;
  }
}
