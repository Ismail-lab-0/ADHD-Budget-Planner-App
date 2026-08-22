// Phase 8 — Full Testing and Validation, §3 "Date testing": the exact
// fixed-date scenarios named in the phase spec, run end-to-end through
// getSafeToSpend with a fixed `now` (never the real clock). Individual
// date-math primitives (addMonths, daysBetween, rollForwardRecurring,
// isOverdue, etc.) already have dedicated unit tests in date.test.js and
// safe-to-spend-recurrence.test.js — this file's job is to prove the
// *end-to-end calculation* behaves correctly at each of these named dates,
// as a single traceable checklist docs/QA-REPORT.md can point back to.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getSafeToSpend, getCurrentBillDueDate } from '../../src/modules/safe-to-spend/index.js';

function state({ balanceCents = 100000, incomes = [], bills = [] } = {}) {
  return {
    budget: { currentBalanceCents: balanceCents, savingsAllocationCents: 0 },
    incomes,
    bills,
    plannedExpenses: [],
  };
}

// Fixed reference point for every scenario below: Friday, August 21, 2026.
const TODAY = new Date(2026, 7, 21);

describe('today', () => {
  test('a bill due exactly today counts as upcoming, not yet overdue-and-excluded', () => {
    const s = state({ bills: [{ id: 'b1', name: 'Cable', amountCents: 5000, dueDate: '2026-08-21', active: true, paid: false, recurrence: 'one-time' }] });
    const result = getSafeToSpend(s, { now: TODAY });
    assert.equal(result.upcomingBillsCents, 5000);
  });
});

describe('tomorrow', () => {
  test('a bill due tomorrow counts as upcoming', () => {
    const s = state({ bills: [{ id: 'b1', name: 'Cable', amountCents: 5000, dueDate: '2026-08-22', active: true, paid: false, recurrence: 'one-time' }] });
    const result = getSafeToSpend(s, { now: TODAY });
    assert.equal(result.upcomingBillsCents, 5000);
  });
});

describe('payday today', () => {
  test('daysUntilPayday is 0 and the daily allowance equals the full Safe-to-Spend amount (not divided by zero)', () => {
    const s = state({ balanceCents: 33000, incomes: [{ id: 'i1', name: 'Paycheck', amountCents: 200000, nextDate: '2026-08-21', frequency: 'one-time', active: true }] });
    const result = getSafeToSpend(s, { now: TODAY });
    assert.equal(result.nextPaydayDate, '2026-08-21');
    assert.equal(result.daysUntilPayday, 0);
    assert.equal(result.dailyAllowanceCents, result.safeToSpendCents);
  });
});

describe('payday tomorrow', () => {
  test('daysUntilPayday is 1 and the daily allowance equals the full amount (a 1-day window)', () => {
    const s = state({ balanceCents: 20000, incomes: [{ id: 'i1', name: 'Paycheck', amountCents: 200000, nextDate: '2026-08-22', frequency: 'one-time', active: true }] });
    const result = getSafeToSpend(s, { now: TODAY });
    assert.equal(result.daysUntilPayday, 1);
    assert.equal(result.dailyAllowanceCents, 20000);
  });
});

describe('payday next month', () => {
  test('a payday over a month away computes the correct day count across the month boundary', () => {
    const s = state({ balanceCents: 220000, incomes: [{ id: 'i1', name: 'Paycheck', amountCents: 200000, nextDate: '2026-09-15', frequency: 'one-time', active: true }] });
    const result = getSafeToSpend(s, { now: TODAY }); // Aug 21 -> Sep 15
    assert.equal(result.nextPaydayDate, '2026-09-15');
    assert.equal(result.daysUntilPayday, 25); // 10 remaining days in August + 15 days in September
  });
});

describe('end of month', () => {
  test('a bill due on the last day of the month is included when the horizon extends that far', () => {
    // August 2026 has 31 days.
    const s = state({
      incomes: [{ id: 'i1', name: 'Paycheck', amountCents: 200000, nextDate: '2026-09-01', frequency: 'one-time', active: true }],
      bills: [{ id: 'b1', name: 'Subscription', amountCents: 1200, dueDate: '2026-08-31', active: true, paid: false, recurrence: 'one-time' }],
    });
    const result = getSafeToSpend(s, { now: TODAY });
    assert.equal(result.upcomingBillsCents, 1200);
  });

  test('viewed from the last day of the month itself, "today" still resolves correctly (no off-by-one)', () => {
    const lastDayOfAugust = new Date(2026, 7, 31);
    const s = state({ bills: [{ id: 'b1', name: 'Rent', amountCents: 90000, dueDate: '2026-08-31', active: true, paid: false, recurrence: 'one-time' }] });
    const result = getSafeToSpend(s, { now: lastDayOfAugust });
    assert.equal(result.upcomingBillsCents, 90000); // due today, not overdue-and-dropped
  });
});

describe('beginning of month', () => {
  test('viewed from the 1st of the month, a bill due later that same month is upcoming', () => {
    const firstOfSeptember = new Date(2026, 8, 1);
    const s = state({ bills: [{ id: 'b1', name: 'Rent', amountCents: 90000, dueDate: '2026-09-05', active: true, paid: false, recurrence: 'one-time' }] });
    const result = getSafeToSpend(s, { now: firstOfSeptember });
    assert.equal(result.upcomingBillsCents, 90000);
  });
});

describe('recurring monthly bills', () => {
  test('a stale monthly bill (last due date months ago) rolls forward to its current on/after-today cycle', () => {
    const resolvedDate = getCurrentBillDueDate('2026-06-15', 'monthly', TODAY);
    assert.equal(resolvedDate, '2026-09-15'); // Jun 15 -> Jul 15 -> Aug 15 (still stale) -> Sep 15 (first on/after Aug 21)

    const s = state({ bills: [{ id: 'b1', name: 'Rent', amountCents: 90000, dueDate: '2026-06-15', active: true, paid: false, recurrence: 'monthly' }] });
    const result = getSafeToSpend(s, { now: TODAY }); // no payday horizon set -> still counts regardless of the exact resolved date
    assert.equal(result.upcomingBillsCents, 90000);
  });

  test('a monthly bill anchored on the 31st clamps through short months without throwing or overflowing', () => {
    const resolvedDate = getCurrentBillDueDate('2026-01-31', 'monthly', TODAY);
    // Jan 31 -> Feb 28 (clamped, 2026 is not a leap year) -> Mar 28 -> ... -> Aug 28 (day-of-month stays
    // clamped at 28 once a short month forces it down — it does not jump back to 31).
    assert.equal(resolvedDate, '2026-08-28');

    const s = state({ bills: [{ id: 'b1', name: 'Rent', amountCents: 90000, dueDate: '2026-01-31', active: true, paid: false, recurrence: 'monthly' }] });
    const result = getSafeToSpend(s, { now: TODAY });
    assert.equal(result.upcomingBillsCents, 90000); // resolves to a valid date without throwing, and still counts
  });

  test('a monthly bill excluded once its rolled-forward due date falls after the payday horizon', () => {
    const s = state({
      incomes: [{ id: 'i1', name: 'Paycheck', amountCents: 200000, nextDate: '2026-08-24', frequency: 'one-time', active: true }],
      bills: [{ id: 'b1', name: 'Rent', amountCents: 90000, dueDate: '2026-06-30', active: true, paid: false, recurrence: 'monthly' }],
    });
    // Rolls forward to 2026-08-30, which is after the 2026-08-24 payday horizon.
    const result = getSafeToSpend(s, { now: TODAY });
    assert.equal(result.upcomingBillsCents, 0);
  });
});

describe('overdue bills', () => {
  test('a one-time bill with a due date in the past still counts in full (overdue debt does not stop being debt)', () => {
    const s = state({ bills: [{ id: 'b1', name: 'Old medical bill', amountCents: 45000, dueDate: '2026-05-01', active: true, paid: false, recurrence: 'one-time' }] });
    const result = getSafeToSpend(s, { now: TODAY });
    assert.equal(result.upcomingBillsCents, 45000);
  });

  test('an overdue bill is excluded the moment it is marked paid', () => {
    const s = state({ bills: [{ id: 'b1', name: 'Old medical bill', amountCents: 45000, dueDate: '2026-05-01', active: true, paid: true, recurrence: 'one-time' }] });
    const result = getSafeToSpend(s, { now: TODAY });
    assert.equal(result.upcomingBillsCents, 0);
  });
});
