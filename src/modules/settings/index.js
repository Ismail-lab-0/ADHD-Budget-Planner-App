// The Settings module's public interface. See docs/ARCHITECTURE.md §7.

export { completeOnboardingAction, setThemeAction, setDisplayNameAction } from './actions.js';
export { getOnboardingCompletedAt, hasCompletedOnboarding, getTheme, getDisplayName } from './selectors.js';
export { settingsReducer } from './reducer.js';
