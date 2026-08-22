// Integration tests, through the real store (src/main.js's initAppState):
// onboarding gating and the backfill for returning users with pre-existing
// data (Phase 7).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { initAppState } from '../../src/main.js';
import { createStorageAdapter } from '../../src/core/storage.js';
import { hasCompletedOnboarding } from '../../src/modules/settings/index.js';
import { setCurrentBalanceAction } from '../../src/modules/budget/index.js';
import { createBillAction } from '../../src/modules/bills/index.js';
import { completeOnboardingAction } from '../../src/modules/settings/index.js';

function createMockStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

const NOW = new Date(2026, 7, 21);

describe('a brand-new install shows onboarding', () => {
  test('a fresh state has not completed onboarding', () => {
    const { store } = initAppState({ storageAdapter: createStorageAdapter({ storage: createMockStorage(), debounceMs: 0 }), now: NOW });
    assert.equal(hasCompletedOnboarding(store.getState()), false);
  });

  test('dispatching completeOnboardingAction (Skip or Finish — same action) marks it done', () => {
    const { store } = initAppState({ storageAdapter: createStorageAdapter({ storage: createMockStorage(), debounceMs: 0 }), now: NOW });
    store.dispatch(completeOnboardingAction({ now: NOW }));
    assert.equal(hasCompletedOnboarding(store.getState()), true);
    assert.equal(store.getState().settings.onboardingCompletedAt, NOW.toISOString());
  });
});

describe('a returning user with pre-existing budget data is never shown onboarding', () => {
  test('an existing non-zero current balance backfills onboarding as complete', () => {
    const backing = createMockStorage();
    const first = initAppState({ storageAdapter: createStorageAdapter({ storage: backing, debounceMs: 0 }), now: NOW });
    first.store.dispatch(setCurrentBalanceAction(245000));
    first.adapter.flush();

    // Simulate a later session — e.g. after Phase 7 shipped for a user
    // who set up their balance back in Phase 2, long before onboarding
    // existed.
    const second = initAppState({ storageAdapter: createStorageAdapter({ storage: backing, debounceMs: 0 }), now: NOW });
    assert.equal(hasCompletedOnboarding(second.store.getState()), true);
  });

  test('an existing bill (balance still zero) also backfills onboarding as complete', () => {
    const backing = createMockStorage();
    const first = initAppState({ storageAdapter: createStorageAdapter({ storage: backing, debounceMs: 0 }), now: NOW });
    first.store.dispatch(createBillAction({ name: 'Rent', amountCents: 120000 }, { now: NOW }));
    first.adapter.flush();

    const second = initAppState({ storageAdapter: createStorageAdapter({ storage: backing, debounceMs: 0 }), now: NOW });
    assert.equal(hasCompletedOnboarding(second.store.getState()), true);
  });

  test('a genuinely empty returning state (nothing set) is still shown onboarding', () => {
    const backing = createMockStorage();
    const first = initAppState({ storageAdapter: createStorageAdapter({ storage: backing, debounceMs: 0 }), now: NOW });
    first.adapter.flush();

    const second = initAppState({ storageAdapter: createStorageAdapter({ storage: backing, debounceMs: 0 }), now: NOW });
    assert.equal(hasCompletedOnboarding(second.store.getState()), false);
  });
});

describe('onboarding completion persists', () => {
  test('completing onboarding survives a simulated reload', () => {
    const backing = createMockStorage();
    const first = initAppState({ storageAdapter: createStorageAdapter({ storage: backing, debounceMs: 0 }), now: NOW });
    first.store.dispatch(completeOnboardingAction({ now: NOW }));
    first.adapter.flush();

    const second = initAppState({ storageAdapter: createStorageAdapter({ storage: backing, debounceMs: 0 }), now: NOW });
    assert.equal(hasCompletedOnboarding(second.store.getState()), true);
  });
});
