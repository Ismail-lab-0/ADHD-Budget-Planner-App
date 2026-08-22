// Tests for src/modules/bills/balance-effect.js — the pure "how much
// should Current Balance change" logic behind marking a Bill paid/unpaid
// (docs/DATA-MODEL.md "Current Balance model"). Mirrors
// tests/unit/expenses-balance-effect.test.js /
// tests/unit/incomes-balance-effect.test.js's structure. Regression
// coverage for a real reported bug: marking a bill paid used to remove it
// from Safe-to-Spend's upcomingBillsCents subtraction without ever
// debiting the balance, so the amount appeared to "come back."

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeBillBalanceDelta } from '../../src/modules/bills/balance-effect.js';

describe('computeBillBalanceDelta', () => {
  test('marking a bill paid debits its amount (negative delta)', () => {
    const prev = [{ id: 'b1', amountCents: 120000, paid: false }];
    const next = [{ id: 'b1', amountCents: 120000, paid: true }];
    assert.equal(computeBillBalanceDelta({ type: 'bills/toggle', field: 'paid', id: 'b1' }, prev, next), -120000);
  });

  test('un-marking a paid bill (toggling back to unpaid) refunds it (positive delta)', () => {
    const prev = [{ id: 'b1', amountCents: 120000, paid: true }];
    const next = [{ id: 'b1', amountCents: 120000, paid: false }];
    assert.equal(computeBillBalanceDelta({ type: 'bills/toggle', field: 'paid', id: 'b1' }, prev, next), 120000);
  });

  test('a no-op reducer result (same array reference — unknown id) produces a zero delta', () => {
    const prev = [{ id: 'b1', amountCents: 120000, paid: false }];
    assert.equal(computeBillBalanceDelta({ type: 'bills/toggle', field: 'paid', id: 'b1' }, prev, prev), 0);
  });

  test('toggling "active" (not "paid") produces a zero delta — only the paid toggle touches the balance', () => {
    const prev = [{ id: 'b1', amountCents: 120000, active: true }];
    const next = [{ id: 'b1', amountCents: 120000, active: false }];
    assert.equal(computeBillBalanceDelta({ type: 'bills/toggle', field: 'active', id: 'b1' }, prev, next), 0);
  });

  test('an unrelated action type produces a zero delta, even if the slice changed', () => {
    const prev = [{ id: 'b1', amountCents: 120000 }];
    const next = [{ id: 'b1', amountCents: 150000 }];
    assert.equal(computeBillBalanceDelta({ type: 'bills/update', id: 'b1' }, prev, next), 0);
  });

  test('a corrupted amountCents (hand-edited/pre-validation localStorage data) contributes 0, not NaN', () => {
    const prev = [{ id: 'b1', amountCents: 'bad', paid: false }];
    const next = [{ id: 'b1', amountCents: 'bad', paid: true }];
    assert.equal(computeBillBalanceDelta({ type: 'bills/toggle', field: 'paid', id: 'b1' }, prev, next), 0);
  });

  test('an id with no matching entry in nextBills contributes 0', () => {
    const prev = [{ id: 'b1', amountCents: 120000, paid: false }];
    const next = [];
    assert.equal(computeBillBalanceDelta({ type: 'bills/toggle', field: 'paid', id: 'b1' }, prev, next), 0);
  });
});
