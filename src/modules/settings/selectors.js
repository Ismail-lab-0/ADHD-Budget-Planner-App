import { SUPPORTED_CURRENCIES } from '../../core/money.js';

export function getOnboardingCompletedAt(state) {
  return state.settings?.onboardingCompletedAt ?? null;
}

export function hasCompletedOnboarding(state) {
  return getOnboardingCompletedAt(state) != null;
}

/** @returns {'light'|'dark'|'system'} the stored theme preference — 'system' means "follow the OS," the field's own default. */
export function getTheme(state) {
  const theme = state.settings?.theme;
  return theme === 'light' || theme === 'dark' ? theme : 'system';
}

/** @returns {string|null} the display name used for greeting copy, or null if never set. */
export function getDisplayName(state) {
  return state.settings?.displayName ?? null;
}

/** @returns {string} the stored display-currency preference (an ISO 4217 code) — 'USD' if never set or the stored value isn't recognized. */
export function getCurrency(state) {
  return SUPPORTED_CURRENCIES.includes(state.settings?.currency) ? state.settings.currency : 'USD';
}
