// Tests for src/modules/incomes/balance-effect.js — the pure "how much
// should Current Balance change" logic behind confirming an Income as
// received (docs/DATA-MODEL.md "Current Balance model"). Mirrors
// tests/unit/expenses-balance-effect.test.js's structure.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeIncomeBalanceDelta } from '../../src/modules/incomes/balance-effect.js';

describe('computeIncomeBalanceDelta', () => {
  test('marking an income received credits its amount (positive delta)', () => {
    const prev = [{ id: 'i1', amountCents: 250000 }];
    const next = [{ id: 'i1', amountCents: 250000, received: true }];
    assert.equal(computeIncomeBalanceDelta({ type: 'incomes/mark-received', id: 'i1' }, prev, next), 250000);
  });

  test('a no-op reducer result (same array reference — already received, or unknown id) produces a zero delta', () => {
    const prev = [{ id: 'i1', amountCents: 250000, received: true }];
    assert.equal(computeIncomeBalanceDelta({ type: 'incomes/mark-received', id: 'i1' }, prev, prev), 0);
  });

  test('an unrelated action type produces a zero delta, even if the slice changed', () => {
    const prev = [{ id: 'i1', amountCents: 250000 }];
    const next = [{ id: 'i1', amountCents: 300000 }];
    assert.equal(computeIncomeBalanceDelta({ type: 'incomes/update', id: 'i1' }, prev, next), 0);
  });

  test('a corrupted amountCents (hand-edited/pre-validation localStorage data) contributes 0, not NaN', () => {
    const prev = [{ id: 'i1', amountCents: 'bad' }];
    const next = [{ id: 'i1', amountCents: 'bad', received: true }];
    assert.equal(computeIncomeBalanceDelta({ type: 'incomes/mark-received', id: 'i1' }, prev, next), 0);
  });

  test('an id with no matching entry in prevIncomes contributes 0', () => {
    const prev = [];
    const next = [{ id: 'i1', amountCents: 250000, received: true }];
    assert.equal(computeIncomeBalanceDelta({ type: 'incomes/mark-received', id: 'i1' }, prev, next), 0);
  });
});
