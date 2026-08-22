// Tests for the Bills module (Phase 2 §3): creation, editing, deletion,
// mark paid/unpaid, activate/deactivate, invalid-input handling.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createBillAction, updateBillAction, deleteBillAction, toggleBillActiveAction, toggleBillPaidAction, billsReducer } from '../../src/modules/bills/index.js';

const NOW = new Date('2026-08-21T09:00:00.000Z');

function seedBill(overrides) {
  return billsReducer([], createBillAction({ name: 'Rent', amountCents: 120000, ...overrides }, { now: NOW }))[0];
}

describe('bill creation', () => {
  test('name + amount is enough to create a valid bill', () => {
    const [bill] = billsReducer([], createBillAction({ name: 'Rent', amountCents: 120000 }, { now: NOW }));
    assert.equal(bill.name, 'Rent');
    assert.equal(bill.amountCents, 120000);
    assert.equal(bill.id.startsWith('b_'), true);
  });

  test('defaults: recurrence one-time, active true, paid false, dueDate defaults to today', () => {
    const [bill] = billsReducer([], createBillAction({ name: 'Water', amountCents: 4000 }, { now: NOW }));
    assert.equal(bill.recurrence, 'one-time');
    assert.equal(bill.active, true);
    assert.equal(bill.paid, false);
    assert.equal(bill.dueDate, '2026-08-21');
  });

  test('an empty name or invalid amount is refused', () => {
    assert.deepEqual(billsReducer([], createBillAction({ name: '', amountCents: 100 }, { now: NOW })), []);
    assert.deepEqual(billsReducer([], createBillAction({ name: 'x', amountCents: -1 }, { now: NOW })), []);
    assert.deepEqual(billsReducer([], createBillAction({ name: 'x', amountCents: 1.5 }, { now: NOW })), []);
  });

  test('an unrecognized recurrence falls back to one-time', () => {
    const [bill] = billsReducer([], createBillAction({ name: 'x', amountCents: 100, recurrence: 'yearly' }, { now: NOW }));
    assert.equal(bill.recurrence, 'one-time');
  });

  test('weekly/monthly recurrence is accepted', () => {
    for (const recurrence of ['weekly', 'monthly']) {
      const [bill] = billsReducer([], createBillAction({ name: 'x', amountCents: 100, recurrence }, { now: NOW }));
      assert.equal(bill.recurrence, recurrence);
    }
  });
});

describe('bill editing', () => {
  test('editable fields apply and updatedAt advances', () => {
    const bill = seedBill();
    const later = new Date('2026-08-22T10:00:00.000Z');
    const [updated] = billsReducer([bill], updateBillAction(bill.id, { name: 'Rent increase', amountCents: 130000 }, { now: later }));
    assert.equal(updated.name, 'Rent increase');
    assert.equal(updated.amountCents, 130000);
    assert.equal(updated.updatedAt, later.toISOString());
  });

  test('an update cannot change id, active, paid, createdAt', () => {
    const bill = seedBill();
    const [updated] = billsReducer([bill], updateBillAction(bill.id, { id: 'hacked', active: false, paid: true, createdAt: 'x' }, { now: NOW }));
    assert.equal(updated.id, bill.id);
    assert.equal(updated.active, true);
    assert.equal(updated.paid, false);
    assert.equal(updated.createdAt, bill.createdAt);
  });

  test('an update cannot blank the name or apply an invalid amount', () => {
    const bill = seedBill();
    const [updated] = billsReducer([bill], updateBillAction(bill.id, { name: '  ', amountCents: -5 }, { now: NOW }));
    assert.equal(updated.name, 'Rent');
    assert.equal(updated.amountCents, 120000);
  });

  test('updating a nonexistent id is a no-op (same array reference)', () => {
    const bills = [seedBill()];
    assert.equal(billsReducer(bills, updateBillAction('missing', { name: 'x' }, { now: NOW })), bills);
  });
});

describe('bill deletion', () => {
  test('delete removes the bill', () => {
    const bill = seedBill();
    assert.deepEqual(billsReducer([bill], deleteBillAction(bill.id)), []);
  });

  test('deleting a nonexistent id is a no-op', () => {
    const bills = [];
    assert.equal(billsReducer(bills, deleteBillAction('missing')), bills);
  });
});

describe('mark paid/unpaid', () => {
  test('toggle flips paid, then flips back', () => {
    const bill = seedBill();
    const [paid] = billsReducer([bill], toggleBillPaidAction(bill.id, { now: NOW }));
    assert.equal(paid.paid, true);
    const [unpaid] = billsReducer([paid], toggleBillPaidAction(bill.id, { now: NOW }));
    assert.equal(unpaid.paid, false);
  });
});

describe('activate/deactivate', () => {
  test('toggle flips active independently of paid', () => {
    const bill = seedBill();
    const [deactivated] = billsReducer([bill], toggleBillActiveAction(bill.id, { now: NOW }));
    assert.equal(deactivated.active, false);
    assert.equal(deactivated.paid, false);
  });
});
