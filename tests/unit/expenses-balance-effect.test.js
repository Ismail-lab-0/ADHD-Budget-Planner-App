// Tests for src/modules/expenses/balance-effect.js — the pure "how much
// should Current Balance change" logic behind the Current Balance model
// documented in docs/DATA-MODEL.md.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeBalanceDelta } from '../../src/modules/expenses/balance-effect.js';

describe('computeBalanceDelta', () => {
  test('creating an expense produces a negative delta equal to its amount', () => {
    const prev = [];
    const next = [{ id: 'e1', amountCents: 1250 }];
    assert.equal(computeBalanceDelta({ type: 'expenses/create' }, prev, next), -1250);
  });

  test('deleting an expense refunds its amount (positive delta)', () => {
    const prev = [{ id: 'e1', amountCents: 1250 }];
    const next = [];
    assert.equal(computeBalanceDelta({ type: 'expenses/delete', id: 'e1' }, prev, next), 1250);
  });

  test('editing an expense to a larger amount further deducts the increase', () => {
    const prev = [{ id: 'e1', amountCents: 1000 }];
    const next = [{ id: 'e1', amountCents: 1500 }];
    assert.equal(computeBalanceDelta({ type: 'expenses/update', id: 'e1' }, prev, next), -500);
  });

  test('editing an expense to a smaller amount refunds the difference', () => {
    const prev = [{ id: 'e1', amountCents: 1000 }];
    const next = [{ id: 'e1', amountCents: 400 }];
    assert.equal(computeBalanceDelta({ type: 'expenses/update', id: 'e1' }, prev, next), 600);
  });

  test('editing an expense to the same amount produces a zero delta', () => {
    const prev = [{ id: 'e1', amountCents: 1000 }];
    const next = [{ id: 'e1', amountCents: 1000 }];
    assert.equal(computeBalanceDelta({ type: 'expenses/update', id: 'e1' }, prev, next), 0);
  });

  test('a no-op reducer result (same array reference) produces a zero delta', () => {
    const prev = [{ id: 'e1', amountCents: 1000 }];
    assert.equal(computeBalanceDelta({ type: 'expenses/create' }, prev, prev), 0);
  });

  test('an unrecognized action type produces a zero delta', () => {
    const prev = [];
    const next = [{ id: 'e1', amountCents: 1000 }];
    assert.equal(computeBalanceDelta({ type: 'expenses/unknown' }, prev, next), 0);
  });

  describe('corrupted amountCents (Phase 8 — data safety: the reducer validates on create/edit, but a hand-edited or pre-validation localStorage record could still bypass it)', () => {
    test('creating with a corrupted amount (string) contributes 0, not NaN', () => {
      const prev = [];
      const next = [{ id: 'e1', amountCents: 'bad' }];
      assert.equal(computeBalanceDelta({ type: 'expenses/create' }, prev, next), 0);
    });

    test('deleting a corrupted expense refunds 0, not NaN', () => {
      const prev = [{ id: 'e1', amountCents: undefined }];
      const next = [];
      assert.equal(computeBalanceDelta({ type: 'expenses/delete', id: 'e1' }, prev, next), 0);
    });

    test('editing a corrupted expense into a valid one deducts the full new amount, not NaN', () => {
      const prev = [{ id: 'e1', amountCents: null }];
      const next = [{ id: 'e1', amountCents: 800 }];
      assert.equal(computeBalanceDelta({ type: 'expenses/update', id: 'e1' }, prev, next), -800);
    });

    test('editing a valid expense into a corrupted one refunds the full old amount, not NaN', () => {
      const prev = [{ id: 'e1', amountCents: 800 }];
      const next = [{ id: 'e1', amountCents: -5.5 }];
      assert.equal(computeBalanceDelta({ type: 'expenses/update', id: 'e1' }, prev, next), 800);
    });
  });
});
