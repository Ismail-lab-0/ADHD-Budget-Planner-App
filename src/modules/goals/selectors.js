import { isValidAmountCents } from '../../core/money.js';

export function getAllGoals(state) {
  const value = state?.goals;
  return Array.isArray(value) ? value : [];
}

/**
 * Sum of every goal's "already put away" amount — the protected/committed
 * figure Safe-to-Spend subtracts (docs/SAFE-TO-SPEND.md §3d). Skips a
 * corrupted `savedCents` rather than letting one bad value NaN-poison the
 * total (same defensive pattern as every other *TotalCents helper).
 * @param {object} state
 * @returns {number}
 */
export function getTotalGoalsSavedCents(state) {
  let totalCents = 0;
  for (const goal of getAllGoals(state)) {
    if (!goal || !isValidAmountCents(goal.savedCents)) continue;
    totalCents += goal.savedCents;
  }
  return totalCents;
}

/**
 * Progress toward a goal: `savedCents / targetCents`, clamped, plus a
 * rough "months to go" from the monthly pace when one is set.
 * @param {{targetCents: number, savedCents: number, monthlyPaceCents?: number|null}} goal
 * @returns {{savedCents: number, targetCents: number, remainingCents: number, percentSaved: number, isReached: boolean, monthsToGo: number|null}}
 */
export function getGoalProgress(goal) {
  const targetCents = isValidAmountCents(goal?.targetCents) ? goal.targetCents : 0;
  const savedCents = isValidAmountCents(goal?.savedCents) ? goal.savedCents : 0;
  const remainingCents = Math.max(0, targetCents - savedCents);
  const percentSaved = targetCents > 0 ? Math.min(100, Math.max(0, (savedCents / targetCents) * 100)) : savedCents > 0 ? 100 : 0;
  const isReached = targetCents > 0 && savedCents >= targetCents;
  const pace = isValidAmountCents(goal?.monthlyPaceCents) ? goal.monthlyPaceCents : 0;
  const monthsToGo = !isReached && pace > 0 && remainingCents > 0 ? Math.ceil(remainingCents / pace) : null;
  return { savedCents, targetCents, remainingCents, percentSaved, isReached, monthsToGo };
}
