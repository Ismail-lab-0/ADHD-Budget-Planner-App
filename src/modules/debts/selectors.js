// Selectors for the Debts module — all pure, DOM-free, derived fresh from
// state every read (never stored), same principle as Category Budgets'
// monthly figures and Safe-to-Spend itself (docs/DATA-MODEL.md §4).
// Nothing here feeds the Safe-to-Spend arithmetic — see
// docs/SAFE-TO-SPEND.md §3c.

import { getLocalDateKey, parseLocalDate, addMonths } from '../../core/date.js';
import { isValidAmountCents } from '../../core/money.js';

export function getAllDebts(state) {
  const value = state?.debts;
  return Array.isArray(value) ? value : [];
}

export function getAllDebtPayments(state) {
  const value = state?.debtPayments;
  return Array.isArray(value) ? value : [];
}

/**
 * Total still owed across every debt — the sum of current balances.
 * Skips a corrupted `currentBalanceCents` rather than letting one bad
 * value NaN-poison the total, same defensive pattern as every other
 * `*TotalCents` selector in this codebase.
 * @param {object} state
 * @returns {number}
 */
export function getTotalDebtCents(state) {
  let totalCents = 0;
  for (const debt of getAllDebts(state)) {
    if (!debt || !isValidAmountCents(debt.currentBalanceCents)) continue;
    totalCents += debt.currentBalanceCents;
  }
  return totalCents;
}

/**
 * Payoff progress for one debt: how much has been paid down, as an amount
 * and a clamped 0–100 percentage, plus whether it's fully cleared.
 * `(originalBalance - currentBalance) / originalBalance`, clamped — see
 * docs/PRODUCT.md §14.
 * @param {{originalBalanceCents: number, currentBalanceCents: number}} debt
 * @returns {{paidCents: number, percentPaid: number, isPaidOff: boolean}}
 */
export function getDebtProgress(debt) {
  const original = isValidAmountCents(debt?.originalBalanceCents) ? debt.originalBalanceCents : 0;
  const current = isValidAmountCents(debt?.currentBalanceCents) ? debt.currentBalanceCents : 0;
  const paidCents = Math.max(0, original - current);
  const percentPaid = original > 0 ? Math.min(100, Math.max(0, (paidCents / original) * 100)) : current <= 0 ? 100 : 0;
  return { paidCents, percentPaid, isPaidOff: current <= 0 };
}

/**
 * The next calendar date this debt's payment is due, as "YYYY-MM-DD" —
 * the next occurrence of its day-of-month (`debt.dueDate`, 1–31) on or
 * after today. Clamped to the last day of a short month (e.g. a "due on
 * the 31st" debt lands on Feb 28). Debt payments are treated as
 * monthly-recurring for scheduling purposes regardless of
 * `paymentFrequency` (which only affects the payoff estimate) — a
 * deliberate simplification, see docs/DATA-MODEL.md "Debt".
 * @param {{dueDate: number}} debt
 * @param {Date} [now]
 * @returns {string|null}
 */
export function getNextDebtDueDateKey(debt, now = new Date()) {
  const day = debt?.dueDate;
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDayThisMonth = new Date(year, month + 1, 0).getDate();
  let candidate = new Date(year, month, Math.min(day, lastDayThisMonth));
  if (getLocalDateKey(candidate) < getLocalDateKey(now)) {
    const lastDayNextMonth = new Date(year, month + 2, 0).getDate();
    candidate = new Date(year, month + 1, Math.min(day, lastDayNextMonth));
  }
  return getLocalDateKey(candidate);
}

/**
 * True if a payment for this debt has already been recorded in `now`'s
 * calendar month — used to hide a debt from "Bills due soon" once it's
 * been paid for the current period (docs/PRODUCT.md §8 "Avoid
 * duplicates"). Derived from the `DebtPayment` log, same "derived, not
 * stored" approach as Category Budgets' "spent this month".
 * @param {object} state
 * @param {string} debtId
 * @param {Date} [now]
 */
export function hasDebtPaymentInMonth(state, debtId, now = new Date()) {
  const monthKey = getLocalDateKey(now).slice(0, 7);
  return getAllDebtPayments(state).some((payment) => payment?.debtId === debtId && typeof payment?.date === 'string' && payment.date.startsWith(monthKey));
}

/**
 * `DebtPayment` records whose `date` falls within `[startDateKey,
 * endDateKey]` (either bound optional) — the read-only counterpart to
 * `getBillPaymentsForPeriod`, available for a future period-scoped view.
 * Not currently wired into `getPeriodSummary` (a debt payment is already
 * a real `Expense`, so it's counted in "Money out" through that — adding
 * it here too would double-count).
 * @param {object} state
 * @param {{startDateKey?: string|null, endDateKey?: string|null}} [options]
 */
export function getDebtPaymentsForPeriod(state, { startDateKey = null, endDateKey = null } = {}) {
  return getAllDebtPayments(state).filter((payment) => {
    if (!payment?.date) return false;
    if (startDateKey && payment.date < startDateKey) return false;
    if (endDateKey && payment.date > endDateKey) return false;
    return true;
  });
}

/** `minimumPaymentCents` normalized to a per-month figure using `paymentFrequency`. */
function normalizedMonthlyPaymentCents(debt) {
  const payment = isValidAmountCents(debt?.minimumPaymentCents) ? debt.minimumPaymentCents : 0;
  if (payment === 0) return 0;
  if (debt.paymentFrequency === 'weekly') return Math.round((payment * 52) / 12);
  if (debt.paymentFrequency === 'biweekly') return Math.round((payment * 26) / 12);
  return payment;
}

/**
 * A rough payoff estimate for a debt, or `null` when one can't be made
 * responsibly (no APR entered, nothing owed, or no payment set) — see
 * docs/PRODUCT.md §9. Standard amortization:
 *   months = -ln(1 - (r·B)/P) / ln(1 + r),  r = APR/100/12
 * with a 0% APR falling back to simple division. If the payment doesn't
 * even cover one month's interest, `months` is null and
 * `coversInterest` is false, so the UI can say so calmly instead of
 * showing an impossible date.
 * @param {object} debt
 * @param {{now?: Date}} [options]
 * @returns {{months: number|null, payoffDateKey: string|null, coversInterest: boolean, monthlyPaymentCents: number}|null}
 */
export function estimatePayoff(debt, { now = new Date() } = {}) {
  const balance = isValidAmountCents(debt?.currentBalanceCents) ? debt.currentBalanceCents : 0;
  if (balance <= 0) return null;
  const monthlyPaymentCents = normalizedMonthlyPaymentCents(debt);
  if (monthlyPaymentCents <= 0) return null;
  const apr = typeof debt?.interestRate === 'number' && Number.isFinite(debt.interestRate) && debt.interestRate >= 0 ? debt.interestRate : null;
  if (apr == null) return null;

  const monthlyRate = apr / 100 / 12;
  let months;
  if (monthlyRate === 0) {
    months = Math.ceil(balance / monthlyPaymentCents);
  } else {
    const interestOnly = balance * monthlyRate;
    if (monthlyPaymentCents <= interestOnly) {
      return { months: null, payoffDateKey: null, coversInterest: false, monthlyPaymentCents };
    }
    months = Math.ceil(-Math.log(1 - (monthlyRate * balance) / monthlyPaymentCents) / Math.log(1 + monthlyRate));
  }
  if (!Number.isFinite(months) || months <= 0 || months > 1200) {
    return { months: null, payoffDateKey: null, coversInterest: false, monthlyPaymentCents };
  }
  return { months, payoffDateKey: getLocalDateKey(addMonths(now, months)), coversInterest: true, monthlyPaymentCents };
}

/**
 * Debt minimum-payments to surface in "Bills due soon" — one row per debt
 * that still has a balance, carrying the next due date and the minimum
 * payment amount. Rows already paid for the current month are flagged
 * (`alreadyPaidThisPeriod`) so the card can drop them, matching how a
 * paid Bill drops off (docs/PRODUCT.md §8).
 * @param {object} state
 * @param {{now?: Date}} [options]
 * @returns {Array<{id: string, name: string, amountCents: number, date: string|null, alreadyPaidThisPeriod: boolean}>}
 */
export function getUpcomingDebtPayments(state, { now = new Date() } = {}) {
  return getAllDebts(state)
    .filter((debt) => debt && (isValidAmountCents(debt.currentBalanceCents) ? debt.currentBalanceCents : 0) > 0)
    .map((debt) => ({
      id: debt.id,
      name: debt.name,
      amountCents: isValidAmountCents(debt.minimumPaymentCents) ? debt.minimumPaymentCents : 0,
      date: getNextDebtDueDateKey(debt, now),
      alreadyPaidThisPeriod: hasDebtPaymentInMonth(state, debt.id, now),
    }));
}
