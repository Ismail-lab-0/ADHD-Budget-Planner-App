// Date-occurrence resolution for recurring/one-time Income and Bill
// records. See docs/SAFE-TO-SPEND.md for the full reasoning — income and
// bills are deliberately NOT treated symmetrically for a past one-time
// date: a past one-time income is presumed already received (excluded —
// it can't be a future payday), while a past one-time bill is presumed
// still owed if unpaid (included — overdue debt doesn't stop being debt).

import { getLocalDateKey, parseLocalDate, addDays, addMonths } from '../../core/date.js';

const RECURRING_STEPPERS = {
  weekly: (d) => addDays(d, 7),
  biweekly: (d) => addDays(d, 14),
  monthly: (d) => addMonths(d, 1),
};

/** Rolls a recurring date forward to the first occurrence on/after `today`. */
function rollForwardRecurring(dateStr, frequency, today) {
  const stepper = RECURRING_STEPPERS[frequency];
  if (!stepper) return null;
  let date = parseLocalDate(dateStr);
  const todayKey = getLocalDateKey(today);
  let iterations = 0;
  // Guards against pathological input; a real recurring record should
  // never need more than a couple thousand steps (~38 years weekly) to
  // reach "today".
  while (getLocalDateKey(date) < todayKey && iterations < 2000) {
    date = stepper(date);
    iterations += 1;
  }
  return getLocalDateKey(date);
}

/**
 * When does this income next arrive, on or after `today`? A past
 * one-time income has no next occurrence (presumed already received —
 * see docs/SAFE-TO-SPEND.md "how recurring income is handled").
 * @param {string|null} dateStr YYYY-MM-DD
 * @param {'one-time'|'weekly'|'biweekly'|'monthly'} frequency
 * @param {Date} today
 * @returns {string|null} YYYY-MM-DD
 */
export function getNextIncomeDate(dateStr, frequency, today) {
  if (!dateStr) return null;
  if (frequency === 'one-time' || !frequency) {
    const key = getLocalDateKey(parseLocalDate(dateStr));
    return key >= getLocalDateKey(today) ? key : null;
  }
  return rollForwardRecurring(dateStr, frequency, today);
}

/**
 * When is this bill currently due? A one-time bill keeps its own date
 * even if it's in the past (still owed if unpaid) — only recurring bills
 * roll forward to their current cycle.
 * @param {string|null} dateStr YYYY-MM-DD
 * @param {'one-time'|'weekly'|'monthly'} recurrence
 * @param {Date} today
 * @returns {string|null} YYYY-MM-DD
 */
export function getCurrentBillDueDate(dateStr, recurrence, today) {
  if (!dateStr) return null;
  if (recurrence === 'one-time' || !recurrence) {
    return getLocalDateKey(parseLocalDate(dateStr));
  }
  return rollForwardRecurring(dateStr, recurrence, today);
}

/**
 * Every occurrence of a recurring (or one-time) income landing within
 * `[startKey, endKey]` (inclusive). Originally used for the dashboard's
 * period-scoped "money in" figure; **not currently called by anything** —
 * `getPeriodSummary` (src/modules/dashboard/index.js) switched to summing
 * real `IncomeReceipt` records instead, since a *projection* of scheduled
 * income read as "money in" when it was really "money about to arrive," a
 * real reported point of confusion. Kept, still fully tested
 * (tests/unit/safe-to-spend-recurrence.test.js), in case a distinct,
 * separately-labeled "projected/expected income" view is ever wanted
 * later — same "still a working, reusable primitive" precedent as
 * `categoryEmojiBadge` (src/ui/components/icons.js).
 *
 * Important limitation, inherent to the data model, not this function:
 * Income records aren't logged transaction history, only a forward-looking
 * schedule (`nextDate` + `frequency`) — there is nothing to roll
 * *backward*. This never returns a date before `today`, so a period
 * entirely in the past (e.g. "Last month") correctly yields `[]` rather
 * than a fabricated number. `endKey` is required (not optional) for the
 * same reason `getNextIncomeDate` never runs unbounded: an open-ended
 * range would mean "every future paycheck forever," which isn't a
 * meaningful sum — callers with no concrete end date should treat
 * "money in" as not applicable for that period rather than call this.
 *
 * @param {string|null} dateStr YYYY-MM-DD
 * @param {'one-time'|'weekly'|'biweekly'|'monthly'} frequency
 * @param {Date} today
 * @param {string|null} startKey YYYY-MM-DD, or null for "from today"
 * @param {string} endKey YYYY-MM-DD, required
 * @returns {string[]} occurrence dates, ascending
 */
export function getIncomeOccurrencesInRange(dateStr, frequency, today, startKey, endKey) {
  if (!dateStr || endKey == null) return [];
  const todayKey = getLocalDateKey(today);
  const effectiveStart = startKey && startKey > todayKey ? startKey : todayKey; // never before today — see doc comment above
  if (effectiveStart > endKey) return [];

  if (frequency === 'one-time' || !frequency) {
    const key = getLocalDateKey(parseLocalDate(dateStr));
    return key >= effectiveStart && key <= endKey ? [key] : [];
  }

  const stepper = RECURRING_STEPPERS[frequency];
  if (!stepper) return [];

  let date = parseLocalDate(dateStr);
  let iterations = 0;
  // Same 2000-iteration guard as rollForwardRecurring, for the same reason.
  while (getLocalDateKey(date) < effectiveStart && iterations < 2000) {
    date = stepper(date);
    iterations += 1;
  }

  const occurrences = [];
  iterations = 0;
  while (getLocalDateKey(date) <= endKey && iterations < 2000) {
    occurrences.push(getLocalDateKey(date));
    date = stepper(date);
    iterations += 1;
  }
  return occurrences;
}
