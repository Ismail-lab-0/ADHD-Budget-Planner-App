// Phase 8 — Full Testing and Validation, §5 "Data safety": corrupted
// localStorage, missing values, invalid values, empty data, and an
// unexpected old data format, exercised at the full initAppState /
// getSafeToSpend / getCategoryBudgetProgress level — not just the
// individual storage.js/schema.js unit tests (storage.test.js,
// schema.test.js) that already cover the adapter and migration registry
// in isolation. The bar throughout: the app degrades to a safe, usable
// state and never throws.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { initAppState } from '../../src/main.js';
import { createStorageAdapter } from '../../src/core/storage.js';
import { migrate, CURRENT_SCHEMA_VERSION } from '../../src/core/schema.js';
import { getSafeToSpend } from '../../src/modules/safe-to-spend/index.js';
import { getCategoryBudgetProgress } from '../../src/modules/category-budgets/index.js';
import { getUpcomingCommitments } from '../../src/modules/dashboard/index.js';

function createMockStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

const NOW = new Date(2026, 7, 21);

describe('corrupted localStorage', () => {
  test('unparseable JSON: the app starts cleanly at a usable empty state, corrupted data preserved for recovery', () => {
    const backing = createMockStorage({ 'adhd-planner:v1': '{not valid json!!' });
    const storageAdapter = createStorageAdapter({ storage: backing, debounceMs: 0 });
    const { store } = initAppState({ storageAdapter, now: NOW });

    assert.equal(store.getState().schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.doesNotThrow(() => getSafeToSpend(store.getState(), { now: NOW }));
    assert.equal(backing.getItem('adhd-planner:v1:recovery'), '{not valid json!!');
  });

  test('valid JSON but the wrong shape (an array instead of an object): treated as corrupt, not crashed on', () => {
    const backing = createMockStorage({ 'adhd-planner:v1': JSON.stringify([1, 2, 3]) });
    const storageAdapter = createStorageAdapter({ storage: backing, debounceMs: 0 });
    const { store } = initAppState({ storageAdapter, now: NOW });

    assert.equal(store.getState().schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.deepEqual(store.getState().incomes, []);
  });

  test('a schemaVersion from a future build this code does not understand: falls back to a fresh state', () => {
    const backing = createMockStorage({ 'adhd-planner:v1': JSON.stringify({ schemaVersion: 9999, budget: { currentBalanceCents: 500000 } }) });
    const storageAdapter = createStorageAdapter({ storage: backing, debounceMs: 0 });
    const { store } = initAppState({ storageAdapter, now: NOW });

    // The (unreadable) future data is not misread — the $5,000 balance from
    // the future format never leaks through as if it were understood.
    assert.equal(store.getState().budget.currentBalanceCents, 0);
  });
});

describe('missing values', () => {
  test('a state object missing entire top-level collections does not throw when computing Safe-to-Spend', () => {
    const bareBones = { schemaVersion: CURRENT_SCHEMA_VERSION, budget: { currentBalanceCents: 10000 } };
    assert.doesNotThrow(() => getSafeToSpend(bareBones, { now: NOW }));
    const result = getSafeToSpend(bareBones, { now: NOW });
    assert.equal(result.safeToSpendCents, 10000);
  });

  test('a completely empty object ({}) does not throw anywhere in the calculation pipeline', () => {
    assert.doesNotThrow(() => getSafeToSpend({}, { now: NOW }));
    assert.doesNotThrow(() => getCategoryBudgetProgress({}, { now: NOW }));
    assert.doesNotThrow(() => getUpcomingCommitments({}));
  });

  test('an income/bill missing its own amountCents field is skipped, not NaN-summed', () => {
    const s = {
      budget: { currentBalanceCents: 50000 },
      bills: [{ id: 'b1', name: 'Rent', active: true, paid: false }], // no amountCents at all
      incomes: [],
      plannedExpenses: [],
    };
    const result = getSafeToSpend(s, { now: NOW });
    assert.equal(result.upcomingBillsCents, 0);
    assert.equal(result.safeToSpendCents, 50000);
  });
});

describe('invalid values', () => {
  test('a non-array `incomes`/`bills`/`plannedExpenses` (e.g. corrupted to null or an object) does not throw', () => {
    const s = {
      budget: { currentBalanceCents: 20000 },
      incomes: null,
      bills: undefined,
      plannedExpenses: {},
    };
    assert.doesNotThrow(() => getSafeToSpend(s, { now: NOW }));
  });

  test('a string/negative/NaN amountCents on a bill is skipped rather than corrupting the total', () => {
    const s = {
      budget: { currentBalanceCents: 100000 },
      bills: [
        { id: 'b1', name: 'Valid', amountCents: 5000, active: true, paid: false, dueDate: '2026-08-25' },
        { id: 'b2', name: 'Corrupted string', amountCents: 'oops', active: true, paid: false, dueDate: '2026-08-25' },
        { id: 'b3', name: 'Negative', amountCents: -100, active: true, paid: false, dueDate: '2026-08-25' },
        { id: 'b4', name: 'NaN', amountCents: NaN, active: true, paid: false, dueDate: '2026-08-25' },
      ],
      incomes: [],
      plannedExpenses: [],
    };
    const result = getSafeToSpend(s, { now: NOW });
    assert.equal(result.upcomingBillsCents, 5000); // only the one valid bill counts
    assert.equal(Number.isNaN(result.safeToSpendCents), false);
  });

  test('a non-integer (float) currentBalanceCents from corrupted data is treated as invalid and defaults to 0, not silently truncated', () => {
    const s = { budget: { currentBalanceCents: 123.45 }, incomes: [], bills: [], plannedExpenses: [] };
    const result = getSafeToSpend(s, { now: NOW });
    assert.equal(result.currentBalanceCents, 0);
  });

  test('a corrupted expense amountCents does not NaN-poison a category budget\'s progress', () => {
    const s = {
      categoryBudgets: [{ id: 'cb1', category: 'Groceries', limitCents: 40000 }],
      expenses: [{ id: 'e1', category: 'Groceries', amountCents: 'not a number', date: '2026-08-05' }],
    };
    const [progress] = getCategoryBudgetProgress(s, { now: NOW });
    assert.equal(progress.spentCents, 0);
    assert.equal(Number.isNaN(progress.spentCents), false);
    assert.equal(progress.status, 'on-track');
  });
});

describe('empty data', () => {
  test('a genuinely fresh install produces a fully usable, zeroed dashboard with no throws anywhere', () => {
    const storageAdapter = createStorageAdapter({ storage: createMockStorage(), debounceMs: 0 });
    const { store } = initAppState({ storageAdapter, now: NOW });
    const state = store.getState();

    const safeToSpend = getSafeToSpend(state, { now: NOW });
    assert.equal(safeToSpend.safeToSpendCents, 0);
    assert.equal(safeToSpend.isNegative, false);
    assert.deepEqual(getCategoryBudgetProgress(state, { now: NOW }), []);
    assert.deepEqual(getUpcomingCommitments(state), { items: [], remainingCount: 0 });
  });
});

describe('unexpected old data format', () => {
  test('a v1 (pre-Phase-2, task-oriented, no schemaVersion at all) blob migrates all the way to the current shape without throwing', () => {
    const v1Blob = {
      tasks: [{ id: 't1', title: 'Legacy task', completedAt: null, createdAt: '2025-01-01T00:00:00.000Z', dueAt: null, effortMinutes: null, context: null }],
    };
    const migrated = migrate(v1Blob);
    assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION);
    // Everything task/routine/calendar/goal-shaped from the retired product
    // direction is gone; the budget-shaped collections exist and are empty.
    assert.equal('tasks' in migrated, false);
    assert.deepEqual(migrated.incomes, []);
    assert.deepEqual(migrated.bills, []);
    assert.deepEqual(migrated.expenses, []);
    assert.deepEqual(migrated.categoryBudgets, []);
    assert.doesNotThrow(() => getSafeToSpend(migrated, { now: NOW }));
  });

  test('truly unrecognized garbage (no schemaVersion, no known fields at all) still migrates to a safe, usable shape', () => {
    const garbage = { someRandomField: 'hello', nested: { a: 1 } };
    const migrated = migrate(garbage);
    assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.doesNotThrow(() => getSafeToSpend(migrated, { now: NOW }));
    const result = getSafeToSpend(migrated, { now: NOW });
    assert.equal(result.safeToSpendCents, 0);
  });

  test('the same garbage, loaded through the full storage adapter + initAppState pipeline, never throws and never crashes the app', () => {
    const backing = createMockStorage({ 'adhd-planner:v1': JSON.stringify({ weird: true, oldField: 'x' }) });
    const storageAdapter = createStorageAdapter({ storage: backing, debounceMs: 0 });
    assert.doesNotThrow(() => initAppState({ storageAdapter, now: NOW }));
  });
});
