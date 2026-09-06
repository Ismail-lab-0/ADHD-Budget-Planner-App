import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  getLocalDateKey,
  isSameLocalDay,
  isToday,
  isOverdue,
  getGreetingPeriod,
  formatFriendlyDate,
  formatShortWeekdayDate,
  addDays,
  addMonths,
  daysBetween,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  advanceByFrequency,
  formatRelativeTime,
} from '../../src/core/date.js';

describe('getLocalDateKey', () => {
  test('formats as YYYY-MM-DD', () => {
    assert.equal(getLocalDateKey(new Date(2026, 7, 21)), '2026-08-21');
  });

  test('pads single-digit months and days', () => {
    assert.equal(getLocalDateKey(new Date(2026, 0, 5)), '2026-01-05');
  });
});

describe('isSameLocalDay', () => {
  test('true for two times on the same local day', () => {
    assert.ok(isSameLocalDay(new Date(2026, 7, 21, 0, 1), new Date(2026, 7, 21, 23, 59)));
  });

  test('false across a local day boundary', () => {
    assert.equal(isSameLocalDay(new Date(2026, 7, 21, 23, 59), new Date(2026, 7, 22, 0, 1)), false);
  });
});

describe('isToday / isOverdue', () => {
  const now = new Date(2026, 7, 21, 10, 0);

  test('a date-only string for today is today, not overdue', () => {
    assert.ok(isToday('2026-08-21', now));
    assert.equal(isOverdue('2026-08-21', now), false);
  });

  test('a date-only string for yesterday is overdue', () => {
    assert.equal(isToday('2026-08-20', now), false);
    assert.ok(isOverdue('2026-08-20', now));
  });

  test('a future date-only string is neither today nor overdue', () => {
    assert.equal(isToday('2026-08-22', now), false);
    assert.equal(isOverdue('2026-08-22', now), false);
  });

  test('midnight boundary: just after local midnight, yesterday (even 1 minute before midnight) is overdue', () => {
    const justAfterMidnight = new Date(2026, 7, 21, 0, 5);
    assert.ok(isToday('2026-08-21T00:01:00', justAfterMidnight));
    assert.ok(isOverdue('2026-08-20T23:59:00', justAfterMidnight));
  });
});

describe('getGreetingPeriod', () => {
  test('before noon is morning', () => {
    assert.equal(getGreetingPeriod(new Date(2026, 7, 21, 11, 59)), 'morning');
  });

  test('noon up to (not including) 5pm is afternoon', () => {
    assert.equal(getGreetingPeriod(new Date(2026, 7, 21, 12, 0)), 'afternoon');
    assert.equal(getGreetingPeriod(new Date(2026, 7, 21, 16, 59)), 'afternoon');
  });

  test('5pm and later is evening', () => {
    assert.equal(getGreetingPeriod(new Date(2026, 7, 21, 17, 0)), 'evening');
    assert.equal(getGreetingPeriod(new Date(2026, 7, 21, 23, 59)), 'evening');
  });
});

describe('formatFriendlyDate', () => {
  test('includes the weekday, full month name, and year', () => {
    const formatted = formatFriendlyDate(new Date(2026, 7, 21));
    assert.match(formatted, /Friday/);
    assert.match(formatted, /August/);
    assert.match(formatted, /2026/);
  });
});

describe('formatShortWeekdayDate', () => {
  test('"Mon 31 Aug" — short weekday + day + short month, from a YYYY-MM-DD key', () => {
    assert.equal(formatShortWeekdayDate('2026-08-31'), 'Mon 31 Aug');
  });

  test('accepts a Date too', () => {
    assert.equal(formatShortWeekdayDate(new Date(2026, 7, 21)), 'Fri 21 Aug');
  });

  test('null / undefined / an unparseable string return null', () => {
    assert.equal(formatShortWeekdayDate(null), null);
    assert.equal(formatShortWeekdayDate(undefined), null);
    assert.equal(formatShortWeekdayDate('not-a-date'), null);
  });
});

describe('addDays', () => {
  test('adds whole days, rolling over month/year boundaries', () => {
    assert.equal(getLocalDateKey(addDays(new Date(2026, 7, 21), 7)), '2026-08-28');
    assert.equal(getLocalDateKey(addDays(new Date(2026, 7, 28), 7)), '2026-09-04');
    assert.equal(getLocalDateKey(addDays(new Date(2026, 11, 28), 7)), '2027-01-04');
  });

  test('a negative count subtracts days', () => {
    assert.equal(getLocalDateKey(addDays(new Date(2026, 7, 1), -3)), '2026-07-29');
  });
});

describe('addMonths', () => {
  test('adds whole months, keeping the day-of-month when it exists', () => {
    assert.equal(getLocalDateKey(addMonths(new Date(2026, 0, 15), 1)), '2026-02-15');
    assert.equal(getLocalDateKey(addMonths(new Date(2026, 0, 15), 12)), '2027-01-15');
  });

  test('clamps to the last day of a shorter target month rather than overflowing', () => {
    // 2027 is not a leap year: Jan 31 + 1 month should land on Feb 28, not "March 3".
    assert.equal(getLocalDateKey(addMonths(new Date(2027, 0, 31), 1)), '2027-02-28');
  });

  test('clamps correctly in a leap year', () => {
    assert.equal(getLocalDateKey(addMonths(new Date(2028, 0, 31), 1)), '2028-02-29');
  });
});

describe('daysBetween', () => {
  test('counts whole local days from the first date to the second', () => {
    assert.equal(daysBetween(new Date(2026, 7, 21), new Date(2026, 8, 1)), 11);
  });

  test('is zero for the same local day, even with different times', () => {
    assert.equal(daysBetween(new Date(2026, 7, 21, 1, 0), new Date(2026, 7, 21, 23, 0)), 0);
  });

  test('is negative when the second date is earlier', () => {
    assert.equal(daysBetween(new Date(2026, 7, 21), new Date(2026, 7, 18)), -3);
  });
});

describe('startOfMonth / endOfMonth', () => {
  test('resolve to the 1st and last day of the given date\'s month', () => {
    assert.equal(getLocalDateKey(startOfMonth(new Date(2026, 7, 21))), '2026-08-01');
    assert.equal(getLocalDateKey(endOfMonth(new Date(2026, 7, 21))), '2026-08-31'); // August 2026 has 31 days
  });

  test('endOfMonth handles a non-leap-year February correctly', () => {
    assert.equal(getLocalDateKey(endOfMonth(new Date(2026, 1, 1))), '2026-02-28');
  });

  test('endOfMonth handles a leap-year February correctly', () => {
    assert.equal(getLocalDateKey(endOfMonth(new Date(2028, 1, 1))), '2028-02-29');
  });
});

describe('startOfWeek', () => {
  test('resolves a weekday to the Monday of that same calendar week', () => {
    // Friday, August 21, 2026 -> Monday, August 17, 2026.
    assert.equal(getLocalDateKey(startOfWeek(new Date(2026, 7, 21))), '2026-08-17');
  });

  test('resolves a Sunday to the Monday that started that week (not the next one)', () => {
    assert.equal(getLocalDateKey(startOfWeek(new Date(2026, 7, 23))), '2026-08-17'); // Sunday Aug 23 -> Monday Aug 17
  });

  test('a Monday resolves to itself', () => {
    assert.equal(getLocalDateKey(startOfWeek(new Date(2026, 7, 17))), '2026-08-17');
  });
});

describe('advanceByFrequency', () => {
  test('weekly advances by 7 days', () => {
    assert.equal(getLocalDateKey(advanceByFrequency(new Date(2026, 7, 1), 'weekly')), '2026-08-08');
  });

  test('biweekly advances by 14 days', () => {
    assert.equal(getLocalDateKey(advanceByFrequency(new Date(2026, 7, 1), 'biweekly')), '2026-08-15');
  });

  test('monthly advances by one calendar month, clamping short months', () => {
    assert.equal(getLocalDateKey(advanceByFrequency(new Date(2026, 0, 31), 'monthly')), '2026-02-28');
  });

  test('one-time (and any unrecognized frequency) returns the date unchanged', () => {
    const date = new Date(2026, 7, 1);
    assert.equal(advanceByFrequency(date, 'one-time'), date);
    assert.equal(advanceByFrequency(date, undefined), date);
  });
});

describe('formatRelativeTime', () => {
  const NOW = new Date('2026-08-23T12:00:00.000Z');

  test('under a minute reads "just now"', () => {
    assert.equal(formatRelativeTime(new Date('2026-08-23T11:59:30.000Z').toISOString(), NOW), 'just now');
    assert.equal(formatRelativeTime(NOW.toISOString(), NOW), 'just now');
  });

  test('minutes ago, singular unit label at the boundary', () => {
    assert.equal(formatRelativeTime(new Date('2026-08-23T11:58:00.000Z').toISOString(), NOW), '2m ago');
    assert.equal(formatRelativeTime(new Date('2026-08-23T11:59:00.000Z').toISOString(), NOW), '1m ago');
  });

  test('hours ago once past 60 minutes', () => {
    assert.equal(formatRelativeTime(new Date('2026-08-23T09:00:00.000Z').toISOString(), NOW), '3h ago');
  });

  test('days ago once past 24 hours, up to a week', () => {
    assert.equal(formatRelativeTime(new Date('2026-08-21T12:00:00.000Z').toISOString(), NOW), '2d ago');
    assert.equal(formatRelativeTime(new Date('2026-08-17T12:00:00.000Z').toISOString(), NOW), '6d ago');
  });

  test('falls back to a friendly date past a week', () => {
    assert.equal(formatRelativeTime(new Date('2026-08-01T12:00:00.000Z').toISOString(), NOW), formatFriendlyDate(new Date('2026-08-01T12:00:00.000Z')));
  });

  test('a future timestamp (clock skew) clamps to "just now" instead of a negative value', () => {
    assert.equal(formatRelativeTime(new Date('2026-08-23T12:05:00.000Z').toISOString(), NOW), 'just now');
  });
});
