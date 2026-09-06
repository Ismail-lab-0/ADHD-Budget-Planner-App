// A tiny hash-based view router. The app used to be a single scrolling
// screen with an in-page anchor sidebar; at the user's explicit request
// it's now a real multi-view app — each sidebar item is a distinct
// destination with its own screen, not a scroll target.
//
// Deliberately hand-rolled (no framework, per docs/ARCHITECTURE.md §2):
// the whole contract is "read a view id from location.hash" +
// "set location.hash" + "re-render on hashchange". The application STATE
// (the store, localStorage) is completely independent of the hash —
// switching views, refreshing, and Back/Forward never touch data.

// The known views. Order here is only used as a fallback; the sidebar
// (src/ui/components/sidebar.js) owns the displayed grouping/order.
export const APP_VIEWS = ['dashboard', 'income', 'expenses', 'bills', 'debts', 'goals', 'categories', 'settings'];
const DEFAULT_VIEW = 'dashboard';
// Friendly aliases so an old/typed hash still lands somewhere sensible.
// `budget` -> `goals`: the Budget tab was reworked into a Goals tab, so
// an old `#budget` bookmark still resolves.
const VIEW_ALIASES = { '': 'dashboard', index: 'dashboard', home: 'dashboard', overview: 'dashboard', budget: 'goals' };

/**
 * The view the current URL asks for. Tolerates `#expenses`, `#/expenses`,
 * `#EXPENSES`, an alias, or nothing — anything unrecognized falls back to
 * the Dashboard rather than showing a blank screen.
 * @returns {string} one of APP_VIEWS
 */
export function getCurrentView() {
  if (typeof location === 'undefined') return DEFAULT_VIEW;
  const raw = (location.hash || '').replace(/^#\/?/, '').trim().toLowerCase();
  if (APP_VIEWS.includes(raw)) return raw;
  if (raw in VIEW_ALIASES) return VIEW_ALIASES[raw];
  return DEFAULT_VIEW;
}

/**
 * Navigate to a view by setting the URL hash — which fires a `hashchange`
 * event that `initViewRouter`'s listener turns into a re-render. Browser
 * Back/Forward therefore work for free.
 * @param {string} viewId
 * @returns {boolean} true if the hash actually changed (a `hashchange`
 *   will follow); false if it was already on that view (caller may still
 *   want to re-render, e.g. to close the mobile drawer).
 */
export function navigateToView(viewId) {
  if (typeof location === 'undefined') return false;
  const target = APP_VIEWS.includes(viewId) ? viewId : DEFAULT_VIEW;
  if (getCurrentView() === target) return false;
  location.hash = target;
  return true;
}

/**
 * Register the one `hashchange` listener. Called once from
 * `src/ui/shell.js`'s `mountShell`.
 * @param {() => void} onChange
 */
export function initViewRouter(onChange) {
  if (typeof window === 'undefined') return;
  window.addEventListener('hashchange', onChange);
}
