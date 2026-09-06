// Centralized product copy for Safe-to-Spend — defined once here so the
// wording rules (docs/PRODUCT.md §7 "no medical/diagnostic claims" and
// this phase's explicit financial-language requirements) aren't
// improvised ad hoc wherever the UI happens to display this number. See
// docs/SAFE-TO-SPEND.md "Language and framing".

import { formatCents } from '../../core/money.js';
import { formatShortWeekdayDate } from '../../core/date.js';

// The headline label. Reworded from "Estimated safe to spend" to
// "Safe to spend today" at the user's request when the card moved to a
// payday-based framing — the "planning estimate, not a verified bank
// figure" caveat now lives in `getSafeToSpendSubtext` and
// `PLANNING_DISCLAIMER` below rather than the label itself
// (docs/SAFE-TO-SPEND.md §12).
export const SAFE_TO_SPEND_LABEL = 'Safe to spend today';

export const PLANNING_DISCLAIMER =
  "This is a planning estimate based on what you've entered — the app doesn't connect to or verify your bank accounts.";

/**
 * The line under the amount: "$X of your $Y balance has to last until
 * Mon 31 Aug". `$Y` is the raw current balance (never the
 * savings/goals-reduced figure — the user explicitly asked that the
 * balance shown here isn't itself netted down); `$X` is `safeToSpendCents`
 * (floored at 0 — see §10). Reads figures straight off the result — no
 * arithmetic here.
 * @param {ReturnType<typeof import('./calculation.js').getSafeToSpend>} result
 * @returns {string}
 */
export function getSafeToSpendSubtext(result) {
  const spendable = formatCents(result.safeToSpendCents);
  const balance = formatCents(result.currentBalanceCents);
  const payday = formatShortWeekdayDate(result.nextPaydayDate);
  if (!payday) {
    return `${spendable} of your ${balance} balance — add an income date to see how long this needs to last`;
  }
  return `${spendable} of your ${balance} balance has to last until ${payday}`;
}

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
  // `safeToSpendCents` is floored at 0 (§10); `netAfterCommittedCents`
  // carries the true position, so the overage amount is read from that.
  if (result.netAfterCommittedCents < 0) {
    const overBy = formatCents(Math.abs(result.netAfterCommittedCents));
    return `Your upcoming bills, planned expenses, and savings goals add up to ${overBy} more than your current balance. This isn't a spending amount — it's a sign to review what's committed.`;
  }
  if (result.safeToSpendCents === 0) {
    return "Nothing is safe to spend right now — your whole balance is already committed to upcoming bills, planned expenses, and savings goals.";
  }
  return null;
}

// An ordinary positive result gets no explanatory paragraph at all — the
// number, the subtext line, and the "How is this worked out?" breakdown
// carry the meaning (removed at the user's request). `getSafeToSpendMessage`
// still returns copy for the negative / exact-zero cases.
