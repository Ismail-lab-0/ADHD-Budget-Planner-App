// Tests for src/modules/dashboard/ — composition/selection logic only
// (what to list, in what order). Money figures are never recomputed here;
// see tests/unit/safe-to-spend.test.js for the arithmetic itself.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getUpcomingCommitments, getPeriodSummary, getUpcomingIncome, getUpcomingBillsTotalCents } from '../../src/modules/dashboard/index.js';

function bill(overrides = {}) {
  return { id: 'b1', name: 'Bill', amountCents: 1000, dueDate: '2026-08-25', active: true, paid: false, recurrence: 'one-time', ...overrides };
}

function plannedExpense(overrides = {}) {
  return { id: 'p1', name: 'Expense', amountCents: 500, plannedDate: '2026-08-26', ...overrides };
}

describe('getUpcomingCommitments', () => {
  test('combines active, unpaid bills with planned expenses, sorted by date', () => {
    const state = {
      bills: [bill({ id: 'b1', dueDate: '2026-08-28' })],
      plannedExpenses: [plannedExpense({ id: 'p1', plannedDate: '2026-08-25' })],
    };
    const { items } = getUpcomingCommitments(state);
    assert.deepEqual(items.map((i) => i.id), ['p1', 'b1']);
  });

  test('excludes paid and inactive bills', () => {
    const state = {
      bills: [bill({ id: 'paid', paid: true }), bill({ id: 'inactive', active: false }), bill({ id: 'live' })],
      plannedExpenses: [],
    };
    const { items } = getUpcomingCommitments(state);
    assert.deepEqual(items.map((i) => i.id), ['live']);
  });

  test('undated items sort after dated ones', () => {
    const state = {
      bills: [bill({ id: 'undated', dueDate: null })],
      plannedExpenses: [plannedExpense({ id: 'dated', plannedDate: '2026-08-25' })],
    };
    const { items } = getUpcomingCommitments(state);
    assert.deepEqual(items.map((i) => i.id), ['dated', 'undated']);
  });

  test('limits the list and reports how many were left out', () => {
    const state = {
      bills: [1, 2, 3, 4, 5, 6].map((n) => bill({ id: `b${n}`, dueDate: `2026-08-${20 + n}` })),
      plannedExpenses: [],
    };
    const { items, remainingCount } = getUpcomingCommitments(state, { limit: 3 });
    assert.equal(items.length, 3);
    assert.equal(remainingCount, 3);
  });

  test('an empty state produces an empty list with no remaining count', () => {
    const { items, remainingCount } = getUpcomingCommitments({});
    assert.deepEqual(items, []);
    assert.equal(remainingCount, 0);
  });
});

// Friday, August 21, 2026 — the same fixed reference point used
// throughout this app's test suite.
const TODAY = new Date(2026, 7, 21);

describe('getPeriodSummary (the header bar\'s global period selector)', () => {
  test('moneyOutCents sums Expenses within the given range, from real logged history', () => {
    const state = {
      expenses: [
        { id: 'e1', amountCents: 500, date: '2026-08-05', createdAt: 'a' },
        { id: 'e2', amountCents: 1500, date: '2026-08-20', createdAt: 'b' },
        { id: 'e3', amountCents: 999, date: '2026-07-31', createdAt: 'c' }, // outside the range
      ],
    };
    const { moneyOutCents } = getPeriodSummary(state, { startDateKey: '2026-08-01', endDateKey: '2026-08-31', now: TODAY });
    assert.equal(moneyOutCents, 2000);
  });

  test('when endDateKey is null (e.g. "All time"), moneyInCents sums real IncomeReceipts instead of projecting a schedule', () => {
    const state = {
      incomeReceipts: [
        { id: 'ir1', incomeId: 'i1', amountCents: 200000, date: '2026-07-01' },
        { id: 'ir2', incomeId: 'i1', amountCents: 200000, date: '2026-08-14' },
      ],
      // A scheduled-but-not-yet-received income must NOT be counted — only confirmed receipts count for "All time."
      incomes: [{ id: 'i2', active: true, amountCents: 999999, nextDate: '2026-08-25', frequency: 'one-time' }],
    };
    const { moneyInCents } = getPeriodSummary(state, { startDateKey: null, endDateKey: null, now: TODAY });
    assert.equal(moneyInCents, 400000); // only the two real receipts, never the unreceived scheduled income
  });

  test('an unbounded custom range still respects its own "from" date against receipts', () => {
    const state = {
      incomeReceipts: [
        { id: 'ir1', amountCents: 10000, date: '2026-07-01' }, // before "from" — excluded
        { id: 'ir2', amountCents: 20000, date: '2026-08-05' }, // on/after "from" — included
      ],
    };
    const { moneyInCents } = getPeriodSummary(state, { startDateKey: '2026-08-01', endDateKey: null, now: TODAY });
    assert.equal(moneyInCents, 20000);
  });

  test('"All time" with no receipts at all is a real $0, not a placeholder', () => {
    const { moneyInCents } = getPeriodSummary({}, { startDateKey: null, endDateKey: null, now: TODAY });
    assert.equal(moneyInCents, 0);
  });

  test('a bounded period also sums real IncomeReceipts, not a schedule projection — an income merely scheduled (not yet confirmed received) never counts, even within the range', () => {
    const state = {
      incomeReceipts: [
        { id: 'ir1', amountCents: 200000, date: '2026-08-05' },
        { id: 'ir2', amountCents: 50000, date: '2026-08-20' },
        { id: 'ir3', amountCents: 999, date: '2026-07-31' }, // outside the range
      ],
      // A scheduled-but-unconfirmed income landing inside the range must NOT be counted here.
      incomes: [{ id: 'i1', active: true, amountCents: 999999, nextDate: '2026-08-10', frequency: 'one-time' }],
    };
    const { moneyInCents } = getPeriodSummary(state, { startDateKey: '2026-08-01', endDateKey: '2026-08-31', now: TODAY });
    assert.equal(moneyInCents, 250000);
  });

  test('moneyOutCents also sums BillPayments (bills actually marked paid) within the range, alongside Expenses — a bill merely due, not yet paid, never counts', () => {
    const state = {
      expenses: [{ id: 'e1', amountCents: 500, date: '2026-08-05', createdAt: 'a' }],
      billPayments: [
        { id: 'bp1', amountCents: 120000, date: '2026-08-10' },
        { id: 'bp2', amountCents: 999, date: '2026-07-31' }, // outside the range
      ],
      // A bill merely due (not paid) in the range must NOT be counted here — see billsDueCount for that.
      bills: [{ id: 'b1', active: true, paid: false, amountCents: 60000, dueDate: '2026-08-15', recurrence: 'one-time' }],
    };
    const { moneyOutCents } = getPeriodSummary(state, { startDateKey: '2026-08-01', endDateKey: '2026-08-31', now: TODAY });
    assert.equal(moneyOutCents, 500 + 120000);
  });

  test('billsDueCount counts active, unpaid bills whose resolved due date falls in the range', () => {
    const state = {
      bills: [
        { id: 'b1', active: true, paid: false, amountCents: 1, dueDate: '2026-08-25', recurrence: 'one-time' }, // in range
        { id: 'b2', active: true, paid: false, amountCents: 1, dueDate: '2026-09-05', recurrence: 'one-time' }, // out of range
        { id: 'b3', active: true, paid: true, amountCents: 1, dueDate: '2026-08-26', recurrence: 'one-time' }, // paid — excluded
        { id: 'b4', active: false, paid: false, amountCents: 1, dueDate: '2026-08-27', recurrence: 'one-time' }, // inactive — excluded
        { id: 'b5', active: true, paid: false, amountCents: 1, dueDate: null, recurrence: 'one-time' }, // no date — always counts
      ],
    };
    const { billsDueCount } = getPeriodSummary(state, { startDateKey: '2026-08-01', endDateKey: '2026-08-31', now: TODAY });
    assert.equal(billsDueCount, 2); // b1 + b5
  });

  test('an empty state produces zeroed-out, non-throwing figures', () => {
    const { moneyOutCents, billsDueCount } = getPeriodSummary({}, { startDateKey: '2026-08-01', endDateKey: '2026-08-31', now: TODAY });
    assert.equal(moneyOutCents, 0);
    assert.equal(billsDueCount, 0);
  });
});

describe('getUpcomingIncome', () => {
  test('sorts soonest-first, limited to a short list, undated last', () => {
    const state = {
      incomes: [
        { id: 'i1', name: 'Freelance', amountCents: 1, active: true, received: false, frequency: 'one-time', nextDate: null },
        { id: 'i2', name: 'Paycheck', amountCents: 1, active: true, received: false, frequency: 'weekly', nextDate: '2026-08-22' },
        { id: 'i3', name: 'Bonus', amountCents: 1, active: true, received: false, frequency: 'one-time', nextDate: '2026-08-25' },
      ],
    };
    const { items } = getUpcomingIncome(state, { limit: 2 });
    assert.deepEqual(items.map((i) => i.id), ['i2', 'i3']);
  });

  test('excludes a received one-time income, but never a recurring one', () => {
    const state = {
      incomes: [
        { id: 'i1', name: 'Gift', amountCents: 1, active: true, received: true, frequency: 'one-time', nextDate: '2026-08-20' },
        { id: 'i2', name: 'Paycheck', amountCents: 1, active: true, received: true, frequency: 'weekly', nextDate: '2026-08-22' },
      ],
    };
    const { items } = getUpcomingIncome(state);
    assert.deepEqual(items.map((i) => i.id), ['i2']);
  });

  test('excludes inactive income', () => {
    const state = { incomes: [{ id: 'i1', name: 'Old job', amountCents: 1, active: false, received: false, frequency: 'one-time', nextDate: '2026-08-20' }] };
    assert.deepEqual(getUpcomingIncome(state).items, []);
  });

  test('reports how many were left out of the shortlist', () => {
    const state = {
      incomes: [1, 2, 3, 4].map((n) => ({ id: `i${n}`, name: 'x', amountCents: 1, active: true, received: false, frequency: 'one-time', nextDate: `2026-08-2${n}` })),
    };
    const { items, totalCount } = getUpcomingIncome(state, { limit: 3 });
    assert.equal(items.length, 3);
    assert.equal(totalCount, 4);
  });

  test('an empty state produces an empty list', () => {
    assert.deepEqual(getUpcomingIncome({}).items, []);
  });
});

describe('getUpcomingBillsTotalCents', () => {
  test('sums every active, unpaid bill — the summary strip\'s "Total bills" tile', () => {
    const state = { bills: [bill({ id: 'b1', amountCents: 6000 }), bill({ id: 'b2', amountCents: 90000 })] };
    assert.equal(getUpcomingBillsTotalCents(state), 96000);
  });

  test('excludes paid and inactive bills', () => {
    const state = {
      bills: [bill({ id: 'paid', paid: true, amountCents: 999999 }), bill({ id: 'inactive', active: false, amountCents: 999999 }), bill({ id: 'live', amountCents: 500 })],
    };
    assert.equal(getUpcomingBillsTotalCents(state), 500);
  });

  test('is unbounded by due date — unlike getSafeToSpend\'s own upcomingBillsCents, every unpaid bill counts regardless of the payday horizon', () => {
    const state = { bills: [bill({ id: 'far', dueDate: '2099-01-01', amountCents: 1000 })] };
    assert.equal(getUpcomingBillsTotalCents(state), 1000);
  });

  test('skips a corrupted amountCents rather than NaN-poisoning the total', () => {
    const state = { bills: [bill({ id: 'b1', amountCents: 500 }), bill({ id: 'bad', amountCents: 'oops' }), bill({ id: 'negative', amountCents: -100 })] };
    assert.equal(getUpcomingBillsTotalCents(state), 500);
  });

  test('an empty or missing collection is a real $0, not a throw', () => {
    assert.equal(getUpcomingBillsTotalCents({}), 0);
    assert.equal(getUpcomingBillsTotalCents({ bills: [] }), 0);
  });
});
