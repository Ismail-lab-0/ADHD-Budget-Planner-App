// Tests for the Bill Payments module — the historical log of confirmed
// bill payments (docs/DATA-MODEL.md "BillPayment"), created/un-created
// automatically whenever a Bill is marked paid/unpaid (see
// tests/unit/main.test.js / tests/unit/dashboard-integration.test.js for
// the real cross-slice wiring in src/main.js's rootReducer). Mirrors
// tests/unit/income-receipts.test.js's structure.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createBillPayment, getAllBillPayments, getBillPaymentsForPeriod, getBillPaymentsTotalCents } from '../../src/modules/bill-payments/index.js';

const NOW = new Date(2026, 7, 21, 9, 0); // Friday, August 21, 2026, 9am

describe('createBillPayment', () => {
  test('builds a payment carrying the bill\'s amount/name and today\'s date', () => {
    const bill = { id: 'b_1', name: 'Rent', amountCents: 120000 };
    const payment = createBillPayment(bill, NOW);
    assert.equal(payment.billId, 'b_1');
    assert.equal(payment.name, 'Rent');
    assert.equal(payment.amountCents, 120000);
    assert.equal(payment.date, '2026-08-21');
    assert.equal(payment.createdAt, NOW.toISOString());
    assert.ok(payment.id.startsWith('bp_'));
  });

  test('two payments created back to back get distinct ids', () => {
    const bill = { id: 'b_1', name: 'Rent', amountCents: 120000 };
    const p1 = createBillPayment(bill, NOW);
    const p2 = createBillPayment(bill, NOW);
    assert.notEqual(p1.id, p2.id);
  });

  test('a missing bill produces no payment', () => {
    assert.equal(createBillPayment(undefined, NOW), null);
    assert.equal(createBillPayment(null, NOW), null);
  });

  test('a corrupted amountCents (hand-edited/pre-validation localStorage data) produces no payment, not a NaN one', () => {
    assert.equal(createBillPayment({ id: 'b_1', name: 'x', amountCents: 'bad' }, NOW), null);
    assert.equal(createBillPayment({ id: 'b_1', name: 'x', amountCents: -100 }, NOW), null);
  });
});

describe('getAllBillPayments', () => {
  test('reads the stored collection', () => {
    const payments = [{ id: 'bp1' }];
    assert.equal(getAllBillPayments({ billPayments: payments }), payments);
  });

  test('tolerates a missing or corrupted collection, returning []', () => {
    assert.deepEqual(getAllBillPayments({}), []);
    assert.deepEqual(getAllBillPayments({ billPayments: 'not an array' }), []);
  });
});

describe('getBillPaymentsForPeriod', () => {
  const state = {
    billPayments: [
      { id: 'bp1', amountCents: 1000, date: '2026-07-15' },
      { id: 'bp2', amountCents: 2000, date: '2026-08-01' },
      { id: 'bp3', amountCents: 3000, date: '2026-08-21' },
      { id: 'bp4', amountCents: 4000, date: '2026-09-01' },
    ],
  };

  test('filters to an inclusive [startDateKey, endDateKey] range', () => {
    const result = getBillPaymentsForPeriod(state, { startDateKey: '2026-08-01', endDateKey: '2026-08-31' });
    assert.deepEqual(result.map((p) => p.id), ['bp2', 'bp3']);
  });

  test('an unbounded end (null) includes everything on/after the start', () => {
    const result = getBillPaymentsForPeriod(state, { startDateKey: '2026-08-01', endDateKey: null });
    assert.deepEqual(result.map((p) => p.id), ['bp2', 'bp3', 'bp4']);
  });

  test('no bounds at all returns every payment', () => {
    assert.equal(getBillPaymentsForPeriod(state, {}).length, 4);
  });

  test('a payment with no date is excluded from any bounded query', () => {
    const result = getBillPaymentsForPeriod({ billPayments: [{ id: 'bp1', amountCents: 100, date: null }] }, { startDateKey: '2026-01-01' });
    assert.deepEqual(result, []);
  });
});

describe('getBillPaymentsTotalCents', () => {
  test('sums amounts across a list', () => {
    assert.equal(getBillPaymentsTotalCents([{ amountCents: 500 }, { amountCents: 1250 }]), 1750);
  });

  test('is 0 for an empty list', () => {
    assert.equal(getBillPaymentsTotalCents([]), 0);
  });

  test('skips a corrupted amountCents rather than NaN-poisoning the total', () => {
    assert.equal(getBillPaymentsTotalCents([{ amountCents: 500 }, { amountCents: 'bad' }, { amountCents: -100 }]), 500);
  });

  test('tolerates a non-array input, returning 0', () => {
    assert.equal(getBillPaymentsTotalCents(null), 0);
    assert.equal(getBillPaymentsTotalCents(undefined), 0);
  });
});
