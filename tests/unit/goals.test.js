// Tests for the Goals module (savings goals — the rework of the former
// Budget tab into a Goals tab, at the user's explicit request; added
// ahead of docs/ROADMAP.md's phase order like Debts / Brain Dump before
// it): CRUD + validation on the reducer, and the pure derived selectors
// (progress, months-to-go, the protected total that feeds Safe-to-Spend).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGoalAction,
  updateGoalAction,
  deleteGoalAction,
  goalsReducer,
  getAllGoals,
  getTotalGoalsSavedCents,
  getGoalProgress,
} from '../../src/modules/goals/index.js';

const NOW = new Date('2026-08-21T09:00:00.000Z');

function seedGoal(overrides) {
  const input = { name: 'Emergency fund', targetCents: 500000, savedCents: 120000, monthlyPaceCents: 20000, ...overrides };
  return goalsReducer([], createGoalAction(input, { now: NOW }))[0];
}

describe('goal creation', () => {
  test('the four fields make a valid goal; id/timestamps are stamped', () => {
    const goal = seedGoal();
    assert.equal(goal.name, 'Emergency fund');
    assert.equal(goal.targetCents, 500000);
    assert.equal(goal.savedCents, 120000);
    assert.equal(goal.monthlyPaceCents, 20000);
    assert.match(goal.id, /^g/);
    assert.equal(goal.createdAt, NOW.toISOString());
    assert.equal(goal.updatedAt, NOW.toISOString());
  });

  test('pace is optional — omitted becomes null', () => {
    const goal = seedGoal({ monthlyPaceCents: undefined });
    assert.equal(goal.monthlyPaceCents, null);
  });

  test('a blank name is rejected (reducer no-op)', () => {
    const before = [];
    const after = goalsReducer(before, createGoalAction({ name: '  ', targetCents: 100, savedCents: 0 }, { now: NOW }));
    assert.equal(after, before);
  });

  test('a non-integer / negative target or saved amount is rejected', () => {
    for (const bad of [{ targetCents: 12.5 }, { targetCents: -100 }, { savedCents: -1 }, { savedCents: NaN }]) {
      const after = goalsReducer([], createGoalAction({ name: 'x', targetCents: 100, savedCents: 0, ...bad }, { now: NOW }));
      assert.deepEqual(after, [], `expected reject for ${JSON.stringify(bad)}`);
    }
  });

  test('a negative pace is rejected', () => {
    const after = goalsReducer([], createGoalAction({ name: 'x', targetCents: 100, savedCents: 0, monthlyPaceCents: -5 }, { now: NOW }));
    assert.deepEqual(after, []);
  });
});

describe('goal update / delete', () => {
  test('editable fields update; invalid values are dropped from the change set', () => {
    const goal = seedGoal();
    const [updated] = goalsReducer([goal], updateGoalAction(goal.id, { name: 'New laptop', savedCents: 200000, targetCents: -1 }, { now: NOW }));
    assert.equal(updated.name, 'New laptop');
    assert.equal(updated.savedCents, 200000);
    assert.equal(updated.targetCents, 500000, 'invalid targetCents change ignored');
  });

  test('delete removes the goal', () => {
    const goal = seedGoal();
    assert.deepEqual(goalsReducer([goal], deleteGoalAction(goal.id)), []);
  });
});

describe('getGoalProgress', () => {
  test('percent, remaining, and months-to-go from the pace', () => {
    const p = getGoalProgress(seedGoal({ targetCents: 500000, savedCents: 120000, monthlyPaceCents: 20000 }));
    assert.equal(p.remainingCents, 380000);
    assert.equal(Math.round(p.percentSaved), 24);
    assert.equal(p.isReached, false);
    assert.equal(p.monthsToGo, 19); // ceil(380000 / 20000)
  });

  test('reached goal — clamped to 100%, no months-to-go', () => {
    const p = getGoalProgress(seedGoal({ targetCents: 100000, savedCents: 150000, monthlyPaceCents: 20000 }));
    assert.equal(p.percentSaved, 100);
    assert.equal(p.isReached, true);
    assert.equal(p.remainingCents, 0);
    assert.equal(p.monthsToGo, null);
  });

  test('no pace set — months-to-go is null', () => {
    const p = getGoalProgress(seedGoal({ monthlyPaceCents: null }));
    assert.equal(p.monthsToGo, null);
  });

  test('corrupted amounts fall back to 0 rather than NaN', () => {
    const p = getGoalProgress({ targetCents: 'oops', savedCents: null });
    assert.equal(p.percentSaved, 0);
    assert.equal(p.remainingCents, 0);
  });
});

describe('getTotalGoalsSavedCents', () => {
  test('sums every goal’s savedCents; skips a corrupted one', () => {
    const state = { goals: [seedGoal({ savedCents: 120000 }), seedGoal({ savedCents: 30000 }), { savedCents: 'bad' }] };
    assert.equal(getTotalGoalsSavedCents(state), 150000);
  });

  test('missing / non-array goals collection is treated as empty', () => {
    assert.equal(getTotalGoalsSavedCents({}), 0);
    assert.equal(getTotalGoalsSavedCents({ goals: null }), 0);
    assert.deepEqual(getAllGoals({ goals: 'nope' }), []);
  });
});
