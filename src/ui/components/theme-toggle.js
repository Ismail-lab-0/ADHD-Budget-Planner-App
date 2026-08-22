// A small icon button in the header bar for an explicit Light/Dark
// preference — wires up the `settings.theme` field (src/modules/settings/)
// that already existed but was never read/written by anything before this
// (see CLAUDE.md "Current status"). No stored preference ('system', the
// default) means "keep following the OS," exactly as before this existed.

import { iconButton } from './icons.js';
import { getTheme, setThemeAction } from '../../modules/settings/index.js';

/**
 * The theme actually in effect right now — the explicit `settings.theme`
 * choice if there is one, otherwise the OS's own `prefers-color-scheme`.
 * @param {object} state
 * @returns {'light'|'dark'}
 */
export function getEffectiveTheme(state) {
  const stored = getTheme(state);
  if (stored === 'light' || stored === 'dark') return stored;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * @param {object} options
 * @param {object} options.state
 * @param {Function} options.dispatch
 */
export function renderThemeToggle({ state, dispatch }) {
  const effective = getEffectiveTheme(state);
  // The icon shown is the mode a click switches *to* — a moon while
  // currently light (tap for dark), a sun while currently dark (tap for
  // light) — the common convention for this control.
  const nextTheme = effective === 'dark' ? 'light' : 'dark';
  const icon = effective === 'dark' ? 'sun' : 'moon';
  const label = effective === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return iconButton(icon, label, () => dispatch(setThemeAction(nextTheme)), { tone: 'neutral' });
}
