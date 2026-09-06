// Tests for the Debts module (added ahead of docs/ROADMAP.md's phase
// order at the user's explicit request): CRUD + validation on the
// reducer, the pure derived selectors (progress, next due date, payoff
// estimate, "due soon" rows), and the edge cases from
// docs/DATA-MODEL.md §15.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDebtAction,
  updateDebtAction,
  deleteDebtAction,
  recordDebtPaymentAction,
  debtsReducer,
  getTotalDebtCents,
  getDebtProgress,
  getNextDebtDueDateKey,
  estimatePayoff,
  getUpcomingDebtPayments,
  hasDebtPaymentInMonth,
} from '../../src/modules/debts/index.js';

const NOW = new Date('2026-08-21T09:00:00.000Z');

function seedDebt(overrides) {
  const input = {
    name: 'Visa Card',
    originalBalanceCents: 350000,
    currentBalanceCents: 280000,
    minimumPaymentCents: 10000,
    dueDate: 15,
    interestRate: 19.99,
    paymentFrequency: 'monthly',
    ...overrides,
  };
  return debtsReducer([], createDebtAction(input, { now: NOW }))[0];
}

describe('debt creation', () => {
  test('the required fields are enough to create a valid debt', () => {
    const [debt] = debtsReducer([], createDebtAction({ name: 'Car Loan', originalBalanceCents: 2000000, currentBalanceCents: 1500000, minimumPaymentCents: 35000, dueDate: 20 }, { now: NOW }));
    assert.equal(debt.name, 'Car Loan');
    assert.equal(debt.currentBalanceCents, 1500000);
    assert.equal(debt.id.startsWith('d_'), true);
  });

  test('interestRate is optional — omitting it stores null, not a rejection', () => {
    const [debt] = debtsReducer([], createDebtAction({ name: 'IOU', originalBalanceCents: 5000, currentBalanceCents: 5000, minimumPaymentCents: 1000, dueDate: 1 }, { now: NOW }));
    assert.equal(debt.interestRate, null);
  });

  test('paymentFrequency defaults to monthly and rejects an unknown value', () => {
    const [a] = debtsReducer([], createDebtAction({ name: 'A', originalBalanceCents: 100, currentBalanceCents: 100, minimumPaymentCents: 10, dueDate: 5 }, { now: NOW }));
    assert.equal(a.paymentFrequency, 'monthly');
    const [b] = debtsReducer([], createDebtAction({ name: 'B', originalBalanceCents: 100, currentBalanceCents: 100, minimumPaymentCents: 10, dueDate: 5, paymentFrequency: 'yearly' }, { now: NOW }));
    assert.equal(b.paymentFrequency, 'monthly');
    const [c] = debtsReducer([], createDebtAction({ name: 'C', originalBalanceCents: 100, currentBalanceCents: 100, minimumPaymentCents: 10, dueDate: 5, paymentFrequency: 'weekly' }, { now: NOW }));
    assert.equal(c.paymentFrequency, 'weekly');
  });

  test('missing/invalid required fields are refused (reducer no-op)', () => {
    const base = { name: 'x', originalBalanceCents: 100, currentBalanceCents: 100, minimumPaymentCents: 10, dueDate: 5 };
    assert.deepEqual(debtsReducer([], createDebtAction({ ...base, name: '' }, { now: NOW })), []);
    assert.deepEqual(debtsReducer([], createDebtAction({ ...base, originalBalanceCents: -1 }, { now: NOW })), []);
    assert.deepEqual(debtsReducer([], createDebtAction({ ...base, currentBalanceCents: 1.5 }, { now: NOW })), []);
    assert.deepEqual(debtsReducer([], createDebtAction({ ...base, minimumPaymentCents: undefined }, { now: NOW })), []);
    assert.deepEqual(debtsReducer([], createDebtAction({ ...base, dueDate: 0 }, { now: NOW })), []);
    assert.deepEqual(debtsReducer([], createDebtAction({ ...base, dueDate: 32 }, { now: NOW })), []);
    assert.deepEqual(debtsReducer([], createDebtAction({ ...base, interestRate: -5 }, { now: NOW })), []);
  });

  test('a 0% APR is a valid, accepted rate (not treated as "missing")', () => {
    const [debt] = debtsReducer([], createDebtAction({ name: 'Family loan', originalBalanceCents: 100000, currentBalanceCents: 100000, minimumPaymentCents: 10000, dueDate: 1, interestRate: 0 }, { now: NOW }));
    assert.equal(debt.interestRate, 0);
  });
});

describe('debt editing & deletion', () => {
  test('editable fields apply; id/createdAt cannot be changed', () => {
    const debt = seedDebt();
    const [updated] = debtsReducer([debt], updateDebtAction(debt.id, { name: 'Visa (new)', currentBalanceCents: 260000, id: 'hacked', createdAt: 'x' }, { now: NOW }));
    assert.equal(updated.name, 'Visa (new)');
    assert.equal(updated.currentBalanceCents, 260000);
    assert.equal(updated.id, debt.id);
    assert.equal(updated.createdAt, debt.createdAt);
  });

  test('an invalid edit value is dropped, not applied', () => {
    const debt = seedDebt();
    const [updated] = debtsReducer([debt], updateDebtAction(debt.id, { currentBalanceCents: -1, dueDate: 99 }, { now: NOW }));
    assert.equal(updated.currentBalanceCents, 280000);
    assert.equal(updated.dueDate, 15);
  });

  test('delete removes the debt', () => {
    const debt = seedDebt();
    assert.deepEqual(debtsReducer([debt], deleteDebtAction(debt.id)), []);
  });
});

describe('recordDebtPaymentAction on the debts slice', () => {
  test('reduces currentBalanceCents by the payment amount', () => {
    const debt = seedDebt();
    const [paid] = debtsReducer([debt], recordDebtPaymentAction(debt.id, { amountCents: 15000 }, { now: NOW }));
    assert.equal(paid.currentBalanceCents, 265000);
  });

  test('never lets currentBalanceCents go negative — an over-payment clamps at 0', () => {
    const debt = seedDebt({ currentBalanceCents: 5000 });
    const [paid] = debtsReducer([debt], recordDebtPaymentAction(debt.id, { amountCents: 100000 }, { now: NOW }));
    assert.equal(paid.currentBalanceCents, 0);
  });

  test('a payment against an already-$0 debt is a no-op (same array reference)', () => {
    const debt = seedDebt({ currentBalanceCents: 0 });
    const debts = [debt];
    assert.equal(debtsReducer(debts, recordDebtPaymentAction(debt.id, { amountCents: 5000 }, { now: NOW })), debts);
  });

  test('a $0 or invalid payment amount is a no-op', () => {
    const debt = seedDebt();
    const debts = [debt];
    assert.equal(debtsReducer(debts, recordDebtPaymentAction(debt.id, { amountCents: 0 }, { now: NOW })), debts);
    assert.equal(debtsReducer(debts, recordDebtPaymentAction(debt.id, { amountCents: 'bad' }, { now: NOW })), debts);
  });

  test('decimal payment amounts work (they arrive as integer cents from the form)', () => {
    const debt = seedDebt();
    const [paid] = debtsReducer([debt], recordDebtPaymentAction(debt.id, { amountCents: 12550 }, { now: NOW }));
    assert.equal(paid.currentBalanceCents, 280000 - 12550);
  });
});

describe('getTotalDebtCents', () => {
  test('sums every debt current balance', () => {
    const state = { debts: [seedDebt({ currentBalanceCents: 280000 }), seedDebt({ name: 'Loan', currentBalanceCents: 462000 })] };
    assert.equal(getTotalDebtCents(state), 742000);
  });

  test('is 0 with no debts, and skips a corrupted balance rather than NaN-poisoning', () => {
    assert.equal(getTotalDebtCents({ debts: [] }), 0);
    assert.equal(getTotalDebtCents({}), 0);
    assert.equal(getTotalDebtCents({ debts: [{ currentBalanceCents: 'x' }, { currentBalanceCents: 5000 }] }), 5000);
  });
});

describe('getDebtProgress', () => {
  test('percent paid = (original - current) / original, clamped 0..100', () => {
    assert.equal(Math.round(getDebtProgress({ originalBalanceCents: 350000, currentBalanceCents: 280000 }).percentPaid), 20);
    assert.equal(getDebtProgress({ originalBalanceCents: 100000, currentBalanceCents: 0 }).percentPaid, 100);
    assert.equal(getDebtProgress({ originalBalanceCents: 100000, currentBalanceCents: 100000 }).percentPaid, 0);
  });

  test('a current balance above the original (edited up) clamps to 0%, not negative', () => {
    assert.equal(getDebtProgress({ originalBalanceCents: 100000, currentBalanceCents: 150000 }).percentPaid, 0);
  });

  test('isPaidOff is true exactly when the current balance is 0 or less', () => {
    assert.equal(getDebtProgress({ originalBalanceCents: 100000, currentBalanceCents: 0 }).isPaidOff, true);
    assert.equal(getDebtProgress({ originalBalanceCents: 100000, currentBalanceCents: 1 }).isPaidOff, false);
  });

  test('a 0 original balance does not divide-by-zero', () => {
    assert.equal(getDebtProgress({ originalBalanceCents: 0, currentBalanceCents: 0 }).percentPaid, 100);
    assert.equal(getDebtProgress({ originalBalanceCents: 0, currentBalanceCents: 5000 }).percentPaid, 0);
  });
});

describe('getNextDebtDueDateKey', () => {
  test('returns this month when the due day is still ahead', () => {
    assert.equal(getNextDebtDueDateKey({ dueDate: 25 }, new Date('2026-08-21T12:00:00')), '2026-08-25');
  });

  test('rolls to next month when the due day has passed', () => {
    assert.equal(getNextDebtDueDateKey({ dueDate: 5 }, new Date('2026-08-21T12:00:00')), '2026-09-05');
  });

  test('due day today counts as today (not next month)', () => {
    assert.equal(getNextDebtDueDateKey({ dueDate: 21 }, new Date('2026-08-21T12:00:00')), '2026-08-21');
  });

  test('a "31st" debt clamps to the last day of a short month', () => {
    assert.equal(getNextDebtDueDateKey({ dueDate: 31 }, new Date('2026-02-15T12:00:00')), '2026-02-28');
  });

  test('an invalid due day yields null', () => {
    assert.equal(getNextDebtDueDateKey({ dueDate: 0 }, NOW), null);
    assert.equal(getNextDebtDueDateKey({}, NOW), null);
  });
});

describe('estimatePayoff', () => {
  test('null when no APR is provided (§9 — no fragile guesswork without a rate)', () => {
    assert.equal(estimatePayoff({ currentBalanceCents: 280000, minimumPaymentCents: 10000, interestRate: null }, { now: NOW }), null);
  });

  test('null when the debt is already paid off or has no payment set', () => {
    assert.equal(estimatePayoff({ currentBalanceCents: 0, minimumPaymentCents: 10000, interestRate: 10 }, { now: NOW }), null);
    assert.equal(estimatePayoff({ currentBalanceCents: 10000, minimumPaymentCents: 0, interestRate: 10 }, { now: NOW }), null);
  });

  test('0% APR falls back to simple division (ceil)', () => {
    const est = estimatePayoff({ currentBalanceCents: 100000, minimumPaymentCents: 30000, interestRate: 0, paymentFrequency: 'monthly' }, { now: NOW });
    assert.equal(est.months, 4); // ceil(100000 / 30000)
    assert.equal(est.coversInterest, true);
    assert.ok(est.payoffDateKey);
  });

  test('a normal APR produces a finite, plausible month count and a payoff date', () => {
    const est = estimatePayoff({ currentBalanceCents: 280000, minimumPaymentCents: 10000, interestRate: 19.99, paymentFrequency: 'monthly' }, { now: NOW });
    assert.ok(est.months > 0 && est.months < 60);
    assert.equal(est.coversInterest, true);
    assert.match(est.payoffDateKey, /^\d{4}-\d{2}-\d{2}$/);
  });

  test('a payment that does not cover one month of interest is flagged, not shown as an impossible date', () => {
    const est = estimatePayoff({ currentBalanceCents: 1000000, minimumPaymentCents: 100, interestRate: 24, paymentFrequency: 'monthly' }, { now: NOW });
    assert.equal(est.coversInterest, false);
    assert.equal(est.months, null);
    assert.equal(est.payoffDateKey, null);
  });
});

describe('getUpcomingDebtPayments', () => {
  test('one row per debt with a balance, carrying its minimum payment and next due date', () => {
    const state = { debts: [seedDebt({ dueDate: 25 })], debtPayments: [] };
    const rows = getUpcomingDebtPayments(state, { now: new Date('2026-08-21T12:00:00') });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].amountCents, 10000);
    assert.equal(rows[0].date, '2026-08-25');
    assert.equal(rows[0].alreadyPaidThisPeriod, false);
  });

  test('a paid-off debt ($0 balance) is excluded', () => {
    const state = { debts: [seedDebt({ currentBalanceCents: 0 })], debtPayments: [] };
    assert.deepEqual(getUpcomingDebtPayments(state, { now: NOW }), []);
  });

  test('alreadyPaidThisPeriod is true once a payment is logged in the current month', () => {
    const debt = seedDebt();
    const state = { debts: [debt], debtPayments: [{ debtId: debt.id, date: '2026-08-03' }] };
    assert.equal(getUpcomingDebtPayments(state, { now: NOW })[0].alreadyPaidThisPeriod, true);
    assert.equal(hasDebtPaymentInMonth(state, debt.id, NOW), true);
    // A payment in a different month doesn't count.
    const stale = { debts: [debt], debtPayments: [{ debtId: debt.id, date: '2026-07-03' }] };
    assert.equal(hasDebtPaymentInMonth(stale, debt.id, NOW), false);
  });
});
