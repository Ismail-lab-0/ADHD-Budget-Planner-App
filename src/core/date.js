// Shared date/time utilities — the single implementation of "what day is
// it" logic. See docs/ARCHITECTURE.md §6 (`/core/date.js`) and
// docs/DATA-MODEL.md §2 ("conversion to local time/day boundaries happens
// only at render/derivation time, via the shared date utility ... never
// scattered ad hoc across modules").
//
// All "local day" logic here is deliberately based on the runtime's local
// timezone (the browser's), not UTC — a date-only value like a Task's
// `dueAt` of "2026-08-21" means the 21st in the user's own day, not in UTC.

/** @param {Date} [date] @returns {string} local date as "YYYY-MM-DD" */
export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** @param {Date} [date] @returns {Date} local midnight of the given date */
export function startOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** @param {Date} a @param {Date} b @returns {boolean} */
export function isSameLocalDay(a, b) {
  return getLocalDateKey(a) === getLocalDateKey(b);
}

/**
 * Parses an ISO date or datetime string as a local-time Date, avoiding the
 * common footgun where `new Date("YYYY-MM-DD")` is parsed as UTC midnight
 * (which can land on the *previous* local day in negative-UTC-offset
 * timezones). Date-only strings are parsed as local; full datetime strings
 * are passed through to the native parser, which already treats them as
 * local time per the ES spec when no timezone offset is present.
 *
 * @param {string} isoString
 * @returns {Date}
 */
export function parseLocalDate(isoString) {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoString);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  return new Date(isoString);
}

/** @param {string} isoString @param {Date} [now] @returns {boolean} */
export function isToday(isoString, now = new Date()) {
  return isSameLocalDay(parseLocalDate(isoString), now);
}

/**
 * A date is "overdue" if its local day is strictly before today's local
 * day — a due date of today is not yet overdue.
 * @param {string} isoString @param {Date} [now] @returns {boolean}
 */
export function isOverdue(isoString, now = new Date()) {
  const due = startOfLocalDay(parseLocalDate(isoString));
  const today = startOfLocalDay(now);
  return due.getTime() < today.getTime();
}

/** @param {Date} [date] @returns {'morning'|'afternoon'|'evening'} */
export function getGreetingPeriod(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/** @param {Date} [date] @returns {string} e.g. "Friday, August 21, 2026" */
export function formatFriendlyDate(date = new Date()) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/** @param {Date} date @param {number} n @returns {Date} `date` plus `n` local days */
export function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

/**
 * `date` plus `n` calendar months, clamped to the last day of the target
 * month if the original day-of-month doesn't exist there (e.g. Jan 31 + 1
 * month -> Feb 28, not "March 3" from naive overflow).
 * @param {Date} date @param {number} n @returns {Date}
 */
export function addMonths(date, n) {
  const targetMonth = date.getMonth() + n;
  const candidate = new Date(date.getFullYear(), targetMonth, date.getDate());
  const normalizedTargetMonth = ((targetMonth % 12) + 12) % 12;
  if (candidate.getMonth() !== normalizedTargetMonth) {
    return new Date(date.getFullYear(), targetMonth + 1, 0); // day 0 = last day of the intended month
  }
  return candidate;
}

/** @param {Date} from @param {Date} to @returns {number} whole local days from `from` to `to` (negative if `to` is earlier) */
export function daysBetween(from, to) {
  const a = startOfLocalDay(from);
  const b = startOfLocalDay(to);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** @param {Date} date @returns {Date} local midnight of the 1st of `date`'s month */
export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** @param {Date} date @returns {Date} local midnight of the last day of `date`'s month */
export function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0); // day 0 = last day of the current month
}

/**
 * Monday of the calendar week containing `date` (ISO-style week start —
 * this app has no other week-start convention to be consistent with).
 * @param {Date} date @returns {Date} local midnight of that Monday
 */
export function startOfWeek(date) {
  const day = date.getDay(); // 0 = Sunday ... 6 = Saturday
  const offsetFromMonday = day === 0 ? 6 : day - 1;
  return addDays(startOfLocalDay(date), -offsetFromMonday);
}

/**
 * `date` advanced by exactly one cycle of `frequency` — a single
 * unconditional step, unlike src/modules/safe-to-spend/recurrence.js's
 * `rollForwardRecurring` (which steps repeatedly until reaching "today").
 * Used where something needs "the next occurrence after this one," not
 * "the current occurrence as of now" — e.g. advancing a recurring
 * Income's `nextDate` the moment it's confirmed received (src/modules/
 * incomes/reducer.js). Lives here (not safe-to-spend/) since it's a
 * generic date-math primitive, not Safe-to-Spend-specific logic.
 * @param {Date} date
 * @param {'one-time'|'weekly'|'biweekly'|'monthly'} frequency
 * @returns {Date} `date` unchanged for 'one-time' or an unrecognized frequency
 */
export function advanceByFrequency(date, frequency) {
  if (frequency === 'weekly') return addDays(date, 7);
  if (frequency === 'biweekly') return addDays(date, 14);
  if (frequency === 'monthly') return addMonths(date, 1);
  return date;
}
