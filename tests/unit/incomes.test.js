// Tests for the Incomes module (Phase 2 §2): creation, editing, deletion,
// activate/deactivate, and invalid-input handling.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createIncomeAction,
  updateIncomeAction,
  deleteIncomeAction,
  toggleIncomeActiveAction,
  markIncomeReceivedAction,
  incomesReducer,
  getUnreceivedIncomes,
} from '../../src/modules/incomes/index.js';

const NOW = new Date('2026-08-21T09:00:00.000Z');

function seedIncome(overrides) {
  return incomesReducer([], createIncomeAction({ name: 'Paycheck', amountCents: 250000, ...overrides }, { now: NOW }))[0];
}

describe('income creation', () => {
  test('name + amount is enough to create a valid income', () => {
    const action = createIncomeAction({ name: 'Paycheck', amountCents: 250000 }, { now: NOW });
    const incomes = incomesReducer([], action);
    assert.equal(incomes.length, 1);
    assert.equal(incomes[0].name, 'Paycheck');
    assert.equal(incomes[0].amountCents, 250000);
    assert.equal(incomes[0].id.startsWith('inc_'), true);
  });

  test('defaults: frequency one-time, active true, received false, nextDate defaults to today', () => {
    const action = createIncomeAction({ name: 'Gift', amountCents: 5000 }, { now: NOW });
    const [income] = incomesReducer([], action);
    assert.equal(income.frequency, 'one-time');
    assert.equal(income.active, true);
    assert.equal(income.received, false);
    assert.equal(income.nextDate, '2026-08-21');
    assert.equal(income.createdAt, NOW.toISOString());
    assert.equal(income.updatedAt, NOW.toISOString());
  });

  test('an empty or whitespace-only name is refused', () => {
    const action = createIncomeAction({ name: '   ', amountCents: 1000 }, { now: NOW });
    assert.deepEqual(incomesReducer([], action), []);
  });

  test('a missing or invalid amount is refused', () => {
    assert.deepEqual(incomesReducer([], createIncomeAction({ name: 'x', amountCents: undefined }, { now: NOW })), []);
    assert.deepEqual(incomesReducer([], createIncomeAction({ name: 'x', amountCents: -100 }, { now: NOW })), []);
    assert.deepEqual(incomesReducer([], createIncomeAction({ name: 'x', amountCents: 10.5 }, { now: NOW })), []);
  });

  test('an unrecognized frequency falls back to one-time', () => {
    const action = createIncomeAction({ name: 'x', amountCents: 100, frequency: 'yearly' }, { now: NOW });
    const [income] = incomesReducer([], action);
    assert.equal(income.frequency, 'one-time');
  });

  test('weekly/biweekly/monthly frequencies are accepted', () => {
    for (const frequency of ['weekly', 'biweekly', 'monthly']) {
      const [income] = incomesReducer([], createIncomeAction({ name: 'x', amountCents: 100, frequency }, { now: NOW }));
      assert.equal(income.frequency, frequency);
    }
  });
});

describe('income editing', () => {
  test('editable fields apply and updatedAt advances', () => {
    const income = seedIncome();
    const later = new Date('2026-08-22T10:00:00.000Z');
    const [updated] = incomesReducer([income], updateIncomeAction(income.id, { name: 'New job', amountCents: 300000 }, { now: later }));
    assert.equal(updated.name, 'New job');
    assert.equal(updated.amountCents, 300000);
    assert.equal(updated.updatedAt, later.toISOString());
  });

  test('an update cannot change id, active, createdAt', () => {
    const income = seedIncome();
    const [updated] = incomesReducer([income], updateIncomeAction(income.id, { id: 'hacked', active: false, createdAt: 'x' }, { now: NOW }));
    assert.equal(updated.id, income.id);
    assert.equal(updated.active, true);
    assert.equal(updated.createdAt, income.createdAt);
  });

  test('an update cannot blank the name', () => {
    const income = seedIncome();
    const [updated] = incomesReducer([income], updateIncomeAction(income.id, { name: '   ' }, { now: NOW }));
    assert.equal(updated.name, 'Paycheck');
  });

  test('an update with an invalid amount is dropped, not applied', () => {
    const income = seedIncome();
    const [updated] = incomesReducer([income], updateIncomeAction(income.id, { amountCents: -5 }, { now: NOW }));
    assert.equal(updated.amountCents, 250000);
  });

  test('updating a nonexistent id is a no-op (same array reference)', () => {
    const incomes = [seedIncome()];
    assert.equal(incomesReducer(incomes, updateIncomeAction('missing', { name: 'x' }, { now: NOW })), incomes);
  });
});

describe('income deletion', () => {
  test('delete removes the income', () => {
    const income = seedIncome();
    assert.deepEqual(incomesReducer([income], deleteIncomeAction(income.id)), []);
  });

  test('deleting a nonexistent id is a no-op (same array reference)', () => {
    const incomes = [];
    assert.equal(incomesReducer(incomes, deleteIncomeAction('missing')), incomes);
  });
});

describe('activate/deactivate recurring income', () => {
  test('toggle flips active, then flips back', () => {
    const income = seedIncome();
    const [deactivated] = incomesReducer([income], toggleIncomeActiveAction(income.id, { now: NOW }));
    assert.equal(deactivated.active, false);
    const [reactivated] = incomesReducer([deactivated], toggleIncomeActiveAction(income.id, { now: NOW }));
    assert.equal(reactivated.active, true);
  });
});

describe('marking income received (Current Balance model — docs/DATA-MODEL.md)', () => {
  test('a one-time income becomes permanently received: true', () => {
    const income = seedIncome({ frequency: 'one-time' });
    const later = new Date('2026-08-22T10:00:00.000Z');
    const [updated] = incomesReducer([income], markIncomeReceivedAction(income.id, { now: later }));
    assert.equal(updated.received, true);
    assert.equal(updated.nextDate, income.nextDate); // one-time has no "next" cycle to advance
    assert.equal(updated.updatedAt, later.toISOString());
  });

  test('marking an already-received one-time income again is a no-op (same array reference)', () => {
    const income = { ...seedIncome({ frequency: 'one-time' }), received: true };
    const incomes = [income];
    assert.equal(incomesReducer(incomes, markIncomeReceivedAction(income.id, { now: NOW })), incomes);
  });

  test('a recurring income advances nextDate to its next cycle instead of becoming permanently received', () => {
    const income = seedIncome({ frequency: 'weekly', nextDate: '2026-08-21' });
    const [updated] = incomesReducer([income], markIncomeReceivedAction(income.id, { now: NOW }));
    assert.equal(updated.nextDate, '2026-08-28');
    assert.equal(updated.received, false); // never set for recurring — it's "receivable again" via the new date instead
  });

  test('a biweekly/monthly income advances by its own cycle length', () => {
    const biweekly = seedIncome({ frequency: 'biweekly', nextDate: '2026-08-21' });
    assert.equal(incomesReducer([biweekly], markIncomeReceivedAction(biweekly.id, { now: NOW }))[0].nextDate, '2026-09-04');

    const monthly = seedIncome({ frequency: 'monthly', nextDate: '2026-01-31' });
    assert.equal(incomesReducer([monthly], markIncomeReceivedAction(monthly.id, { now: NOW }))[0].nextDate, '2026-02-28');
  });

  test('marking a nonexistent id received is a no-op (same array reference)', () => {
    const incomes = [seedIncome()];
    assert.equal(incomesReducer(incomes, markIncomeReceivedAction('missing', { now: NOW })), incomes);
  });

  test('a recurring income with no nextDate at all is a no-op (nothing to advance from)', () => {
    const income = { ...seedIncome({ frequency: 'weekly' }), nextDate: null };
    const incomes = [income];
    assert.equal(incomesReducer(incomes, markIncomeReceivedAction(income.id, { now: NOW })), incomes);
  });
});

describe('getUnreceivedIncomes', () => {
  test('an active, unreceived one-time income is included', () => {
    const income = { ...seedIncome({ frequency: 'one-time' }), active: true, received: false };
    assert.deepEqual(getUnreceivedIncomes({ incomes: [income] }), [income]);
  });

  test('an active, received one-time income is excluded', () => {
    const income = { ...seedIncome({ frequency: 'one-time' }), active: true, received: true };
    assert.deepEqual(getUnreceivedIncomes({ incomes: [income] }), []);
  });

  test('an inactive income is excluded regardless of received', () => {
    const income = { ...seedIncome({ frequency: 'one-time' }), active: false, received: false };
    assert.deepEqual(getUnreceivedIncomes({ incomes: [income] }), []);
  });

  test('an active recurring income is always included, regardless of "received"', () => {
    const income = { ...seedIncome({ frequency: 'weekly' }), active: true, received: false };
    assert.deepEqual(getUnreceivedIncomes({ incomes: [income] }), [income]);
  });
});
