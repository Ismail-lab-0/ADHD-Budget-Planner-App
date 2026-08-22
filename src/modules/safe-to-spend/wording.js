// Centralized product copy for Safe-to-Spend — defined once here so the
// wording rules (docs/PRODUCT.md §7 "no medical/diagnostic claims" and
// this phase's explicit financial-language requirements) aren't
// improvised ad hoc wherever the UI happens to display this number. See
// docs/SAFE-TO-SPEND.md "Language and framing".

import { formatCents } from '../../core/money.js';

// Never "you can afford this" — always framed as an estimate, since it's
// derived entirely from what the user entered, not a live bank balance.
export const SAFE_TO_SPEND_LABEL = 'Estimated safe to spend';

export const PLANNING_DISCLAIMER =
  "This is a planning estimate based on what you've entered — the app doesn't connect to or verify your bank accounts.";

/**
 * Extra context copy for the negative/zero cases, where showing the raw
 * number alone risks reading as either a data error or (if ever clamped)
 * misleading positive guidance. Neutral, non-judgmental — states what's
 * true without blaming the user. Returns null for an ordinary positive
 * result, where the number speaks for itself.
 * @param {ReturnType<typeof import('./calculation.js').getSafeToSpend>} result
 * @returns {string|null}
 */
export function getSafeToSpendMessage(result) {
  if (result.safeToSpendCents < 0) {
    const overBy = formatCents(Math.abs(result.safeToSpendCents));
    return `Your bills, planned expenses, and savings currently add up to ${overBy} more than what's available. This isn't a spending amount — it's a sign to review what's committed.`;
  }
  if (result.safeToSpendCents === 0) {
    return "Nothing is estimated as safe to spend right now — everything available is already committed.";
  }
  return null;
}
