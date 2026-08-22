// Tests for src/modules/safe-to-spend/recurrence.js — see
// docs/SAFE-TO-SPEND.md §5/§6 for why income and bills are treated
// asymmetrically for a past one-time date.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getNextIncomeDate, getCurrentBillDueDate, getIncomeOccurrencesInRange } from '../../src/modules/safe-to-spend/recurrence.js';

const TODAY = new Date(2026, 7, 21); // fixed date, never the real current date

describe('getNextIncomeDate', () => {
  test('one-time, in the future: returns the date as-is', () => {
    assert.equal(getNextIncomeDate('2026-08-25', 'one-time', TODAY), '2026-08-25');
  });

  test('one-time, today: counts as upcoming (same-day payday)', () => {
    assert.equal(getNextIncomeDate('2026-08-21', 'one-time', TODAY), '2026-08-21');
  });

  test('one-time, in the past: returns null (presumed already received)', () => {
    assert.equal(getNextIncomeDate('2026-08-01', 'one-time', TODAY), null);
  });

  test('weekly, stale by a few weeks: rolls forward to the next occurrence on/after today', () => {
    // 2026-08-03 is a Monday; weekly from there lands on 2026-08-24 (the
    // first Monday on/after 2026-08-21).
    assert.equal(getNextIncomeDate('2026-08-03', 'weekly', TODAY), '2026-08-24');
  });

  test('biweekly, stale: rolls forward in 14-day steps', () => {
    assert.equal(getNextIncomeDate('2026-07-27', 'biweekly', TODAY), '2026-08-24');
  });

  test('monthly, stale: rolls forward in whole calendar months', () => {
    assert.equal(getNextIncomeDate('2026-06-21', 'monthly', TODAY), '2026-08-21');
  });

  test('monthly, already on/after today: no rolling needed', () => {
    assert.equal(getNextIncomeDate('2026-08-25', 'monthly', TODAY), '2026-08-25');
  });

  test('no date at all: returns null', () => {
    assert.equal(getNextIncomeDate(null, 'monthly', TODAY), null);
    assert.equal(getNextIncomeDate(undefined, 'weekly', TODAY), null);
  });

  test('an unrecognized frequency returns null', () => {
    assert.equal(getNextIncomeDate('2026-08-25', 'yearly', TODAY), null);
  });
});

describe('getCurrentBillDueDate', () => {
  test('one-time, in the future: returns the date as-is', () => {
    assert.equal(getCurrentBillDueDate('2026-08-25', 'one-time', TODAY), '2026-08-25');
  });

  test('one-time, in the past: still returns the date (overdue debt still counts)', () => {
    assert.equal(getCurrentBillDueDate('2026-08-01', 'one-time', TODAY), '2026-08-01');
  });

  test('weekly, stale: rolls forward like income', () => {
    assert.equal(getCurrentBillDueDate('2026-08-03', 'weekly', TODAY), '2026-08-24');
  });

  test('monthly, stale: rolls forward to the current cycle', () => {
    assert.equal(getCurrentBillDueDate('2026-06-21', 'monthly', TODAY), '2026-08-21');
  });

  test('monthly rolling clamps to the shorter month rather than overflowing', () => {
    const today = new Date(2027, 1, 15); // Feb 15, 2027
    // Dec 31 -> Jan 31 (still before today) -> Feb 2027 clamps to Feb 28
    // (2027 isn't a leap year), which is on/after today.
    assert.equal(getCurrentBillDueDate('2026-12-31', 'monthly', today), '2027-02-28');
  });

  test('no date at all: returns null', () => {
    assert.equal(getCurrentBillDueDate(null, 'monthly', TODAY), null);
  });
});

describe('getIncomeOccurrencesInRange', () => {
  test('one-time income inside the range: returns that single date', () => {
    assert.deepEqual(getIncomeOccurrencesInRange('2026-08-25', 'one-time', TODAY, '2026-08-01', '2026-08-31'), ['2026-08-25']);
  });

  test('one-time income outside the range: returns []', () => {
    assert.deepEqual(getIncomeOccurrencesInRange('2026-09-05', 'one-time', TODAY, '2026-08-01', '2026-08-31'), []);
  });

  test('weekly income: every occurrence on/after today within the range', () => {
    // Anchored Saturday Aug 1; stepping weekly: Aug 1, 8, 15, 22, 29, Sep 5...
    // Today is Aug 21, so the first occurrence considered is Aug 22 (the
    // first one on/after today), not Aug 15 (already past).
    const result = getIncomeOccurrencesInRange('2026-08-01', 'weekly', TODAY, '2026-08-01', '2026-08-31');
    assert.deepEqual(result, ['2026-08-22', '2026-08-29']);
  });

  test('monthly income: resolves the one occurrence landing in a full-month range', () => {
    // Anchored the 25th; stepping monthly forward from today (Aug 21)
    // lands on Aug 25, still within the range.
    const result = getIncomeOccurrencesInRange('2026-05-25', 'monthly', TODAY, '2026-08-01', '2026-08-31');
    assert.deepEqual(result, ['2026-08-25']);
  });

  test('monthly income whose only occurrence in the calendar month already passed: excluded, not backdated', () => {
    // Anchored the 15th; today (Aug 21) has already passed Aug 15, so the
    // next occurrence rolls to Sep 15 — outside the Aug range entirely.
    const result = getIncomeOccurrencesInRange('2026-06-15', 'monthly', TODAY, '2026-08-01', '2026-08-31');
    assert.deepEqual(result, []);
  });

  test('a range entirely in the past yields [] — no data to reconstruct historical income arrivals', () => {
    const result = getIncomeOccurrencesInRange('2026-01-01', 'weekly', TODAY, '2026-07-01', '2026-07-31');
    assert.deepEqual(result, []);
  });

  test('no endKey (an open-ended/unbounded range) yields [] rather than projecting forever', () => {
    assert.deepEqual(getIncomeOccurrencesInRange('2026-08-01', 'weekly', TODAY, '2026-08-01', null), []);
  });

  test('no date at all: returns []', () => {
    assert.deepEqual(getIncomeOccurrencesInRange(null, 'weekly', TODAY, '2026-08-01', '2026-08-31'), []);
  });
});
