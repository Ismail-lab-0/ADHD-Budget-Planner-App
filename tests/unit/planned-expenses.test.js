// Tests for the Planned Expenses module (Phase 2 §4): creation, editing,
// deletion, invalid-input handling.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createPlannedExpenseAction, updatePlannedExpenseAction, deletePlannedExpenseAction, plannedExpensesReducer } from '../../src/modules/planned-expenses/index.js';

const NOW = new Date('2026-08-21T09:00:00.000Z');

function seedPlannedExpense(overrides) {
  return plannedExpensesReducer([], createPlannedExpenseAction({ name: 'Car repair', amountCents: 30000, ...overrides }, { now: NOW }))[0];
}

describe('planned expense creation', () => {
  test('name + amount is enough to create a valid planned expense', () => {
    const [expense] = plannedExpensesReducer([], createPlannedExpenseAction({ name: 'Car repair', amountCents: 30000 }, { now: NOW }));
    assert.equal(expense.name, 'Car repair');
    assert.equal(expense.amountCents, 30000);
    assert.equal(expense.id.startsWith('pe_'), true);
  });

  test('defaults: plannedDate/category/notes null when omitted', () => {
    const [expense] = plannedExpensesReducer([], createPlannedExpenseAction({ name: 'x', amountCents: 100 }, { now: NOW }));
    assert.equal(expense.plannedDate, null);
    assert.equal(expense.category, null);
    assert.equal(expense.notes, null);
    assert.equal(expense.createdAt, NOW.toISOString());
    assert.equal(expense.updatedAt, NOW.toISOString());
  });

  test('optional fields are stored when given', () => {
    const [expense] = plannedExpensesReducer(
      [],
      createPlannedExpenseAction({ name: 'x', amountCents: 100, plannedDate: '2026-09-01', category: 'car', notes: 'brakes' }, { now: NOW })
    );
    assert.equal(expense.plannedDate, '2026-09-01');
    assert.equal(expense.category, 'car');
    assert.equal(expense.notes, 'brakes');
  });

  test('an empty name or invalid amount is refused', () => {
    assert.deepEqual(plannedExpensesReducer([], createPlannedExpenseAction({ name: '   ', amountCents: 100 }, { now: NOW })), []);
    assert.deepEqual(plannedExpensesReducer([], createPlannedExpenseAction({ name: 'x', amountCents: -1 }, { now: NOW })), []);
    assert.deepEqual(plannedExpensesReducer([], createPlannedExpenseAction({ name: 'x', amountCents: 1.23 }, { now: NOW })), []);
  });
});

describe('planned expense editing', () => {
  test('editable fields apply and updatedAt advances', () => {
    const expense = seedPlannedExpense();
    const later = new Date('2026-08-22T10:00:00.000Z');
    const [updated] = plannedExpensesReducer(
      [expense],
      updatePlannedExpenseAction(expense.id, { name: 'Bigger repair', amountCents: 50000, category: 'car' }, { now: later })
    );
    assert.equal(updated.name, 'Bigger repair');
    assert.equal(updated.amountCents, 50000);
    assert.equal(updated.category, 'car');
    assert.equal(updated.updatedAt, later.toISOString());
  });

  test('an update cannot change id or createdAt', () => {
    const expense = seedPlannedExpense();
    const [updated] = plannedExpensesReducer([expense], updatePlannedExpenseAction(expense.id, { id: 'hacked', createdAt: 'x' }, { now: NOW }));
    assert.equal(updated.id, expense.id);
    assert.equal(updated.createdAt, expense.createdAt);
  });

  test('an update cannot blank the name or apply an invalid amount', () => {
    const expense = seedPlannedExpense();
    const [updated] = plannedExpensesReducer([expense], updatePlannedExpenseAction(expense.id, { name: ' ', amountCents: -1 }, { now: NOW }));
    assert.equal(updated.name, 'Car repair');
    assert.equal(updated.amountCents, 30000);
  });

  test('updating a nonexistent id is a no-op (same array reference)', () => {
    const expenses = [seedPlannedExpense()];
    assert.equal(plannedExpensesReducer(expenses, updatePlannedExpenseAction('missing', { name: 'x' }, { now: NOW })), expenses);
  });
});

describe('planned expense deletion', () => {
  test('delete removes the planned expense', () => {
    const expense = seedPlannedExpense();
    assert.deepEqual(plannedExpensesReducer([expense], deletePlannedExpenseAction(expense.id)), []);
  });

  test('deleting a nonexistent id is a no-op', () => {
    const expenses = [];
    assert.equal(plannedExpensesReducer(expenses, deletePlannedExpenseAction('missing')), expenses);
  });
});
