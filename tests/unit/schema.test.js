import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CURRENT_SCHEMA_VERSION, createEmptyState, migrate } from '../../src/core/schema.js';

describe('createEmptyState', () => {
  test('is stamped with the current schema version', () => {
    assert.equal(createEmptyState().schemaVersion, CURRENT_SCHEMA_VERSION);
  });

  test('has every top-level collection empty, budget figures at zero, and settings at their defaults', () => {
    const state = createEmptyState();
    assert.deepEqual(state.incomes, []);
    assert.deepEqual(state.bills, []);
    assert.deepEqual(state.plannedExpenses, []);
    assert.deepEqual(state.budget, { currentBalanceCents: 0, savingsAllocationCents: 0 });
    assert.equal(state.settings.theme, 'system');
    assert.equal(state.settings.onboardingCompletedAt, null);
  });
});

describe('migrate', () => {
  test('state already at the current version passes through unchanged (aside from the version stamp)', () => {
    const state = createEmptyState();
    const migrated = migrate(state);
    assert.deepEqual(migrated, state);
  });

  test('runs every migration between the stored version and current, in ascending order', () => {
    const calls = [];
    const migrationTable = {
      2: (s) => {
        calls.push(2);
        return { ...s, v2Field: 'added-by-v2' };
      },
      3: (s) => {
        calls.push(3);
        return { ...s, v3Field: 'added-by-v3' };
      },
    };

    const migrated = migrate(
      { schemaVersion: 1, tasks: [] },
      { migrations: migrationTable, currentVersion: 3 }
    );

    assert.deepEqual(calls, [2, 3]);
    assert.equal(migrated.v2Field, 'added-by-v2');
    assert.equal(migrated.v3Field, 'added-by-v3');
    assert.equal(migrated.schemaVersion, 3);
  });

  test('skips versions with no registered migration step', () => {
    const migrationTable = {
      3: (s) => ({ ...s, jumped: true }),
    };
    const migrated = migrate({ schemaVersion: 1 }, { migrations: migrationTable, currentVersion: 3 });
    assert.equal(migrated.jumped, true);
    assert.equal(migrated.schemaVersion, 3);
  });

  test('treats a missing schemaVersion as version 0 and migrates forward', () => {
    const migrationTable = { 1: (s) => ({ ...s, migratedFromZero: true }) };
    const migrated = migrate({ tasks: [] }, { migrations: migrationTable, currentVersion: 1 });
    assert.equal(migrated.migratedFromZero, true);
    assert.equal(migrated.schemaVersion, 1);
  });

  test('throws when the stored version is newer than what this build supports', () => {
    assert.throws(() => migrate({ schemaVersion: 99 }, { currentVersion: 1 }), /newer than supported version/);
  });
});

describe('the real v2 -> v3 migration (product pivot)', () => {
  test('a v2 (task-oriented) state migrates to the v3 (budget-oriented) shape without throwing', () => {
    const v2State = {
      schemaVersion: 2,
      meta: { createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: '2026-01-01T00:00:00.000Z' },
      settings: { onboardingCompletedAt: null, displayName: 'Alex', payScheduleHint: 'every other Friday', theme: 'dark', reducedMotion: true },
      tasks: [{ id: 't_1', title: 'Old task', status: 'todo' }],
      routines: { templates: [], instances: [] },
      calendarEvents: [],
      money: { accounts: [], transactions: [], knownObligations: [] },
      goals: [],
      weeklyReviews: [],
    };

    const migrated = migrate(v2State);

    assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION);
    // Old task-era collections are gone, not carried forward:
    assert.equal(migrated.tasks, undefined);
    assert.equal(migrated.routines, undefined);
    assert.equal(migrated.calendarEvents, undefined);
    assert.equal(migrated.money, undefined);
    assert.equal(migrated.goals, undefined);
    assert.equal(migrated.weeklyReviews, undefined);
    // New budget collections are present and empty:
    assert.deepEqual(migrated.incomes, []);
    assert.deepEqual(migrated.bills, []);
    assert.deepEqual(migrated.plannedExpenses, []);
    assert.deepEqual(migrated.budget, { currentBalanceCents: 0, savingsAllocationCents: 0, safetyBufferCents: 0 });
    // What still applies carries over:
    assert.equal(migrated.meta.createdAt, '2026-01-01T00:00:00.000Z');
    assert.equal(migrated.settings.displayName, 'Alex');
    assert.equal(migrated.settings.theme, 'dark');
    assert.equal(migrated.settings.reducedMotion, true);
    // payScheduleHint (free-text) is retired, replaced by structured IncomeSource fields:
    assert.equal(migrated.settings.payScheduleHint, undefined);
  });
});

describe('the real v3 -> v4 migration (Phase 5 — Expense Tracking)', () => {
  test('adds an empty expenses collection, purely additive', () => {
    const v3State = {
      schemaVersion: 3,
      meta: { createdAt: 'x', lastOpenedAt: 'x' },
      settings: { onboardingCompletedAt: null, displayName: 'Alex', theme: 'system', reducedMotion: false },
      budget: { currentBalanceCents: 245000, savingsAllocationCents: 20000, safetyBufferCents: 15000 },
      incomes: [{ id: 'inc_1' }],
      bills: [{ id: 'b_1' }],
      plannedExpenses: [{ id: 'pe_1' }],
    };

    const migrated = migrate(v3State);

    assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.deepEqual(migrated.expenses, []);
    // Nothing else was touched:
    assert.deepEqual(migrated.budget, v3State.budget);
    assert.deepEqual(migrated.incomes, v3State.incomes);
    assert.deepEqual(migrated.bills, v3State.bills);
    assert.deepEqual(migrated.plannedExpenses, v3State.plannedExpenses);
  });
});

describe('the real v4 -> v5 migration (Phase 6 — Budget Planning)', () => {
  test('adds an empty categoryBudgets collection, purely additive', () => {
    const v4State = {
      schemaVersion: 4,
      meta: { createdAt: 'x', lastOpenedAt: 'x' },
      settings: { onboardingCompletedAt: null, displayName: 'Alex', theme: 'system', reducedMotion: false },
      budget: { currentBalanceCents: 245000, savingsAllocationCents: 20000, safetyBufferCents: 15000 },
      incomes: [{ id: 'inc_1' }],
      bills: [{ id: 'b_1' }],
      plannedExpenses: [{ id: 'pe_1' }],
      expenses: [{ id: 'e_1' }],
    };

    const migrated = migrate(v4State);

    assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.deepEqual(migrated.categoryBudgets, []);
    // Nothing else was touched:
    assert.deepEqual(migrated.budget, v4State.budget);
    assert.deepEqual(migrated.expenses, v4State.expenses);
    assert.deepEqual(migrated.bills, v4State.bills);
  });
});

describe('the real v5 -> v6 migration (IncomeReceipts — a real history log for "All time" received income)', () => {
  test('adds an empty incomeReceipts collection, purely additive', () => {
    const v5State = {
      schemaVersion: 5,
      meta: { createdAt: 'x', lastOpenedAt: 'x' },
      settings: { onboardingCompletedAt: null, displayName: 'Alex', theme: 'system', reducedMotion: false },
      budget: { currentBalanceCents: 245000, savingsAllocationCents: 20000 },
      incomes: [{ id: 'inc_1' }],
      bills: [{ id: 'b_1' }],
      plannedExpenses: [{ id: 'pe_1' }],
      expenses: [{ id: 'e_1' }],
      categoryBudgets: [{ id: 'cb_1' }],
    };

    const migrated = migrate(v5State);

    assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.deepEqual(migrated.incomeReceipts, []);
    // Nothing else was touched:
    assert.deepEqual(migrated.budget, v5State.budget);
    assert.deepEqual(migrated.incomes, v5State.incomes);
    assert.deepEqual(migrated.categoryBudgets, v5State.categoryBudgets);
  });
});

describe('the real v6 -> v7 migration (BillPayments — a real history log for "Money out")', () => {
  test('adds an empty billPayments collection, purely additive', () => {
    const v6State = {
      schemaVersion: 6,
      meta: { createdAt: 'x', lastOpenedAt: 'x' },
      settings: { onboardingCompletedAt: null, displayName: 'Alex', theme: 'system', reducedMotion: false },
      budget: { currentBalanceCents: 245000, savingsAllocationCents: 20000 },
      incomes: [{ id: 'inc_1' }],
      bills: [{ id: 'b_1' }],
      plannedExpenses: [{ id: 'pe_1' }],
      expenses: [{ id: 'e_1' }],
      categoryBudgets: [{ id: 'cb_1' }],
      incomeReceipts: [{ id: 'ir_1' }],
    };

    const migrated = migrate(v6State);

    assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.deepEqual(migrated.billPayments, []);
    // Nothing else was touched:
    assert.deepEqual(migrated.budget, v6State.budget);
    assert.deepEqual(migrated.bills, v6State.bills);
    assert.deepEqual(migrated.incomeReceipts, v6State.incomeReceipts);
  });
});
