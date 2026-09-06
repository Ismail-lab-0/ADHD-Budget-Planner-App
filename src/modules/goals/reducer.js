// The Goals module — savings goals (a "sinking fund" per target: an
// emergency fund, a new laptop). Added ahead of docs/ROADMAP.md's phase
// order at the user's explicit request (and after confirming savings
// goals are in scope — distinct from the retired "ADHD Life Planner"
// life-goals; see docs/PRODUCT.md §4/§5).
//
// Unlike Debts and Category Budgets, a goal's "already put away" amount
// DOES reduce Safe-to-Spend — it's protected/committed money
// (docs/SAFE-TO-SPEND.md §3d). The formula reads `state.goals` directly;
// there is no cross-slice effect and creating a goal never debits Current
// Balance. NOTE: the flat Savings figure (`budget.savingsAllocationCents`)
// used to get this exact same treatment, but no longer subtracts from
// Safe-to-Spend at all — it became a separate-account reference figure
// (docs/SAFE-TO-SPEND.md §9). Goals kept the subtraction; the flat
// Savings figure did not.

import { createListReducer } from '../../core/list-entity.js';
import { isValidAmountCents } from '../../core/money.js';

const GOAL_EDITABLE_FIELDS = ['name', 'targetCents', 'savedCents', 'monthlyPaceCents'];

/** Pace is optional: null/undefined (not set) is valid; otherwise a non-negative integer-cents value. */
function isValidPace(value) {
  return value == null || isValidAmountCents(value);
}

function validateNewGoal(candidate) {
  if (!candidate) return null;
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  if (!name) return null;
  if (!isValidAmountCents(candidate.targetCents)) return null;
  if (!isValidAmountCents(candidate.savedCents)) return null;
  if (!isValidPace(candidate.monthlyPaceCents)) return null;
  const monthlyPaceCents = candidate.monthlyPaceCents == null ? null : candidate.monthlyPaceCents;
  return { ...candidate, name, monthlyPaceCents };
}

function sanitizeGoalChanges(changes = {}) {
  const sanitized = {};
  for (const field of GOAL_EDITABLE_FIELDS) {
    if (field in changes) sanitized[field] = changes[field];
  }
  if ('name' in sanitized) {
    const trimmed = typeof sanitized.name === 'string' ? sanitized.name.trim() : '';
    if (trimmed) sanitized.name = trimmed;
    else delete sanitized.name;
  }
  for (const field of ['targetCents', 'savedCents']) {
    if (field in sanitized && !isValidAmountCents(sanitized[field])) delete sanitized[field];
  }
  if ('monthlyPaceCents' in sanitized && !isValidPace(sanitized.monthlyPaceCents)) delete sanitized.monthlyPaceCents;
  return sanitized;
}

export const goalsReducer = createListReducer({
  actionPrefix: 'goals',
  entityKey: 'goal',
  validateNew: validateNewGoal,
  sanitizeChanges: sanitizeGoalChanges,
});
