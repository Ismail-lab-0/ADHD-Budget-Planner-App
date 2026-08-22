// Action creators for the single-value budget figures: Current Balance,
// Savings allocation (Phase 2 §1, §5; Safety Buffer removed at the user's
// request — see docs/SAFE-TO-SPEND.md). Unlike Incomes/Bills/Planned
// Expenses these aren't lists — one value each.

export function setCurrentBalanceAction(amountCents) {
  return { type: 'budget/set', field: 'currentBalanceCents', amountCents };
}

export function setSavingsAllocationAction(amountCents) {
  return { type: 'budget/set', field: 'savingsAllocationCents', amountCents };
}

/**
 * Adds to the existing Savings allocation instead of replacing it — the
 * Savings card's own action (src/ui/screens/dashboard.js), so each
 * contribution accumulates rather than overwriting the running total.
 * `setSavingsAllocationAction` still exists for the one place that
 * legitimately wants an absolute value: onboarding's initial target
 * (src/ui/screens/onboarding.js), where there's nothing yet to add to.
 */
export function addToSavingsAction(amountCents) {
  return { type: 'budget/add-to-savings', amountCents };
}
