// Settings is one of the few slices that predates any feature module
// (docs/DATA-MODEL.md "Settings") but never had its own reducer — every
// field was either a Phase 0 default or (displayName, for a long while)
// never actually set anywhere. Phase 7's onboarding flow is what first
// needed to mutate it; onboarding's "Your name" step is what finally set
// displayName for the first time, later still.
export function settingsReducer(settings = {}, action) {
  switch (action.type) {
    case 'settings/complete-onboarding': {
      if (settings.onboardingCompletedAt) return settings; // already completed — no-op
      return { ...settings, onboardingCompletedAt: action.now };
    }
    case 'settings/set-theme': {
      if (!['light', 'dark', 'system'].includes(action.theme)) return settings; // ignore an invalid value rather than storing garbage
      return { ...settings, theme: action.theme };
    }
    case 'settings/set-display-name': {
      const name = typeof action.name === 'string' ? action.name.trim() : '';
      return { ...settings, displayName: name || null };
    }
    default:
      return settings;
  }
}
