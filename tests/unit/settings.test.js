// Tests for the Settings module (Phase 7 — Onboarding).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  completeOnboardingAction,
  setThemeAction,
  setDisplayNameAction,
  setCurrencyAction,
  settingsReducer,
  getOnboardingCompletedAt,
  hasCompletedOnboarding,
  getTheme,
  getDisplayName,
  getCurrency,
} from '../../src/modules/settings/index.js';

const NOW = new Date('2026-08-21T09:00:00.000Z');

describe('completeOnboardingAction / settingsReducer', () => {
  test('sets onboardingCompletedAt when not yet completed', () => {
    const [next] = [settingsReducer({ onboardingCompletedAt: null }, completeOnboardingAction({ now: NOW }))];
    assert.equal(next.onboardingCompletedAt, NOW.toISOString());
  });

  test('is a no-op if onboarding was already completed (same reference, doesn\'t overwrite the timestamp)', () => {
    const settings = { onboardingCompletedAt: '2026-01-01T00:00:00.000Z' };
    const next = settingsReducer(settings, completeOnboardingAction({ now: NOW }));
    assert.equal(next, settings);
    assert.equal(next.onboardingCompletedAt, '2026-01-01T00:00:00.000Z');
  });

  test('leaves other settings fields untouched', () => {
    const settings = { onboardingCompletedAt: null, theme: 'dark', displayName: 'Alex' };
    const next = settingsReducer(settings, completeOnboardingAction({ now: NOW }));
    assert.equal(next.theme, 'dark');
    assert.equal(next.displayName, 'Alex');
  });
});

describe('getOnboardingCompletedAt / hasCompletedOnboarding', () => {
  test('reflects an unset settings object as not completed', () => {
    assert.equal(getOnboardingCompletedAt({}), null);
    assert.equal(hasCompletedOnboarding({}), false);
  });

  test('reflects a completed timestamp', () => {
    const state = { settings: { onboardingCompletedAt: NOW.toISOString() } };
    assert.equal(getOnboardingCompletedAt(state), NOW.toISOString());
    assert.equal(hasCompletedOnboarding(state), true);
  });
});

describe('setThemeAction / settingsReducer', () => {
  test('stores an explicit light/dark choice', () => {
    const next = settingsReducer({ theme: 'system' }, setThemeAction('dark'));
    assert.equal(next.theme, 'dark');
  });

  test('"system" clears back to following the OS', () => {
    const next = settingsReducer({ theme: 'dark' }, setThemeAction('system'));
    assert.equal(next.theme, 'system');
  });

  test('an invalid value is ignored, not stored', () => {
    const settings = { theme: 'dark' };
    const next = settingsReducer(settings, setThemeAction('purple'));
    assert.equal(next, settings);
    assert.equal(next.theme, 'dark');
  });

  test('leaves other settings fields untouched', () => {
    const next = settingsReducer({ theme: 'system', displayName: 'Alex' }, setThemeAction('light'));
    assert.equal(next.displayName, 'Alex');
  });
});

describe('getTheme', () => {
  test('defaults to "system" when unset', () => {
    assert.equal(getTheme({ settings: {} }), 'system');
    assert.equal(getTheme({ settings: { theme: 'purple' } }), 'system'); // an invalid stored value also falls back
  });

  test('reflects an explicit light/dark choice', () => {
    assert.equal(getTheme({ settings: { theme: 'light' } }), 'light');
    assert.equal(getTheme({ settings: { theme: 'dark' } }), 'dark');
  });
});

describe('setDisplayNameAction / settingsReducer', () => {
  test('stores a trimmed name', () => {
    const next = settingsReducer({ displayName: null }, setDisplayNameAction('  Alex  '));
    assert.equal(next.displayName, 'Alex');
  });

  test('a blank/whitespace-only name clears it back to null, not an empty string', () => {
    const next = settingsReducer({ displayName: 'Alex' }, setDisplayNameAction('   '));
    assert.equal(next.displayName, null);
  });

  test('leaves other settings fields untouched', () => {
    const next = settingsReducer({ theme: 'dark', displayName: null }, setDisplayNameAction('Sam'));
    assert.equal(next.theme, 'dark');
  });
});

describe('getDisplayName', () => {
  test('reflects a stored name', () => {
    assert.equal(getDisplayName({ settings: { displayName: 'Alex' } }), 'Alex');
  });

  test('defaults to null when unset', () => {
    assert.equal(getDisplayName({ settings: {} }), null);
    assert.equal(getDisplayName({}), null);
  });
});

describe('setCurrencyAction / settingsReducer', () => {
  test('stores a supported currency code', () => {
    const next = settingsReducer({ currency: 'USD' }, setCurrencyAction('EUR'));
    assert.equal(next.currency, 'EUR');
  });

  test('an unsupported/invalid code is ignored, not stored', () => {
    const settings = { currency: 'USD' };
    const next = settingsReducer(settings, setCurrencyAction('XXX'));
    assert.equal(next, settings);
    assert.equal(next.currency, 'USD');
  });

  test('leaves other settings fields untouched', () => {
    const next = settingsReducer({ currency: 'USD', displayName: 'Alex' }, setCurrencyAction('GBP'));
    assert.equal(next.displayName, 'Alex');
  });
});

describe('getCurrency', () => {
  test('reflects a stored, supported currency', () => {
    assert.equal(getCurrency({ settings: { currency: 'EUR' } }), 'EUR');
  });

  test('defaults to "USD" when unset or the stored value is unrecognized', () => {
    assert.equal(getCurrency({ settings: {} }), 'USD');
    assert.equal(getCurrency({}), 'USD');
    assert.equal(getCurrency({ settings: { currency: 'XXX' } }), 'USD');
  });
});
