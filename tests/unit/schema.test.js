import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CURRENT_SCHEMA_VERSION, createEmptyState, migrate } from '../../src/core/schema.js';

describe('createEmptyState', () => {
  test('is stamped with the current schema version', () => {
    assert.equal(createEmptyState().schemaVersion, CURRENT_SCHEMA_VERSION);
  });

  test('has every top-level collection empty and settings at their defaults', () => {
    const state = createEmptyState();
    assert.deepEqual(state.tasks, []);
    assert.deepEqual(state.routines, { templates: [], instances: [] });
    assert.deepEqual(state.calendarEvents, []);
    assert.deepEqual(state.money, { accounts: [], transactions: [], knownObligations: [] });
    assert.deepEqual(state.goals, []);
    assert.deepEqual(state.weeklyReviews, []);
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
