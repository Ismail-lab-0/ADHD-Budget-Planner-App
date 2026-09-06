// The Safe-to-Spend module's public interface. Pure, DOM-free calculation
// — see docs/SAFE-TO-SPEND.md for the full reasoning behind the formula.
// Not wired into any UI yet (docs/ROADMAP.md Phase 4).

export { getSafeToSpend, getSpendingAllowance } from './calculation.js';
export { getNextIncomeDate, getCurrentBillDueDate, getIncomeOccurrencesInRange } from './recurrence.js';
export { SAFE_TO_SPEND_LABEL, PLANNING_DISCLAIMER, getSafeToSpendMessage, getSafeToSpendSubtext } from './wording.js';
