// Tests for the Budget module (Phase 2 §1, §5): Current Balance, Savings
// allocation — single-value figures, not lists. (Safety Buffer, formerly
// §6 here, was removed at the user's request — see docs/SAFE-TO-SPEND.md
// §9 — and has no test coverage left for the same reason it needed no
// migration: nothing in the app reads it anymore.)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  setCurrentBalanceAction,
  setSavingsAllocationAction,
  addToSavingsAction,
  budgetReducer,
  createEmptyBudget,
  getCurrentBalanceCents,
  getSavingsAllocationCents,
} from '../../src/modules/budget/index.js';

describe('current balance', () => {
  test('starts at zero', () => {
    assert.equal(createEmptyBudget().currentBalanceCents, 0);
  });

  test('set updates the value', () => {
    const budget = budgetReducer(createEmptyBudget(), setCurrentBalanceAction(245000));
    assert.equal(budget.currentBalanceCents, 245000);
  });

  test('setting to the same value is a no-op (same reference)', () => {
    const budget = budgetReducer(createEmptyBudget(), setCurrentBalanceAction(245000));
    assert.equal(budgetReducer(budget, setCurrentBalanceAction(245000)), budget);
  });

  test('a non-integer amount is rejected, but a negative one is accepted (see docs/DATA-MODEL.md "Current Balance model")', () => {
    const budget = createEmptyBudget();
    assert.equal(budgetReducer(budget, setCurrentBalanceAction(10.5)), budget);
    const negative = budgetReducer(budget, setCurrentBalanceAction(-4000));
    assert.equal(negative.currentBalanceCents, -4000);
  });

  test('getCurrentBalanceCents reads the value, defaulting to 0 if budget is missing', () => {
    assert.equal(getCurrentBalanceCents({ budget: { currentBalanceCents: 245000 } }), 245000);
    assert.equal(getCurrentBalanceCents({}), 0);
  });
});

describe('savings allocation', () => {
  test('set updates the value and leaves the rest of the budget untouched', () => {
    const budget = budgetReducer(createEmptyBudget(), setCurrentBalanceAction(100000));
    const next = budgetReducer(budget, setSavingsAllocationAction(20000));
    assert.equal(next.savingsAllocationCents, 20000);
    assert.equal(next.currentBalanceCents, 100000);
  });

  test('getSavingsAllocationCents reads the value', () => {
    assert.equal(getSavingsAllocationCents({ budget: { savingsAllocationCents: 5000 } }), 5000);
  });

  test('unlike Current Balance, a negative savings amount is rejected — it is a reserved magnitude, not a balance', () => {
    const budget = createEmptyBudget();
    assert.equal(budgetReducer(budget, setSavingsAllocationAction(-100)), budget);
  });
});

describe('adding to savings (the Savings card\'s own action — accumulates, never replaces)', () => {
  test('adds to an existing allocation instead of replacing it', () => {
    const budget = budgetReducer(createEmptyBudget(), setSavingsAllocationAction(20000));
    const next = budgetReducer(budget, addToSavingsAction(5000));
    assert.equal(next.savingsAllocationCents, 25000);
  });

  test('adding twice accumulates both contributions', () => {
    let budget = createEmptyBudget();
    budget = budgetReducer(budget, addToSavingsAction(10000));
    budget = budgetReducer(budget, addToSavingsAction(2500));
    assert.equal(budget.savingsAllocationCents, 12500);
  });

  test('adding from zero works the same as setting it', () => {
    const budget = budgetReducer(createEmptyBudget(), addToSavingsAction(30000));
    assert.equal(budget.savingsAllocationCents, 30000);
  });

  test('leaves the rest of the budget untouched', () => {
    const budget = budgetReducer(createEmptyBudget(), setCurrentBalanceAction(100000));
    const next = budgetReducer(budget, addToSavingsAction(5000));
    assert.equal(next.currentBalanceCents, 100000);
  });

  test('a negative amount is rejected (a contribution can\'t be negative)', () => {
    const budget = budgetReducer(createEmptyBudget(), setSavingsAllocationAction(20000));
    assert.equal(budgetReducer(budget, addToSavingsAction(-500)), budget);
  });

  test('a non-integer amount is rejected', () => {
    const budget = budgetReducer(createEmptyBudget(), setSavingsAllocationAction(20000));
    assert.equal(budgetReducer(budget, addToSavingsAction(10.5)), budget);
  });

  test('adding exactly $0 is a no-op (same reference), not a $0 contribution', () => {
    const budget = budgetReducer(createEmptyBudget(), setSavingsAllocationAction(20000));
    assert.equal(budgetReducer(budget, addToSavingsAction(0)), budget);
  });

  test('a corrupted existing savingsAllocationCents (hand-edited/pre-validation localStorage data) is treated as 0 rather than NaN-poisoning the total', () => {
    const budget = { currentBalanceCents: 0, savingsAllocationCents: 'bad' };
    const next = budgetReducer(budget, addToSavingsAction(5000));
    assert.equal(next.savingsAllocationCents, 5000);
  });
});
