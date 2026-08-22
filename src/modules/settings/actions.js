/** @param {{now?: Date}} [options] */
export function completeOnboardingAction({ now = new Date() } = {}) {
  return { type: 'settings/complete-onboarding', now: now.toISOString() };
}

/**
 * Sets an explicit theme preference, overriding the OS-level
 * `prefers-color-scheme` — see src/ui/components/theme-toggle.js and
 * src/styles/base.css. `'system'` clears the override (the field's own
 * default — see src/core/schema.js `createEmptyState`).
 * @param {'light'|'dark'|'system'} theme
 */
export function setThemeAction(theme) {
  return { type: 'settings/set-theme', theme };
}

/**
 * Sets the display name used only for greeting copy (`Good morning,
 * {name}.` — src/ui/screens/dashboard.js `greetingText`). Optional —
 * asked once during onboarding (src/ui/screens/onboarding.js), never
 * required.
 * @param {string} name
 */
export function setDisplayNameAction(name) {
  return { type: 'settings/set-display-name', name };
}
